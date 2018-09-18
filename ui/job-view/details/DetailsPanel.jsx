import React from 'react';
import PropTypes from 'prop-types';
import { chunk } from 'lodash';

import { thEvents, thBugSuggestionLimit } from '../../js/constants';
import { withPinnedJobs } from '../context/PinnedJobs';
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
import { setUrlParam } from '../../helpers/location';

export const pinboardHeight = 100;

class DetailsPanel extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;

    this.PhSeries = $injector.get('PhSeries');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.$rootScope = $injector.get('$rootScope');

    // used to cancel all the ajax requests triggered by selectJob
    this.selectJobController = null;

    this.state = {
      job: null,
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
    };
  }

  static getDerivedStateFromProps(props) {
    if (!props.selectedJob) {
      return { job: null };
    }
    return {};
  }

  componentDidMount() {
    this.closeJob = this.closeJob.bind(this);

    this.jobClickUnlisten = this.$rootScope.$on(thEvents.jobClick, (evt, job) => {
      this.setState({
        jobDetailLoading: true,
        jobDetails: [],
        suggestions: [],
      }, () => this.selectJob(job));
    });

    this.clearSelectedJobUnlisten = this.$rootScope.$on(thEvents.clearSelectedJob, () => {
      if (this.selectJobController !== null) {
        this.selectJobController.abort();
      }
      if (!Object.keys(this.props.pinnedJobs).length) {
        this.closeJob();
      }
    });

    this.jobsClassifiedUnlisten = this.$rootScope.$on(thEvents.jobsClassified, () => {
      this.updateClassifications(this.props.selectedJob);
    });
  }

  componentWillUnmount() {
    this.jobClickUnlisten();
    this.clearSelectedJobUnlisten();
    this.jobsClassifiedUnlisten();
  }

  getRevisionTips() {
    return this.ThResultSetStore.getPushArray().map(push => ({
      revision: push.revision,
      author: push.author,
      title: push.revisions[0].comments.split('\n')[0],
    }));
  }

  togglePinBoardVisibility() {
    const { setPinBoardVisible, isPinBoardVisible } = this.props;

    setPinBoardVisible(!isPinBoardVisible);
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
                        logViewerUrl: getLogViewerUrl(job.id, repoName, step.finished_line_number),
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
      phSeriesPromise,
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
      const reftestUrl = jobLogUrls.length ? getReftestUrl(jobLogUrls[0].url) : '';
      const performanceData = Object.values(results[3]).reduce((a, b) => [...a, ...b], []);

      let perfJobDetail = [];
      if (performanceData) {
        const signatureIds = [...new Set(performanceData.map(perf => perf.signature_id))];
        const seriesListList = await Promise.all(chunk(signatureIds, 20).map(
          signatureIdChunk => this.PhSeries.getSeriesList(repoName, { id: signatureIdChunk }),
        ));
        const seriesList = seriesListList.reduce((a, b) => [...a, ...b], []);

        perfJobDetail = performanceData.map(d => ({
          series: seriesList.find(s => d.signature_id === s.id),
          ...d,
        })).filter(d => !d.series.parentSignature).map(d => ({
          url: `/perf.html#/graphs?series=${[repoName, d.signature_id, 1, d.series.frameworkId]}&selected=${[repoName, d.signature_id, job.result_set_id, d.id]}`,
          value: d.value,
          title: d.series.name,
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
    setUrlParam('selectedJob', null);
    if (this.selectJobController) {
      this.selectJobController.abort();
    }

    this.setState({ isPinboardVisible: false });
  }

  render() {
    const {
      repoName, $injector, user, currentRepo, resizedHeight, classificationMap,
      classificationTypes, isPinBoardVisible,
    } = this.props;
    const {
      job, jobDetails, jobRevision, jobLogUrls, jobDetailLoading,
      perfJobDetail, suggestions, errors, bugSuggestionsLoading, logParseStatus,
      classifications, logViewerUrl, logViewerFullUrl, bugs, reftestUrl,
    } = this.state;
    const detailsPanelHeight = isPinBoardVisible ? resizedHeight - pinboardHeight : resizedHeight;

    return (
      <div
        id="details-panel"
        style={{ height: `${detailsPanelHeight}px` }}
        className={job ? 'details-panel-slide' : 'hidden'}
      >
        <PinBoard
          selectedJob={job}
          isLoggedIn={user.isLoggedIn || false}
          classificationTypes={classificationTypes}
          revisionList={this.getRevisionTips()}
          $injector={$injector}
        />
        {!!job && <div id="details-panel-content">
          <SummaryPanel
            repoName={repoName}
            currentRepo={currentRepo}
            selectedJob={job}
            classificationMap={classificationMap}
            jobLogUrls={jobLogUrls}
            logParseStatus={logParseStatus}
            jobDetailLoading={jobDetailLoading}
            latestClassification={classifications.length ? classifications[0] : null}
            logViewerUrl={logViewerUrl}
            logViewerFullUrl={logViewerFullUrl}
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
            classificationMap={classificationMap}
            jobLogUrls={jobLogUrls}
            bugs={bugs}
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
  currentRepo: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  resizedHeight: PropTypes.number.isRequired,
  classificationTypes: PropTypes.array.isRequired,
  classificationMap: PropTypes.object.isRequired,
  setPinBoardVisible: PropTypes.func.isRequired,
  isPinBoardVisible: PropTypes.bool.isRequired,
  pinnedJobs: PropTypes.object.isRequired,
  selectedJob: PropTypes.object,
};

DetailsPanel.defaultProps = {
  selectedJob: null,
};

export default withPinnedJobs(DetailsPanel);
