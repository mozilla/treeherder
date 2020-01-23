import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import sortBy from 'lodash/sortBy';

import {
  thEvents,
  thOptionOrder,
  thPlatformMap,
} from '../../helpers/constants';
import { getGroupMapKey } from '../../helpers/aggregateId';
import { getAllUrlParams, getUrlParam } from '../../helpers/location';
import JobModel from '../../models/job';
import RunnableJobModel from '../../models/runnableJob';
import { getRevisionTitle } from '../../helpers/revision';
import { getPercentComplete } from '../../helpers/display';
import { notify } from '../redux/stores/notifications';
import {
  updateJobMap,
  recalculateUnclassifiedCounts,
} from '../redux/stores/pushes';

import FuzzyJobFinder from './FuzzyJobFinder';
import { Revision } from './Revision';
import PushHeader from './PushHeader';
import PushJobs from './PushJobs';
import { RevisionList } from './RevisionList';

const watchCycleStates = ['none', 'push', 'job', 'none'];
const platformArray = Object.values(thPlatformMap);

const fetchTestManifests = async (project, revision) => {
  let taskNameToManifests = {};
  const rootUrl = 'https://firefox-ci-tc.services.mozilla.com';
  const url = `${rootUrl}/api/index/v1/task/gecko.v2.${project}.revision.${revision}.taskgraph.decision/artifacts/public/manifests-by-task.json`;
  const response = await fetch(url);
  if ([200, 304].indexOf(response.status)) {
    taskNameToManifests = await response.json();
  }
  return taskNameToManifests;
};

class Push extends React.PureComponent {
  constructor(props) {
    super(props);

    const { push } = props;
    const collapsedPushes = getUrlParam('collapsedPushes') || '';

    this.state = {
      fuzzyModal: false,
      platforms: [],
      jobList: [],
      runnableVisible: false,
      selectedRunnableJobs: [],
      watched: 'none',
      jobCounts: { pending: 0, running: 0, completed: 0, fixedByCommit: 0 },
      pushGroupState: 'collapsed',
      collapsed: collapsedPushes.includes(push.id),
    };
  }

  async componentDidMount() {
    // if ``nojobs`` is on the query string, then don't load jobs.
    // this allows someone to more quickly load ranges of revisions
    // when they don't care about the specific jobs and results.
    if (!getAllUrlParams().has('nojobs')) {
      await Promise.all([this.fetchJobs(), this.fetchTestManifests()]);
    }

    window.addEventListener(thEvents.applyNewJobs, this.handleApplyNewJobs);
    window.addEventListener('hashchange', this.handleUrlChanges);
  }

  componentDidUpdate(prevProps, prevState) {
    this.showUpdateNotifications(prevState);
  }

  componentWillUnmount() {
    window.removeEventListener(thEvents.applyNewJobs, this.handleApplyNewJobs);
    window.removeEventListener('hashchange', this.handleUrlChanges);
  }

  getJobCount(jobList) {
    const filteredByCommit = jobList.filter(
      job => job.failure_classification_id === 2,
    );

    return jobList.reduce(
      (memo, job) =>
        job.result !== 'superseded'
          ? { ...memo, [job.state]: memo[job.state] + 1 }
          : memo,
      {
        running: 0,
        pending: 0,
        completed: 0,
        fixedByCommit: filteredByCommit.length,
      },
    );
  }

  getJobGroupInfo(job) {
    const {
      job_group_name: name,
      job_group_symbol: jobGroupSymbol,
      platform,
      platform_option: platformOption,
      tier,
      push_id: pushId,
    } = job;
    const symbol = jobGroupSymbol === '?' ? '' : jobGroupSymbol;
    const mapKey = getGroupMapKey(
      pushId,
      symbol,
      tier,
      platform,
      platformOption,
    );

    return { name, tier, symbol, mapKey };
  }

  setSingleRevisionWindowTitle() {
    const { allUnclassifiedFailureCount, currentRepo, push } = this.props;
    const percentComplete = getPercentComplete(this.state.jobCounts);
    const title = `[${allUnclassifiedFailureCount}] ${currentRepo.name}`;

    document.title = `${percentComplete}% - ${title}: ${getRevisionTitle(
      push.revisions,
    )}`;
  }

  handleUrlChanges = () => {
    const { push } = this.props;
    const collapsedPushes = getUrlParam('collapsedPushes') || '';

    this.setState({ collapsed: collapsedPushes.includes(push.id) });
  };

  handleApplyNewJobs = event => {
    const { push } = this.props;
    const { jobs } = event.detail;
    const jobList = jobs[push.id];

    if (jobList) {
      this.mapPushJobs(jobList);
    }
  };

