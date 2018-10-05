import React from 'react';
import PropTypes from 'prop-types';
import sortBy from 'lodash/sortBy';
import max from 'lodash/max';
import flowRight from 'lodash/flowRight';

import PushJobs from './PushJobs';
import PushHeader from './PushHeader';
import { RevisionList } from './RevisionList';
import { thOptionOrder, thPlatformMap } from '../../helpers/constants';
import { withPushes } from '../context/Pushes';
import { escapeId, getGroupMapKey } from '../../helpers/aggregateId';
import { getAllUrlParams } from '../../helpers/location';
import PushModel from '../../models/push';
import RunnableJobModel from '../../models/runnableJob';
import { withSelectedJob } from '../context/SelectedJob';

const watchCycleStates = ['none', 'push', 'job', 'none'];
const platformArray = Object.values(thPlatformMap);
const jobPollInterval = 60000;

class Push extends React.Component {
  constructor(props) {
    super(props);
    const { $injector } = props;

    this.thNotify = $injector.get('thNotify');

    this.state = {
      platforms: [],
      jobList: [],
      runnableVisible: false,
      selectedRunnableJobs: [],
      watched: 'none',
      jobCounts: { pending: 0, running: 0, completed: 0 },
      hasBoundaryError: false,
      boundaryError: '',
      pushGroupState: 'collapsed',
    };
  }

  componentDidMount() {
    this.showRunnableJobs = this.showRunnableJobs.bind(this);
    this.hideRunnableJobs = this.hideRunnableJobs.bind(this);
    this.toggleSelectedRunnableJob = this.toggleSelectedRunnableJob.bind(this);
    this.expandAllPushGroups = this.expandAllPushGroups.bind(this);
    this.fetchJobs = this.fetchJobs.bind(this);
    this.groupJobByPlatform = this.groupJobByPlatform.bind(this);
    this.sortGroupedJobs = this.sortGroupedJobs.bind(this);
    this.mapPushJobs = this.mapPushJobs.bind(this);
    this.poll = this.poll.bind(this);
    this.getLastModifiedJobTime = this.getLastModifiedJobTime.bind(this);

    this.fetchJobs();
    this.poll();
  }

  componentDidUpdate(prevProps, prevState) {
    this.showUpdateNotifications(prevState);
  }

