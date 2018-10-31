import React from 'react';
import PropTypes from 'prop-types';

import { thSimplePlatforms } from '../../helpers/constants';
import { withPinnedJobs } from '../context/PinnedJobs';
import { withSelectedJob } from '../context/SelectedJob';
import { getPushTableId } from '../../helpers/aggregateId';
import { findInstance, findSelectedInstance } from '../../helpers/job';
import { getUrlParam } from '../../helpers/location';
import { getLogViewerUrl } from '../../helpers/url';
import JobModel from '../../models/job';
import Platform from './Platform';
import { withPushes } from '../context/Pushes';

class PushJobs extends React.Component {
  static getDerivedStateFromProps(nextProps) {
    const { filterModel, push, platforms, runnableVisible } = nextProps;
    const selectedJobId = parseInt(getUrlParam('selectedJob'));
    const filteredPlatforms = platforms.reduce((acc, platform) => {
      const thisPlatform = { ...platform };
      const suffix = (thSimplePlatforms.includes(platform.name) && platform.option === 'opt') ? '' : ` ${platform.option}`;
      thisPlatform.title = `${thisPlatform.name}${suffix}`;
      thisPlatform.visible = true;
      return [...acc, PushJobs.filterPlatform(thisPlatform, selectedJobId, push, filterModel, runnableVisible)];
    }, []);

    return { filteredPlatforms };
  }

  static filterPlatform(platform, selectedJobId, push, filterModel, runnableVisible) {
    platform.visible = false;
    platform.groups.forEach((group) => {
      group.visible = false;
      group.jobs.forEach((job) => {
        job.visible = filterModel.showJob(job) || job.id === selectedJobId;
        if (job.state === 'runnable') {
          job.visible = job.visible && runnableVisible;
        }
        job.selected = selectedJobId ? job.id === selectedJobId : false;
        if (job.visible) {
          platform.visible = true;
          group.visible = true;
        }
      });
    });
    return platform;
  }

  constructor(props) {
    super(props);
    const { push, repoName } = this.props;

    this.pushId = push.id;
    this.aggregateId = getPushTableId(
      repoName,
      this.pushId,
      push.revision,
    );

    this.state = {
      filteredPlatforms: [],
    };
  }

  componentDidMount() {
    this.selectJob = this.selectJob.bind(this);
    this.filterPlatformCallback = this.filterPlatformCallback.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
  }

  onMouseDown(ev) {
    const { selectedJob, togglePinJob } = this.props;
    const jobInstance = findInstance(ev.target);

    if (jobInstance && jobInstance.props.job) {
      const job = jobInstance.props.job;
      if (ev.button === 1) { // Middle click
        this.handleLogViewerClick(job.id);
      } else if (ev.metaKey || ev.ctrlKey) { // Pin job
        if (!selectedJob) {
          this.selectJob(job, ev.target);
        }
        togglePinJob(job);
      } else if (job && job.state === 'runnable') { // Toggle runnable
        this.handleRunnableClick(jobInstance);
      } else {
        this.selectJob(job, ev.target); // Left click
      }
    }
  }

  selectJob(job, el) {
    const { setSelectedJob, selectedJob } = this.props;
    if (selectedJob) {
      const selected = findSelectedInstance();
      if (selected) selected.setSelected(false);
    }
    const jobInstance = findInstance(el);
    if (jobInstance) {
      jobInstance.setSelected(true);
    }
    setSelectedJob(job);
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

  handleRunnableClick(jobInstance) {
    const { toggleSelectedRunnableJob } = this.props;

    toggleSelectedRunnableJob(jobInstance.props.job.ref_data_name);
    jobInstance.toggleRunnableSelected();
  }

  filterPlatformCallback(platform, selectedJobId) {
    const { push, filterModel, runnableVisible } = this.props;
    const { filteredPlatforms } = this.state;

    // This actually filters the platform in-place.  So we just need to
    // trigger a re-render by giving it a new ``filteredPlatforms`` object instance.
    PushJobs.filterPlatform(platform, selectedJobId, push, filterModel, runnableVisible);
    if (filteredPlatforms.length) {
      this.setState({ filteredPlatforms: [...filteredPlatforms] });
    }
  }

  render() {
    const filteredPlatforms = this.state.filteredPlatforms || [];
    const {
      repoName, filterModel, pushGroupState, duplicateJobsVisible,
      groupCountsExpanded,
    } = this.props;

    return (
      <table id={this.aggregateId} className="table-hover" data-job-clear-on-click>
        <tbody onMouseDown={this.onMouseDown}>
          {filteredPlatforms ? filteredPlatforms.map(platform => (
          platform.visible &&
          <Platform
            platform={platform}
            repoName={repoName}
            key={platform.title}
            filterModel={filterModel}
            pushGroupState={pushGroupState}
            filterPlatformCb={this.filterPlatformCallback}
            duplicateJobsVisible={duplicateJobsVisible}
            groupCountsExpanded={groupCountsExpanded}
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
  platforms: PropTypes.array.isRequired,
  repoName: PropTypes.string.isRequired,
  filterModel: PropTypes.object.isRequired,
  togglePinJob: PropTypes.func.isRequired,
  setSelectedJob: PropTypes.func.isRequired,
  pushGroupState: PropTypes.string.isRequired,
  toggleSelectedRunnableJob: PropTypes.func.isRequired,
  runnableVisible: PropTypes.bool.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
  selectedJob: PropTypes.object,
};

PushJobs.defaultProps = {
  selectedJob: null,
};

export default withPushes(withSelectedJob(withPinnedJobs(PushJobs)));