  toggleSelectedRunnableJob = signature => {
    const { selectedRunnableJobs } = this.state;
    const jobIndex = selectedRunnableJobs.indexOf(signature);

    if (jobIndex === -1) {
      selectedRunnableJobs.push(signature);
    } else {
      selectedRunnableJobs.splice(jobIndex, 1);
    }
    this.setState({ selectedRunnableJobs: [...selectedRunnableJobs] });
    return selectedRunnableJobs;
  };

  fetchTestManifests = async () => {
    const { push } = this.props;
    const { repository, revision } = push;
    const jobTypeNameToManifests = await fetchTestManifests(
      repository,
      revision,
    );
    this.setState({ jobTypeNameToManifests });
  };

  fetchJobs = async () => {
    const { push, notify } = this.props;
    const { data, failureStatus } = await JobModel.getList(
      {
        push_id: push.id,
      },
      { fetchAll: true },
    );

    if (!failureStatus) {
      this.mapPushJobs(data);
    } else {
      notify(failureStatus, 'danger', { sticky: true });
    }
  };

  mapPushJobs = (jobs, skipJobMap) => {
    const { updateJobMap, recalculateUnclassifiedCounts, push } = this.props;
    const { jobTypeNameToManifests = {} } = this.state;

    // whether or not we got any jobs for this push, the operation to fetch
    // them has completed.
    push.jobsLoaded = true;
    if (jobs.length > 0) {
      const { jobList } = this.state;
      const newIds = jobs.map(job => job.id);
      // remove old versions of jobs we just fetched.
      const existingJobs = jobList.filter(job => !newIds.includes(job.id));
      // Join both lists and add test_paths property
      const newJobList = [...existingJobs, ...jobs].map(job => {
        job.test_paths = jobTypeNameToManifests[job.job_type_name] || [];
        return job;
      });
      const platforms = this.sortGroupedJobs(
        this.groupJobByPlatform(newJobList),
      );
      const jobCounts = this.getJobCount(newJobList);

      this.setState({
        platforms,
        jobList: newJobList,
        jobCounts,
      });
      if (!skipJobMap) {
        updateJobMap(jobs);
      }
      recalculateUnclassifiedCounts();
    }
  };

  /*
   * Convert a flat list of jobs into a structure grouped by platform and job_group.
   */
  groupJobByPlatform = jobList => {
    const platforms = [];

    if (jobList.length === 0) {
      return platforms;
    }
    jobList.forEach(job => {
      // search for the right platform
      const platformName = thPlatformMap[job.platform] || job.platform;
      let platform = platforms.find(
        platform =>
          platformName === platform.name &&
          job.platform_option === platform.option,
      );
      if (platform === undefined) {
        platform = {
          name: platformName,
          option: job.platform_option,
          groups: [],
        };
        platforms.push(platform);
      }

      const groupInfo = this.getJobGroupInfo(job);
      // search for the right group
      let group = platform.groups.find(
        group =>
          groupInfo.symbol === group.symbol && groupInfo.tier === group.tier,
      );
      if (group === undefined) {
        group = { ...groupInfo, jobs: [] };
        platform.groups.push(group);
      }
      group.jobs.push(job);
    });
    return platforms;
  };

  sortGroupedJobs = platforms => {
    platforms.forEach(platform => {
      platform.groups.forEach(group => {
        group.jobs = sortBy(group.jobs, job =>
          // Symbol could be something like 1, 2 or 3. Or A, B, C or R1, R2, R10.
          // So this will pad the numeric portion with 0s like R001, R010, etc.
          job.job_type_symbol.replace(/([\D]*)([\d]*)/g, (matcher, s1, s2) =>
            s2 !== '' ? s1 + `00${s2}`.slice(-3) : matcher,
          ),
        );
      });
      platform.groups.sort(
        (a, b) => a.symbol.length + a.tier - b.symbol.length - b.tier,
      );
    });
    platforms.sort(
      (a, b) =>
        platformArray.indexOf(a.name) * 100 +
        (thOptionOrder[a.option] || 10) -
        (platformArray.indexOf(b.name) * 100 + (thOptionOrder[b.option] || 10)),
    );
    return platforms;
  };

  expandAllPushGroups = callback => {
    // This sets the group state once, then unsets it in the callback.  This
    // has the result of triggering an expand on all the groups, but then
    // gives control back to each group to decide to expand or not.
    this.setState({ pushGroupState: 'expanded' }, () => {
      this.setState({ pushGroupState: 'collapsed' });
      callback();
    });
  };

