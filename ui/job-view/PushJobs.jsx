import _ from 'lodash';
import React from 'react';
import PropTypes from 'prop-types';

import { thPlatformMap, thSimplePlatforms, thEvents } from '../js/constants';
import { getPushTableId, getPlatformRowId } from '../helpers/aggregateId';
import Platform from './Platform';
import { findInstance, findSelectedInstance, findJobInstance } from '../helpers/job';
import { getUrlParam } from '../helpers/location';
import { getLogViewerUrl } from '../helpers/url';
import JobModel from '../models/job';

export default class PushJobs extends React.Component {
  constructor(props) {
    super(props);
    const { $injector, push, repoName } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.$location = $injector.get('$location');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.thJobFilters = $injector.get('thJobFilters');

    this.pushId = push.id;
    this.aggregateId = getPushTableId(
      repoName,
      this.pushId,
      push.revision,
    );

    this.onMouseDown = this.onMouseDown.bind(this);
    this.selectJob = this.selectJob.bind(this);
    this.filterPlatformCallback = this.filterPlatformCallback.bind(this);

    this.state = {
      platforms: {},
      isRunnableVisible: false,
    };
  }

  componentWillMount() {
    this.applyNewJobs();
  }

  componentDidMount() {
    this.applyNewJobsUnlisten = this.$rootScope.$on(
      thEvents.applyNewJobs, (ev, appliedpushId) => {
        if (appliedpushId === this.pushId) {
          this.applyNewJobs();
        }
      },
    );

    this.globalFilterChangedUnlisten = this.$rootScope.$on(
      thEvents.globalFilterChanged, () => {
        this.filterJobs();
      },
    );

    this.groupStateChangedUnlisten = this.$rootScope.$on(
      thEvents.groupStateChanged, () => {
        this.filterJobs();
      },
    );

    this.showRunnableJobsUnlisten = this.$rootScope.$on(thEvents.showRunnableJobs, (ev, pushId) => {
      const { push } = this.props;

      if (push.id === pushId) {
        push.isRunnableVisible = true;
        this.setState({ isRunnableVisible: true });
        this.ThResultSetStore.addRunnableJobs(push);
      }
    });

    this.deleteRunnableJobsUnlisten = this.$rootScope.$on(thEvents.deleteRunnableJobs, (ev, pushId) => {
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
        this.$rootScope.$emit(thEvents.toggleJobPin, job);
      } else if (job.state === 'runnable') { // Toggle runnable
        this.handleRunnableClick(job);
      } else {
        this.selectJob(job, ev.target); // Left click
      }
    }
  }

  getIdForPlatform(platform) {
    return getPlatformRowId(
      this.props.repoName,
      this.props.push.id,
      platform.name,
      platform.option,
    );
  }

  getJobFromId(jobId) {
    const jobMap = this.ThResultSetStore.getJobMap();
    return jobMap[`${jobId}`].job_obj;
  }

  filterJobs() {
    const selectedJobId = parseInt(getUrlParam('selectedJob'));

    if (_.isEmpty(this.state.platforms)) return;
    const platforms = Object.values(this.state.platforms).reduce((acc, platform) => ({
      ...acc, [platform.id]: this.filterPlatform(platform, selectedJobId),
    }), {});
    this.setState({ platforms });
  }

  selectJob(job, el) {
    const selected = findSelectedInstance();
    if (selected) selected.setSelected(false);
    const jobInstance = findInstance(el);
    jobInstance.setSelected(true);
    this.$rootScope.$emit(thEvents.jobClick, job);
  }

  applyNewJobs() {
    const { push } = this.props;
    const selectedJobId = parseInt(getUrlParam('selectedJob'));

    if (!push.platforms) {
      return;
    }

    const rsPlatforms = push.platforms;
    const platforms = rsPlatforms.reduce((acc, platform) => {
      const thisPlatform = { ...platform };
      thisPlatform.id = this.getIdForPlatform(platform);
      thisPlatform.name = thPlatformMap[platform.name] || platform.name;
      const suffix = (thSimplePlatforms.includes(platform.name) && platform.option === 'opt') ? '' : ` ${platform.option}`;
      thisPlatform.title = `${thisPlatform.name}${suffix}`;
      thisPlatform.visible = true;
      return { ...acc, [thisPlatform.id]: this.filterPlatform(thisPlatform, selectedJobId) };
    }, {});
    this.setState({ platforms });
  }

  handleLogViewerClick(jobId) {
    // Open logviewer in a new window
    const { repoName } = this.props;
    JobModel.get(
      repoName,
      jobId,
    ).then((data) => {
      if (data.logs.length > 0) {
        window.open(location.origin + '/' +
          getLogViewerUrl(jobId, repoName));
      }
    });
  }

  handleRunnableClick(job) {
    this.ThResultSetStore.toggleSelectedRunnableJob(
      this.pushId,
      job.ref_data_name,
    );
    findJobInstance(job.id, false).toggleRunnableSelected();
  }

  filterPlatform(platform, selectedJobId) {
    platform.visible = false;
    platform.groups.forEach((group) => {
      group.visible = false;
      group.jobs.forEach((job) => {
        job.visible = this.thJobFilters.showJob(job) || job.id === selectedJobId;
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

  filterPlatformCallback(platform, selectedJobId) {
    this.filterPlatform(platform, selectedJobId);
    if (Object.keys(this.state.platforms).length) {
      this.setState({ platforms: { ...this.state.platforms } });
    }
  }

  render() {
    const platforms = this.state.platforms || {};
    const { $injector, repoName } = this.props;

    return (
      <table id={this.aggregateId} className="table-hover">
        <tbody onMouseDown={this.onMouseDown}>
          {platforms ? Object.keys(platforms).map(id => (
          platforms[id].visible &&
          <Platform
            platform={platforms[id]}
            repoName={repoName}
            $injector={$injector}
            key={id}
            filterPlatformCb={this.filterPlatformCallback}
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
