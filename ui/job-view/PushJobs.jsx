import React from 'react';
import PropTypes from 'prop-types';
import * as _ from 'lodash';
import { platformMap } from '../js/constants';
import * as aggregateIds from './aggregateIds';
import Platform from './Platform';
import { findInstance, findSelectedInstance, findJobInstance } from '../helpers/jobHelper';
import { getUrlParam } from '../helpers/locationHelper';

export default class PushJobs extends React.Component {
  constructor(props) {
    super(props);
    const { $injector, push, repoName } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.$location = $injector.get('$location');
    this.thEvents = $injector.get('thEvents');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.ThJobModel = $injector.get('ThJobModel');
    this.thUrl = $injector.get('thUrl');
    this.thJobFilters = $injector.get('thJobFilters');

    this.pushId = push.id;
    this.aggregateId = aggregateIds.getPushTableId(
      repoName,
      this.pushId,
      push.revision
    );

    this.onMouseDown = this.onMouseDown.bind(this);
    this.selectJob = this.selectJob.bind(this);

    this.state = {
      platforms: null,
      isRunnableVisible: false,
    };
  }

  componentWillMount() {
    this.applyNewJobs();
  }

  componentDidMount() {
    this.applyNewJobsUnlisten = this.$rootScope.$on(
      this.thEvents.applyNewJobs, (ev, appliedpushId) => {
        if (appliedpushId === this.pushId) {
          this.applyNewJobs();
        }
      }
    );

    this.globalFilterChangedUnlisten = this.$rootScope.$on(
      this.thEvents.globalFilterChanged, () => {
        this.filterJobs();
      }
    );

    this.groupStateChangedUnlisten = this.$rootScope.$on(
      this.thEvents.groupStateChanged, () => {
        this.filterJobs();
      }
    );

    this.jobsClassifiedUnlisten = this.$rootScope.$on(
      this.thEvents.jobsClassified, () => {
        this.filterJobs();
      }
    );

    this.searchPageUnlisten = this.$rootScope.$on(
      this.thEvents.searchPage, () => {
        this.filterJobs();
      }
    );

    this.showRunnableJobsUnlisten = this.$rootScope.$on(this.thEvents.showRunnableJobs, (ev, pushId) => {
      const { push, repoName } = this.props;

      if (push.id === pushId) {
        push.isRunnableVisible = true;
        this.setState({ isRunnableVisible: true });
        this.ThResultSetStore.addRunnableJobs(repoName, push);
      }
    });

    this.deleteRunnableJobsUnlisten = this.$rootScope.$on(this.thEvents.deleteRunnableJobs, (ev, pushId) => {
      const { push } = this.props;

      if (push.id === pushId) {
        push.isRunnableVisible = false;
        this.setState({ isRunnableVisible: false });
        this.applyNewJobs();
      }
    });
  }

  componentWillUnmount() {
    this.applyNewJobsUnlisten();
    this.globalFilterChangedUnlisten();
    this.groupStateChangedUnlisten();
    this.jobsClassifiedUnlisten();
    this.searchPageUnlisten();
    this.showRunnableJobsUnlisten();
    this.deleteRunnableJobsUnlisten();
  }

  onMouseDown(ev) {
    const jobElem = ev.target.attributes.getNamedItem('data-job-id');
    if (jobElem) {
      const jobId = jobElem.value;
      const job = this.getJobFromId(jobId);
      if (ev.button === 1) { // Middle click
        this.handleLogViewerClick(jobId);
      } else if (ev.metaKey || ev.ctrlKey) { // Pin job
        this.$rootScope.$emit(this.thEvents.jobPin, job);
      } else if (job.state === 'runnable') { // Toggle runnable
        this.handleRunnableClick(job);
      } else {
        this.selectJob(job, ev.target); // Left click
      }
    }
  }

  getIdForPlatform(platform) {
    return aggregateIds.getPlatformRowId(
      this.props.repoName,
      this.props.push.id,
      platform.name,
      platform.option
    );
  }

  getJobFromId(jobId) {
    const jobMap = this.ThResultSetStore.getJobMap(this.props.repoName);
    return jobMap[`${jobId}`].job_obj;
  }

  filterJobs() {
    if (_.isEmpty(this.state.platforms)) return;
    const platforms = Object.values(this.state.platforms).reduce((acc, platform) => ({
      ...acc, [platform.id]: this.filterPlatform(platform)
    }), {});
    this.setState({ platforms });
  }

  selectJob(job, el) {
    const selected = findSelectedInstance();
    if (selected) selected.setSelected(false);
    const jobInstance = findInstance(el);
    jobInstance.setSelected(true);
    this.$rootScope.$emit(this.thEvents.jobClick, job);
  }

  applyNewJobs() {
    const { push } = this.props;

    if (!push.platforms) {
      return;
    }

    const rsPlatforms = push.platforms;
    const platforms = rsPlatforms.reduce((acc, platform) => {
      const thisPlatform = { ...platform };
      thisPlatform.id = this.getIdForPlatform(platform);
      thisPlatform.name = platformMap[platform.name] || platform.name;
      thisPlatform.groups.forEach((group) => {
        if (group.symbol !== '?') {
          group.grkey = group.mapKey;
        }
      });
      thisPlatform.visible = true;
      return { ...acc, [thisPlatform.id]: this.filterPlatform(thisPlatform) };
    }, {});
    this.setState({ platforms });
  }

  handleLogViewerClick(jobId) {
    // Open logviewer in a new window
    this.ThJobModel.get(
      this.props.repoName,
      jobId
    ).then((data) => {
      if (data.logs.length > 0) {
        window.open(location.origin + '/' +
          this.ThJobModel.getLogViewerUrl(jobId));
      }
    });
  }

  handleRunnableClick(job) {
    this.ThResultSetStore.toggleSelectedRunnableJob(
      this.props.repoName,
      this.pushId,
      job.ref_data_name
    );
    findJobInstance(job.id, false).toggleRunnableSelected();
  }

  filterPlatform(platform) {
    platform.visible = false;
    platform.groups.forEach((group) => {
      group.visible = false;
      group.jobs.forEach((job) => {
        job.visible = this.thJobFilters.showJob(job);
        if (job.state === 'runnable') {
          job.visible = job.visible && this.props.push.isRunnableVisible;
        }
        job.selected = this.$rootScope.selectedJob ? job.id === this.$rootScope.selectedJob.id : false;
        if (job.visible) {
          platform.visible = true;
          group.visible = true;
        }
      });
    });
    return platform;
  }

  render() {
    const platforms = this.state.platforms || {};
    const { $injector, repoName } = this.props;

    return (
      <table id={this.aggregateId} className="table-hover">
        <tbody onMouseDown={this.onMouseDown}>
        {platforms ? Object.keys(platforms).map((id, i) => (
          platforms[id].visible &&
          <Platform
            platform={platforms[id]}
            repoName={repoName}
            $injector={$injector}
            key={id}
            ref={id}
            refOrder={i}
          />
        )) : <tr>
          <td><span className="fa fa-spinner fa-pulse th-spinner" /></td>
        </tr>}
        </tbody>
      </table>
    );
  }
}

PushJobs.propTypes = {
  push: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  $injector: PropTypes.object.isRequired,
};