  showUpdateNotifications = prevState => {
    const { watched, jobCounts } = this.state;
    const {
      currentRepo,
      notificationSupported,
      push: { revision, id: pushId },
      notify,
    } = this.props;

    if (
      !notificationSupported ||
      Notification.permission !== 'granted' ||
      watched === 'none'
    ) {
      return;
    }

    const lastCounts = prevState.jobCounts;
    if (jobCounts) {
      const lastUncompleted = lastCounts.pending + lastCounts.running;
      const nextUncompleted = jobCounts.pending + jobCounts.running;

      const lastCompleted = lastCounts.completed;
      const nextCompleted = jobCounts.completed;

      let message;
      if (lastUncompleted > 0 && nextUncompleted === 0) {
        message = 'Push completed';
        this.setState({ watched: 'none' });
      } else if (watched === 'job' && lastCompleted < nextCompleted) {
        const completeCount = nextCompleted - lastCompleted;
        message = `${completeCount} jobs completed`;
      }

      if (message) {
        const notification = new Notification(message, {
          body: `${currentRepo.name} rev ${revision.substring(0, 12)}`,
          tag: pushId,
        });

        notification.onerror = event => {
          notify(`${event.target.title}: ${event.target.body}`, 'danger');
        };

        notification.onclick = event => {
          if (this.container) {
            this.container.scrollIntoView();
            event.target.close();
          }
        };
      }
    }
  };

  showRunnableJobs = async () => {
    const { push, notify, decisionTaskMap, currentRepo } = this.props;

    try {
      const jobList = await RunnableJobModel.getList(currentRepo, {
        decisionTask: decisionTaskMap[push.id],
        push_id: push.id,
      });

      if (jobList.length === 0) {
        notify('No new jobs available');
      }
      this.mapPushJobs(jobList, true);
      this.setState({ runnableVisible: jobList.length > 0 });
    } catch (error) {
      notify(
        `Error fetching runnable jobs: Failed to fetch task ID (${error})`,
        'danger',
      );
    }
  };

  hideRunnableJobs = () => {
    const { jobList } = this.state;
    const newJobList = jobList.filter(job => job.state !== 'runnable');

    this.setState(
      {
        runnableVisible: false,
        selectedRunnableJobs: [],
        jobList: newJobList,
      },
      () => this.mapPushJobs(newJobList),
    );
  };

  showFuzzyJobs = async () => {
    const { push, currentRepo, notify, decisionTaskMap } = this.props;
    const createRegExp = (str, opts) =>
      new RegExp(str.raw[0].replace(/\s/gm, ''), opts || '');
    const excludedJobNames = createRegExp`
      (balrog|beetmover|bouncer-locations-firefox|build-docker-image|build-(.+)-nightly|
      build-(.+)-upload-symbols|checksums|cron-bouncer|dmd|fetch|google-play-strings|
      push-to-release|mar-signing|nightly|packages|release-bouncer|release-early|
      release-final|release-secondary|release-snap|release-source|release-update|
      repackage-l10n|repo-update|searchfox|sign-and-push|test-(.+)-devedition|
      test-linux(32|64)(-asan|-pgo|-qr)?\/(opt|debug)-jittest|test-macosx64-ccov|
      test-verify|test-windows10-64-ux|toolchain|upload-generated-sources)`;

    try {
      notify('Fetching runnable jobs... This could take a while...');
      let fuzzyJobList = await RunnableJobModel.getList(currentRepo, {
        decisionTask: decisionTaskMap[push.id],
      });
      fuzzyJobList = [
        ...new Set(
          fuzzyJobList.map(job => {
            const obj = {};
            obj.name = job.job_type_name;
            obj.symbol = job.job_type_symbol;
            obj.groupsymbol = job.job_group_symbol;
            return obj;
          }),
        ),
      ].sort((a, b) => (a.name > b.name ? 1 : -1));
      const filteredFuzzyList = fuzzyJobList.filter(
        job => job.name.search(excludedJobNames) < 0,
      );
      this.setState({
        fuzzyJobList,
        filteredFuzzyList,
      });
      this.toggleFuzzyModal();
    } catch (error) {
      notify(
        `Error fetching runnable jobs: Failed to fetch task ID (${error})`,
        'danger',
      );
    }
  };

  cycleWatchState = async () => {
    const { notify } = this.props;
    const { watched } = this.state;

    if (!this.props.notificationSupported) {
      return;
    }

    let next = watchCycleStates[watchCycleStates.indexOf(watched) + 1];

    if (next !== 'none' && Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();

      if (result === 'denied') {
        notify('Notification permission denied', 'danger');

        next = 'none';
      }
    }
    this.setState({ watched: next });
  };

