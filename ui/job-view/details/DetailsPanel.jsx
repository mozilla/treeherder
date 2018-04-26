import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import { chunk } from 'lodash';
import $ from 'jquery';

import treeherder from '../../js/treeherder';
import {
  thEvents,
  thBugSuggestionLimit,
  thPinboardCountError,
  thPinboardMaxSize,
} from '../../js/constants';
import { getLogViewerUrl, getReftestUrl } from '../../helpers/url';
import BugJobMapModel from '../../models/bugJobMap';
import BugSuggestionsModel from '../../models/bugSuggestions';
import JobClassificationModel from '../../models/classification';
import JobModel from '../../models/job';
import JobDetailModel from '../../models/jobDetail';
import JobLogUrlModel from '../../models/jobLogUrl';
import TextLogStepModel from '../../models/textLogStep';

import PinBoard from './PinBoard';
import SummaryPanel from './summary/SummaryPanel';
import TabsPanel from './tabs/TabsPanel';

class DetailsPanel extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;

    this.PhSeries = $injector.get('PhSeries');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.thClassificationTypes = $injector.get('thClassificationTypes');
    this.thNotify = $injector.get('thNotify');
    this.$rootScope = $injector.get('$rootScope');
    this.$location = $injector.get('$location');
    this.$timeout = $injector.get('$timeout');

    // used to cancel all the ajax requests triggered by selectJob
    this.selectJobController = null;

    this.state = {
      isPinBoardVisible: false,
      jobDetails: [],
      jobLogUrls: [],
      jobDetailLoading: false,
      jobLogsAllParsed: false,
      logViewerUrl: null,
      logViewerFullUrl: null,
      reftestUrl: null,
      perfJobDetail: [],
      jobRevision: null,
      logParseStatus: 'unavailable',
      classifications: [],
      bugs: [],
      suggestions: [],
      errors: [],
      bugSuggestionsLoading: false,
      pinnedJobs: {},
      pinnedJobBugs: {},
    };
  }

  componentDidMount() {
    this.pinJob = this.pinJob.bind(this);
    this.unPinJob = this.unPinJob.bind(this);
    this.unPinAll = this.unPinAll.bind(this);
    this.addBug = this.addBug.bind(this);
    this.removeBug = this.removeBug.bind(this);
    this.closeJob = this.closeJob.bind(this);
    this.countPinnedJobs = this.countPinnedJobs.bind(this);
    // give access to this count to components that don't have a common ancestor in React
    // TODO: remove this once we're fully on ReactJS: Bug 1450042
    this.$rootScope.countPinnedJobs = this.countPinnedJobs;

    this.jobClickUnlisten = this.$rootScope.$on(thEvents.jobClick, (evt, job) => {
      this.setState({
        jobDetailLoading: true,
        jobDetails: [],
        suggestions: [],
        isPinBoardVisible: !!this.countPinnedJobs(),
      }, () => this.selectJob(job));
    });

    this.clearSelectedJobUnlisten = this.$rootScope.$on(thEvents.clearSelectedJob, () => {
      if (this.selectJobController !== null) {
        this.selectJobController.abort();
      }
      if (!this.countPinnedJobs()) {
        this.closeJob();
      }
    });

    this.toggleJobPinUnlisten = this.$rootScope.$on(thEvents.toggleJobPin, (event, job) => {
      this.toggleJobPin(job);
    });

    this.jobPinUnlisten = this.$rootScope.$on(thEvents.jobPin, (event, job) => {
      this.pinJob(job);
    });

    this.jobsClassifiedUnlisten = this.$rootScope.$on(thEvents.jobsClassified, () => {
      this.updateClassifications(this.props.selectedJob);
    });

    this.pinAllShownJobsUnlisten = this.$rootScope.$on(thEvents.pinJobs, (event, jobs) => {
      this.pinJobs(jobs);
    });

    this.clearPinboardUnlisten = this.$rootScope.$on(thEvents.clearPinboard, () => {
      if (this.state.isPinBoardVisible) {
        this.unPinAll();
      }
    });

    this.pulsePinCountUnlisten = this.$rootScope.$on(thEvents.pulsePinCount, () => {
      this.pulsePinCount();
    });
  }

  componentWillUnmount() {
    this.jobClickUnlisten();
    this.clearSelectedJobUnlisten();
    this.toggleJobPinUnlisten();
    this.jobPinUnlisten();
    this.jobsClassifiedUnlisten();
    this.clearPinboardUnlisten();
    this.pulsePinCountUnlisten();
    this.pinAllShownJobsUnlisten();
  }

  getRevisionTips() {
    return this.ThResultSetStore.getPushArray().map(push => ({
      revision: push.revision,
      author: push.author,
      title: push.revisions[0].comments.split('\n')[0]
    }));
  }

  togglePinBoardVisibility() {
      this.setState({ isPinBoardVisible: !this.state.isPinBoardVisible });
  }

  loadBugSuggestions(job) {
      const { repoName } = this.props;

      BugSuggestionsModel.get(job.id).then((suggestions) => {
          suggestions.forEach((suggestion) => {
              suggestion.bugs.too_many_open_recent = (
                  suggestion.bugs.open_recent.length > thBugSuggestionLimit
              );
              suggestion.bugs.too_many_all_others = (
                  suggestion.bugs.all_others.length > thBugSuggestionLimit
              );
              suggestion.valid_open_recent = (
                  suggestion.bugs.open_recent.length > 0 &&
                      !suggestion.bugs.too_many_open_recent
              );
              suggestion.valid_all_others = (
                  suggestion.bugs.all_others.length > 0 &&
                      !suggestion.bugs.too_many_all_others &&
                      // If we have too many open_recent bugs, we're unlikely to have
                      // relevant all_others bugs, so don't show them either.
                      !suggestion.bugs.too_many_open_recent
              );
          });

          // if we have no bug suggestions, populate with the raw errors from
          // the log (we can do this asynchronously, it should normally be
          // fast)
          if (!suggestions.length) {
              TextLogStepModel.get(job.id).then((textLogSteps) => {
                  const errors = textLogSteps
                      .filter(step => step.result !== 'success')
                      .map(step => ({
                        name: step.name,
                        result: step.result,
                        logViewerUrl: getLogViewerUrl(job.id, repoName, step.finished_line_number)
                      }));
                  this.setState({ errors });
              });
          }

          this.setState({ bugSuggestionsLoading: false, suggestions });
      });
  }

  async updateClassifications(job) {
    const classifications = await JobClassificationModel.getList({ job_id: job.id });
    const bugs = await BugJobMapModel.getList({ job_id: job.id });
    this.setState({ classifications, bugs });
  }

  selectJob(newJob) {
    const { repoName } = this.props;

    if (this.selectJobController !== null) {
      // Cancel the in-progress fetch requests.
      this.selectJobController.abort();
    }
    // eslint-disable-next-line no-undef
    this.selectJobController = new AbortController();

    let jobDetails = [];
    const jobPromise = JobModel.get(
      repoName, newJob.id,
      this.selectJobController.signal);

    const jobDetailPromise = JobDetailModel.getJobDetails(
      { job_guid: newJob.job_guid },
      this.selectJobController.signal);

    const jobLogUrlPromise = JobLogUrlModel.getList(
      { job_id: newJob.id },
      this.selectJobController.signal);

    const phSeriesPromise = this.PhSeries.getSeriesData(
      repoName, { job_id: newJob.id });

    Promise.all([
      jobPromise,
      jobDetailPromise,
      jobLogUrlPromise,
      phSeriesPromise
    ]).then(async (results) => {

      // The first result comes from the job promise.
      // This version of the job has more information than what we get in the main job list.  This
      // is what we'll pass to the rest of the details panel.  It has extra fields like
      // taskcluster_metadata.
      const job = results[0];
      const jobRevision = this.ThResultSetStore.getPush(job.result_set_id).revision;

      // the second result comes from the job detail promise
      jobDetails = results[1];

      // incorporate the buildername into the job details if this is a buildbot job
      // (i.e. it has a buildbot request id)
      const buildbotRequestIdDetail = jobDetails.find(detail => detail.title === 'buildbot_request_id');
      if (buildbotRequestIdDetail) {
        jobDetails = [...jobDetails, { title: 'Buildername', value: job.ref_data_name }];
      }

      // the third result comes from the jobLogUrl promise
      // exclude the json log URLs
      const jobLogUrls = results[2].filter(log => !log.name.endsWith('_json'));

      let logParseStatus = 'unavailable';
      // Provide a parse status as a scope variable for logviewer shortcut
      if (jobLogUrls.length && jobLogUrls[0].parse_status) {
        logParseStatus = jobLogUrls[0].parse_status;
      }

      // Provide a parse status for the model
      const jobLogsAllParsed = (jobLogUrls ?
        jobLogUrls.every(jlu => jlu.parse_status !== 'pending') :
        false);

      const logViewerUrl = getLogViewerUrl(job.id, repoName);
      const logViewerFullUrl = `${location.origin}/${logViewerUrl}`;
      const reftestUrl = jobLogUrls.length ?
        `${getReftestUrl(jobLogUrls[0].url)}&only_show_unexpected=1` :
        '';
      const performanceData = Object.values(results[3]).reduce((a, b) => [...a, ...b], []);

      let perfJobDetail = [];
      if (performanceData) {
        const signatureIds = [...new Set(performanceData.map(perf => perf.signature_id))];
        const seriesListList = await Promise.all(chunk(signatureIds, 20).map(
          signatureIdChunk => this.PhSeries.getSeriesList(repoName, { id: signatureIdChunk })
        ));
        const seriesList = seriesListList.reduce((a, b) => [...a, ...b], []);

        perfJobDetail = performanceData.map(d => ({
          series: seriesList.find(s => d.signature_id === s.id),
          ...d
        })).filter(d => !d.series.parentSignature).map(d => ({
          url: `/perf.html#/graphs?series=${[repoName, d.signature_id, 1, d.series.frameworkId]}&selected=${[repoName, d.signature_id, job.result_set_id, d.id]}`,
          value: d.value,
          title: d.series.name
        }));
      }

      this.setState({
        job,
        jobLogUrls,
        jobDetails,
        jobLogsAllParsed,
        logParseStatus,
        logViewerUrl,
        logViewerFullUrl,
        reftestUrl,
        perfJobDetail,
        jobRevision,
      }, async () => {
        await this.updateClassifications(job);
        await this.loadBugSuggestions(job);
        this.setState({ jobDetailLoading: false });
      });
    }).finally(() => {
      this.selectJobController = null;
    });
  }

  closeJob() {
    this.$rootScope.selectedJob = null;
    this.ThResultSetStore.setSelectedJob();
    this.$location.search('selectedJob', null);
    if (this.selectJobController) {
      this.selectJobController.abort();
    }

    this.setState({ isPinboardVisible: false });
  }

  toggleJobPin(job) {
    const { pinnedJobs } = this.state;

    if (pinnedJobs.includes(job)) {
      this.unPinJob(job);
    } else {
      this.pinJob(job);
    }
    if (!this.selectedJob) {
      this.selectJob(job);
    }
  }

  pulsePinCount() {
    $('.pin-count-group').addClass('pin-count-pulse');
    window.setTimeout(() => {
      $('.pin-count-group').removeClass('pin-count-pulse');
    }, 700);
  }

  pinJob(job) {
    const { pinnedJobs } = this.state;

    if (thPinboardMaxSize - this.countPinnedJobs() > 0) {
      this.setState({
        pinnedJobs: { ...pinnedJobs, [job.id]: job },
        isPinBoardVisible: true,
      });
      this.pulsePinCount();
    } else {
      this.thNotify.send(thPinboardCountError, 'danger');
    }
    if (!this.state.selectedJob) {
      this.selectJob(job);
    }
  }

  unPinJob(id) {
    const { pinnedJobs } = this.state;

    delete pinnedJobs[id];
    this.setState({ pinnedJobs: { ...pinnedJobs } });
  }

  pinJobs(jobsToPin) {
    const { pinnedJobs } = this.state;
    const spaceRemaining = thPinboardMaxSize - this.countPinnedJobs();
    const showError = jobsToPin.length > spaceRemaining;
    const newPinnedJobs = jobsToPin.slice(0, spaceRemaining).reduce((acc, job) => ({ ...acc, [job.id]: job }), {});

    if (!spaceRemaining) {
      this.thNotify.send(thPinboardCountError, 'danger', { sticky: true });
      this.$rootScope.$apply();
      return;
    }

    this.setState({
      pinnedJobs: { ...pinnedJobs, ...newPinnedJobs },
      isPinBoardVisible: true,
    }, () => {
      if (!this.props.selectedJob) {
        this.$rootScope.$emit(thEvents.jobClick, jobsToPin[0]);
      }
      if (showError) {
        this.thNotify.send(thPinboardCountError, 'danger', { sticky: true });
        this.$rootScope.$apply();
      }
    });
  }

  countPinnedJobs() {
    return Object.keys(this.state.pinnedJobs).length;
  }

  addBug(bug, job) {
    const { pinnedJobBugs } = this.state;

    pinnedJobBugs[bug.id] = bug;
    this.setState({ pinnedJobBugs: { ...pinnedJobBugs } });
    if (job) {
        this.pinJob(job);
    }
  }

  removeBug(id) {
    const { pinnedJobBugs } = this.state;

    delete pinnedJobBugs[id];
    this.setState({ pinnedJobBugs: { ...pinnedJobBugs } });
  }

  unPinAll() {
    this.setState({
      pinnedJobs: {},
      pinnedJobBugs: {},
    });
  }

  render() {
    const {
      repoName, $injector, user, currentRepo,
    } = this.props;
    const {
      job, isPinBoardVisible, jobDetails, jobRevision, jobLogUrls, jobDetailLoading,
      perfJobDetail, suggestions, errors, bugSuggestionsLoading, logParseStatus,
      classifications, logViewerUrl, logViewerFullUrl, pinnedJobs, pinnedJobBugs, bugs, reftestUrl,
    } = this.state;

    return (
      <div className={job ? 'details-panel-slide' : 'hidden'}>
        <div
          id="details-panel-resizer"
          resizer="horizontal"
          resizer-height="6"
          resizer-bottom="#details-panel"
        />
        <PinBoard
          isVisible={isPinBoardVisible}
          selectedJob={job}
          isLoggedIn={user.isLoggedIn || false}
          classificationTypes={this.thClassificationTypes}
          revisionList={this.getRevisionTips()}
          pinnedJobs={pinnedJobs}
          pinnedJobBugs={pinnedJobBugs}
          addBug={this.addBug}
          removeBug={this.removeBug}
          pinJob={this.pinJob}
          unPinJob={this.unPinJob}
          unPinAll={this.unPinAll}
          $injector={$injector}
        />
        {!!job && <div id="details-panel">
          <SummaryPanel
            repoName={repoName}
            selectedJob={job}
            jobLogUrls={jobLogUrls}
            logParseStatus={logParseStatus}
            jobDetailLoading={jobDetailLoading}
            latestClassification={classifications.length ? classifications[0] : null}
            isTryRepo={currentRepo.isTryRepo}
            logViewerUrl={logViewerUrl}
            logViewerFullUrl={logViewerFullUrl}
            pinJob={this.pinJob}
            bugs={bugs}
            user={user}
            $injector={$injector}
          />
          <span className="job-tabs-divider" />
          <TabsPanel
            jobDetails={jobDetails}
            perfJobDetail={perfJobDetail}
            selectedJob={job}
            repoName={repoName}
            jobRevision={jobRevision}
            suggestions={suggestions}
            errors={errors}
            bugSuggestionsLoading={bugSuggestionsLoading}
            logParseStatus={logParseStatus}
            classifications={classifications}
            classificationTypes={this.thClassificationTypes}
            jobLogUrls={jobLogUrls}
            isPinBoardVisible={isPinBoardVisible}
            pinnedJobs={pinnedJobs}
            bugs={bugs}
            addBug={this.addBug}
            pinJob={this.pinJob}
            togglePinBoardVisibility={() => this.togglePinBoardVisibility()}
            logViewerFullUrl={logViewerFullUrl}
            reftestUrl={reftestUrl}
            user={user}
            $injector={$injector}
          />
        </div>}
        <div id="clipboard-container"><textarea id="clipboard" /></div>
      </div>
    );
  }
}

DetailsPanel.propTypes = {
  $injector: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  selectedJob: PropTypes.object,
  user: PropTypes.object,
  currentRepo: PropTypes.object,
};

DetailsPanel.defaultProps = {
  selectedJob: null,
  user: { isLoggedIn: false, isStaff: false, email: null },
  currentRepo: { isTryRepo: true },
};

treeherder.component('detailsPanel', react2angular(
  DetailsPanel,
  ['repoName', 'selectedJob', 'user'],
  ['$injector']));
