import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import { withPinnedJobs } from '../context/PinnedJobs';
import { withSelectedJob } from '../context/SelectedJob';
import { getPushTableId } from '../../helpers/aggregateId';
import { findInstance, findSelectedInstance } from '../../helpers/job';
import { didObjectsChange } from '../../helpers/object';
import { getLogViewerUrl } from '../../helpers/url';
import JobModel from '../../models/job';
import { withPushes } from '../context/Pushes';

import Platform from './Platform';

class PushJobs extends React.Component {
  constructor(props) {
    super(props);
    const { push, repoName } = this.props;

    this.pushId = push.id;
    this.aggregateId = getPushTableId(repoName, this.pushId, push.revision);
  }

  shouldComponentUpdate(nextProps) {
    return didObjectsChange(this.props, nextProps, [
      'platforms',
      'filterModel',
      'pushGroupState',
      'runnableVisible',
      'duplicateJobsVisible',
      'groupCountsExpanded',
    ]);
  }

  onMouseDown = ev => {
    const { selectedJob, togglePinJob } = this.props;
    const jobInstance = findInstance(ev.target);

    if (jobInstance && jobInstance.props.job) {
      const { job } = jobInstance.props;
      if (ev.button === 1) {
        // Middle click
        this.handleLogViewerClick(job.id);
      } else if (ev.metaKey || ev.ctrlKey) {
        // Pin job
        if (!selectedJob) {
          this.selectJob(job, ev.target);
        }
        togglePinJob(job);
      } else if (job && job.state === 'runnable') {
        // Toggle runnable
        this.handleRunnableClick(jobInstance);
      } else {
        this.selectJob(job, ev.target); // Left click
      }
    }
  };

  selectJob = (job, el) => {
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
  };

  handleLogViewerClick = jobId => {
    // Open logviewer in a new window
    const { repoName } = this.props;
    JobModel.get(repoName, jobId).then(data => {
      if (data.logs.length > 0) {
        window.open(
          `${window.location.origin}/${getLogViewerUrl(jobId, repoName)}`,
        );
      }
    });
  };

  handleRunnableClick = jobInstance => {
    const { toggleSelectedRunnableJob } = this.props;

    toggleSelectedRunnableJob(jobInstance.props.job.ref_data_name);
    jobInstance.toggleRunnableSelected();
  };

  render() {
    const {
      repoName,
      filterModel,
      pushGroupState,
      duplicateJobsVisible,
      groupCountsExpanded,
      runnableVisible,
      platforms,
    } = this.props;

    return (
      <table id={this.aggregateId} className="table-hover">
        <tbody onMouseDown={this.onMouseDown}>
          {platforms ? (
            platforms.map(platform => (
              <Platform
                platform={platform}
                repoName={repoName}
                filterModel={filterModel}
                pushGroupState={pushGroupState}
                key={`${platform.name}${platform.option}`}
                duplicateJobsVisible={duplicateJobsVisible}
                groupCountsExpanded={groupCountsExpanded}
                runnableVisible={runnableVisible}
              />
            ))
          ) : (
            <tr>
              <td>
                <FontAwesomeIcon
                  icon={faSpinner}
                  pulse
                  className="th-spinner"
                  title="Loading..."
                />
              </td>
            </tr>
          )}
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