  toggleFuzzyModal = async () => {
    this.setState(prevState => ({
      fuzzyModal: !prevState.fuzzyModal,
      jobList: prevState.jobList,
    }));
  };

  render() {
    const {
      push,
      isLoggedIn,
      currentRepo,
      duplicateJobsVisible,
      filterModel,
      notificationSupported,
      getAllShownJobs,
      groupCountsExpanded,
      isOnlyRevision,
      pushHealthVisibility,
      decisionTaskMap,
    } = this.props;
    const {
      fuzzyJobList,
      fuzzyModal,
      filteredFuzzyList,
      watched,
      runnableVisible,
      pushGroupState,
      platforms,
      jobCounts,
      selectedRunnableJobs,
      collapsed,
    } = this.state;
    const { id, push_timestamp: pushTimestamp, revision, author } = push;
    const tipRevision = push.revisions[0];
    const decisionTask = decisionTaskMap[push.id];
    const decisionTaskId = decisionTask ? decisionTask.id : null;

    if (isOnlyRevision) {
      this.setSingleRevisionWindowTitle();
    }

    return (
      <div
        className="push"
        data-testid={`push-${push.id}`}
        ref={ref => {
          this.container = ref;
        }}
      >
        <FuzzyJobFinder
          isOpen={fuzzyModal}
          toggle={this.toggleFuzzyModal}
          jobList={fuzzyJobList}
          filteredJobList={filteredFuzzyList}
          className="fuzzy-modal"
          pushId={id}
          decisionTaskId={decisionTaskId}
          currentRepo={currentRepo}
        />
        <PushHeader
          push={push}
          pushId={id}
          pushTimestamp={pushTimestamp}
          author={author}
          revision={revision}
          jobCounts={jobCounts}
          watchState={watched}
          isLoggedIn={isLoggedIn}
          currentRepo={currentRepo}
          filterModel={filterModel}
          runnableVisible={runnableVisible}
          showRunnableJobs={this.showRunnableJobs}
          hideRunnableJobs={this.hideRunnableJobs}
          showFuzzyJobs={this.showFuzzyJobs}
          cycleWatchState={this.cycleWatchState}
          expandAllPushGroups={this.expandAllPushGroups}
          collapsed={collapsed}
          getAllShownJobs={getAllShownJobs}
          selectedRunnableJobs={selectedRunnableJobs}
          notificationSupported={notificationSupported}
          pushHealthVisibility={pushHealthVisibility}
          groupCountsExpanded={groupCountsExpanded}
        />
        <div className="push-body-divider" />
        {!collapsed ? (
          <div className="row push clearfix">
            {currentRepo && <RevisionList push={push} repo={currentRepo} />}
            <span className="job-list job-list-pad col-7">
              <PushJobs
                push={push}
                platforms={platforms}
                repoName={currentRepo.name}
                filterModel={filterModel}
                pushGroupState={pushGroupState}
                toggleSelectedRunnableJob={this.toggleSelectedRunnableJob}
                runnableVisible={runnableVisible}
                duplicateJobsVisible={duplicateJobsVisible}
                groupCountsExpanded={groupCountsExpanded}
              />
            </span>
          </div>
        ) : (
          <span className="row push revision-list col-12">
            <ul className="list-unstyled">
              <Revision
                revision={tipRevision}
                repo={currentRepo}
                key={tipRevision.revision}
              />
            </ul>
          </span>
        )}
      </div>
    );
  }
}

Push.propTypes = {
  push: PropTypes.object.isRequired,
  currentRepo: PropTypes.object.isRequired,
  filterModel: PropTypes.object.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  notificationSupported: PropTypes.bool.isRequired,
  getAllShownJobs: PropTypes.func.isRequired,
  updateJobMap: PropTypes.func.isRequired,
  recalculateUnclassifiedCounts: PropTypes.func.isRequired,
  allUnclassifiedFailureCount: PropTypes.number.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
  notify: PropTypes.func.isRequired,
  isOnlyRevision: PropTypes.bool.isRequired,
  pushHealthVisibility: PropTypes.string.isRequired,
  decisionTaskMap: PropTypes.object.isRequired,
};

const mapStateToProps = ({
  pushes: { allUnclassifiedFailureCount, decisionTaskMap },
}) => ({
  allUnclassifiedFailureCount,
  decisionTaskMap,
});

export default connect(mapStateToProps, {
  notify,
  updateJobMap,
  recalculateUnclassifiedCounts,
})(Push);
