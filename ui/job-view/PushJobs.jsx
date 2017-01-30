import React from 'react';
import PropTypes from 'prop-types';
import * as _ from 'lodash';
import { actions, store } from './redux/store';
import { platformMap } from '../js/constants';
import * as aggregateIds from './aggregateIds';
import Platform from './Platform';

export default class PushJobs extends React.Component {
  constructor(props) {
    super(props);
    this.$rootScope = this.props.$injector.get('$rootScope');
    this.$location = this.props.$injector.get('$location');
    this.thEvents = this.props.$injector.get('thEvents');
    this.ThResultSetStore = this.props.$injector.get('ThResultSetStore');
    this.ThJobModel = this.props.$injector.get('ThJobModel');
    this.thUrl = this.props.$injector.get('thUrl');
    this.thJobFilters = this.props.$injector.get('thJobFilters');
    this.thResultStatus = this.props.$injector.get('thResultStatus');
    this.thResultStatusInfo = this.props.$injector.get('thResultStatusInfo');

    this.rsMap = null;
    this.pushId = this.props.push.id;
    this.aggregateId = aggregateIds.getResultsetTableId(
      this.$rootScope.repoName,
      this.pushId,
      this.props.push.revision
    );
    this.state = { platforms: null, isRunnableVisible: false };
    this.onMouseDown = this.onMouseDown.bind(this);
    this.selectJob = this.selectJob.bind(this);

    const showDuplicateJobs = this.$location.search().duplicate_jobs === 'visible';
    const expanded = this.$location.search().group_state === 'expanded';
    store.dispatch(actions.pushes.setCountExpanded(expanded));
    store.dispatch(actions.pushes.setShowDuplicates(showDuplicateJobs));
  }

  componentDidMount() {
    this.$rootScope.$on(
      this.thEvents.applyNewJobs, (ev, appliedpushId) => {
        if (appliedpushId === this.pushId) {
          this.applyNewJobs();
        }
      }
    );

    this.$rootScope.$on(
      this.thEvents.clearSelectedJob, () => {
        store.dispatch(actions.pushes.setSelectedJobId(null));
      }
    );

    this.$rootScope.$on(
      this.thEvents.globalFilterChanged, () => {
        this.filterJobs();
      }
    );

    this.$rootScope.$on(
      this.thEvents.groupStateChanged, () => {
        this.filterJobs();
      }
    );

    this.$rootScope.$on(
      this.thEvents.jobsClassified, () => {
        this.filterJobs();
      }
    );

    this.$rootScope.$on(
      this.thEvents.searchPage, () => {
        this.filterJobs();
      }
    );

    this.$rootScope.$on(this.thEvents.showRunnableJobs, (ev, push) => {
      if (this.props.push.id === push.id) {
        push.isRunnableVisible = true;
        this.setState({ isRunnableVisible: true });
        this.ThResultSetStore.addRunnableJobs(this.$rootScope.repoName, push);
      }
    });

    this.$rootScope.$on(this.thEvents.deleteRunnableJobs, (ev, push) => {
      if (this.props.push.id === push.id) {
        push.isRunnableVisible = false;
        this.setState({ isRunnableVisible: false });
        store.dispatch(actions.pushes.setSelectedRunnableJobs(null));
        this.applyNewJobs();
      }
    });
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
        this.selectJob(job); // Left click
      }
    }
  }

  getIdForPlatform(platform) {
    return aggregateIds.getPlatformRowId(
      this.$rootScope.repoName,
      this.props.push.id,
      platform.name,
      platform.option
    );
  }

  getJobFromId(jobId) {
    const jobMap = this.ThResultSetStore.getJobMap(this.$rootScope.repoName);
    return jobMap[`${jobId}`].job_obj;
  }

  filterJobs() {
    if (_.isEmpty(this.state.platforms)) return;
    const platforms = Object.values(this.state.platforms).reduce((acc, platform) => ({
      ...acc, [platform.id]: this.filterPlatform(platform)
    }), {});
    this.setState({ platforms });
  }

  selectJob(job) {
    store.dispatch(actions.pushes.setSelectedJobId(job.id));
    this.$rootScope.$emit(this.thEvents.jobClick, job);
  }

  applyNewJobs() {
    this.rsMap = this.ThResultSetStore.getResultSetsMap(this.$rootScope.repoName);
    if (!this.rsMap[this.pushId] || !this.rsMap[this.pushId].rs_obj.platforms) {
      return;
    }

    const rsPlatforms = this.rsMap[this.pushId].rs_obj.platforms;
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
      this.$rootScope.repoName,
      jobId
    ).then((data) => {
      if (data.logs.length > 0) {
        window.open(location.origin + '/' +
          this.ThJobModel.getLogViewerUrl(jobId));
      }
    });
  }

  handleRunnableClick(job) {
    const selected = this.ThResultSetStore.toggleSelectedRunnableJob(
      this.$rootScope.repoName,
      this.pushId,
      job.ref_data_name
    );
    store.dispatch(actions.pushes.setSelectedRunnableJobs({ selectedRunnableJobs: selected }));
  }

  filterPlatform(platform) {
    platform.visible = false;
    platform.groups.forEach((group) => {
      group.visible = false;
      group.jobs.forEach((job) => {
        job.visible = this.thJobFilters.showJob(job);
        if (this.rsMap && job.state === 'runnable') {
          job.visible = job.visible &&
            this.rsMap[job.result_set_id].rs_obj.isRunnableVisible;
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
    return (
      <table id={this.aggregateId} className="table-hover">
        <tbody onMouseDown={this.onMouseDown}>
        {platforms ? Object.keys(platforms).map((id, i) => (
          platforms[id].visible &&
          <Platform
            platform={platforms[id]}
            $injector={this.props.$injector}
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
  $injector: PropTypes.object.isRequired,
};