  componentWillUnmount() {
    if (this.pollIntervalId) {
      clearTimeout(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  getJobCount(jobList) {
    return jobList.reduce((memo, job) => (
      job.result !== 'superseded' ? { ...memo, [job.state]: memo[job.state] + 1 } : memo
      ), { running: 0, pending: 0, completed: 0 },
    );
  }

  getJobGroupInfo(job) {
    const {
      job_group_name: name, job_group_symbol,
      platform, platform_option, tier,
    } = job;
    const symbol = job_group_symbol === '?' ? '' : job_group_symbol;
    const mapKey = getGroupMapKey(
      symbol, tier, platform, platform_option);

    return { name, tier, symbol, mapKey };
  }

  getLastModifiedJobTime() {
    const { jobList } = this.state;
    const latest = max(jobList.map(job => new Date(job.last_modified + 'Z'))) || new Date();

    latest.setSeconds(latest.getSeconds() - 3);
    return latest;
  }

  componentDidCatch(error) {
    this.setState({
      hasBoundaryError: true,
      boundaryError: error,
    });
  }

  poll() {
    this.pollIntervalId = setInterval(async () => {
      const { push } = this.props;
      const lastModified = this.getLastModifiedJobTime();
      const jobs = await PushModel.getJobs(push.id, { lastModified });

      this.mapPushJobs(jobs);
    }, jobPollInterval);
  }

  toggleSelectedRunnableJob(buildername) {
    const { selectedRunnableJobs } = this.state;
    const jobIndex = selectedRunnableJobs.indexOf(buildername);

    if (jobIndex === -1) {
      selectedRunnableJobs.push(buildername);
    } else {
      selectedRunnableJobs.splice(jobIndex, 1);
    }
    this.setState({ selectedRunnableJobs: [...selectedRunnableJobs] });
    return selectedRunnableJobs;
  }

  async fetchJobs() {
    const { push } = this.props;

    // if ``nojobs`` is on the query string, then don't load jobs.
    // this allows someone to more quickly load ranges of revisions
    // when they don't care about the specific jobs and results.
    if (getAllUrlParams().has('nojobs')) {
      return;
    }
    const jobs = await PushModel.getJobs(push.id);

    this.mapPushJobs(jobs);
  }

  mapPushJobs(jobs, skipJobMap) {
    if (jobs.length > 0) {
      const { updateJobMap, recalculateUnclassifiedCounts, push } = this.props;
      const { jobList } = this.state;
      const newIds = jobs.map(job => job.id);
      // remove old versions of jobs we just fetched.
      const existingJobs = jobList.filter(job => !newIds.includes(job.id));
      const newJobList = [...existingJobs, ...jobs];
      const sortAndGroupJobs = flowRight(
        this.sortGroupedJobs,
        this.groupJobByPlatform,
      );
      const platforms = sortAndGroupJobs(newJobList);
      const jobCounts = this.getJobCount(newJobList);

      // Remove next line when fixing Bug 1450042.  Needed for Angular.
      push.jobCounts = jobCounts;

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
  }

  /*
   * Convert a flat list of jobs into a structure grouped by platform and job_group.
   */
  groupJobByPlatform(jobList) {
    const platforms = [];

    if (jobList.length === 0) {
      return platforms;
    }
    jobList.forEach((job) => {
      // search for the right platform
      const platformName = thPlatformMap[job.platform] || job.platform;
      let platform = platforms.find(platform =>
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
      let group = platform.groups.find(group =>
        groupInfo.symbol === group.symbol &&
        groupInfo.tier === group.tier,
      );
      if (group === undefined) {
        group = { ...groupInfo, jobs: [] };
        platform.groups.push(group);
      }
      group.jobs.push(job);
    });
    return platforms;
  }

  sortGroupedJobs(platforms) {
    platforms.forEach((platform) => {
      platform.groups.forEach((group) => {
        group.jobs = sortBy(group.jobs, job => (
          // Symbol could be something like 1, 2 or 3. Or A, B, C or R1, R2, R10.
          // So this will pad the numeric portion with 0s like R001, R010, etc.
          job.job_type_symbol.replace(/([\D]*)([\d]*)/g,
            (matcher, s1, s2) => (s2 !== '' ? s1 + `00${s2}`.slice(-3) : matcher))
        ));
      });
      platform.groups.sort((a, b) => a.symbol.length + a.tier - b.symbol.length - b.tier);
    });
    platforms.sort((a, b) => (
      (platformArray.indexOf(a.name) * 100 + thOptionOrder[a.option]) -
      (platformArray.indexOf(b.name) * 100 + thOptionOrder[b.option])
    ));
    return platforms;
  }

  expandAllPushGroups(callback) {
    // This sets the group state once, then unsets it in the callback.  This
    // has the result of triggering an expand on all the groups, but then
    // gives control back to each group to decide to expand or not.
    this.setState({ pushGroupState: 'expanded' }, () => {
      this.setState({ pushGroupState: 'collapsed' });
      callback();
    });
  }

  showUpdateNotifications(prevState) {
    const { watched, jobCounts } = this.state;
    const {
      repoName, notificationSupported, push: { revision, id: pushId },
    } = this.props;

    if (!notificationSupported || Notification.permission !== 'granted' || watched === 'none') {
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
        message = completeCount + ' jobs completed';
      }

      if (message) {
        const notification = new Notification(message, {
          body: `${repoName} rev ${revision.substring(0, 12)}`,
          tag: pushId,
        });

        notification.onerror = (event) => {
          this.thNotify.send(`${event.target.title}: ${event.target.body}`, 'danger');
        };

        notification.onclick = (event) => {
          if (this.container) {
            this.container.scrollIntoView();
            event.target.close();
          }
        };
      }
    }
  }

  async showRunnableJobs() {
    const { push, repoName, getGeckoDecisionTaskId } = this.props;

    try {
      const decisionTaskId = await getGeckoDecisionTaskId(push.id, repoName);
      const jobList = await RunnableJobModel.getList(repoName, { decision_task_id: decisionTaskId });
      const id = push.id;

      jobList.forEach((job) => {
        job.push_id = id;
        job.id = escapeId(job.push_id + job.ref_data_name);
      });
      if (jobList.length === 0) {
        this.thNotify.send('No new jobs available');
      }
      this.mapPushJobs(jobList, true);
      this.setState({ runnableVisible: jobList.length > 0 });
    } catch (error) {
      this.thNotify.send(`Error fetching runnable jobs: Failed to fetch task ID (${error})`, 'danger');
    }
  }

  hideRunnableJobs() {
    const { jobList } = this.state;
    const newJobList = jobList.filter(job => job.state !== 'runnable');

    this.setState({
      runnableVisible: false,
      selectedRunnableJobs: [],
      jobList: newJobList,
    }, () => this.mapPushJobs(newJobList));
  }

  async cycleWatchState() {
    if (!this.props.notificationSupported) {
      return;
    }

    let next = watchCycleStates[watchCycleStates.indexOf(this.state.watched) + 1];

    if (next !== 'none' && Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();

      if (result === 'denied') {
        this.thNotify.send('Notification permission denied', 'danger');

        next = 'none';
      }
    }
    this.setState({ watched: next });
  }

  render() {
    const {
      push, isLoggedIn, $injector, repoName, currentRepo,
      filterModel, notificationSupported, getAllShownJobs,
    } = this.props;
    const {
      watched, runnableVisible, hasBoundaryError, boundaryError, pushGroupState,
      platforms, jobCounts, selectedRunnableJobs,
    } = this.state;
    const { id, push_timestamp, revision, author } = push;

    if (hasBoundaryError) {
      return (
        <div className="border-bottom border-top ml-1">
          <div>Error displaying push with revision: {revision}</div>
          <div>{boundaryError.toString()}</div>
        </div>
      );
    }

    return (
      <div className="push" ref={(ref) => { this.container = ref; }} data-job-clear-on-click>
        <PushHeader
          push={push}
          pushId={id}
          pushTimestamp={push_timestamp}
          author={author}
          revision={revision}
          jobCounts={jobCounts}
          watchState={watched}
          isLoggedIn={isLoggedIn}
          repoName={repoName}
          filterModel={filterModel}
          $injector={$injector}
          runnableVisible={runnableVisible}
          showRunnableJobs={this.showRunnableJobs}
          hideRunnableJobs={this.hideRunnableJobs}
          cycleWatchState={() => this.cycleWatchState()}
          expandAllPushGroups={this.expandAllPushGroups}
          getAllShownJobs={getAllShownJobs}
          selectedRunnableJobs={selectedRunnableJobs}
          notificationSupported={notificationSupported}
        />
        <div className="push-body-divider" />
        <div className="row push clearfix">
          {currentRepo &&
            <RevisionList
              push={push}
              $injector={$injector}
              repo={currentRepo}
            />
          }
          <span className="job-list job-list-pad col-7" data-job-clear-on-click>
            <PushJobs
              push={push}
              platforms={platforms}
              repoName={repoName}
              filterModel={filterModel}
              pushGroupState={pushGroupState}
              toggleSelectedRunnableJob={this.toggleSelectedRunnableJob}
              runnableVisible={runnableVisible}
              $injector={$injector}
            />
          </span>
        </div>
      </div>
    );
  }
}

Push.propTypes = {
  push: PropTypes.object.isRequired,
  currentRepo: PropTypes.object.isRequired,
  $injector: PropTypes.object.isRequired,
  filterModel: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  notificationSupported: PropTypes.bool.isRequired,
  getAllShownJobs: PropTypes.func.isRequired,
  updateJobMap: PropTypes.func.isRequired,
  recalculateUnclassifiedCounts: PropTypes.func.isRequired,
  getGeckoDecisionTaskId: PropTypes.func.isRequired,
};

export default withPushes(withSelectedJob(Push));
