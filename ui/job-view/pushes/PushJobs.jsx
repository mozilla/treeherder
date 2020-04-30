import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import { getPushTableId } from '../../helpers/aggregateId';
import { findInstance, findSelectedInstance } from '../../helpers/job';
import { getUrlParam } from '../../helpers/location';
import { didObjectsChange } from '../../helpers/object';
import { getLogViewerUrl } from '../../helpers/url';
import JobModel from '../../models/job';
import { setSelectedJob } from '../redux/stores/selectedJob';
import { togglePinJob } from '../redux/stores/pinnedJobs';

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

  onMouseDown = (ev) => {
    const { togglePinJob } = this.props;
    const jobInstance = findInstance(ev.target);
    const selectedTaskRun = getUrlParam('selectedTaskRun');

    if (jobInstance && jobInstance.props.job) {
      const { job } = jobInstance.props;
      if (ev.button === 1) {
        // Middle click
        this.handleLogViewerClick(job.id);
      } else if (ev.metaKey || ev.ctrlKey) {
        // Pin job
        if (!selectedTaskRun) {
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
    const { setSelectedJob } = this.props;

    if (getUrlParam('selectedTaskRun')) {
      const selected = findSelectedInstance();

      if (selected) selected.setSelected(false);
    }

    const jobInstance = findInstance(el);

    if (jobInstance) {
      jobInstance.setSelected(true);
    }
    setSelectedJob(job);
  };

  handleLogViewerClick = (jobId) => {
    // Open logviewer in a new window
    const { repoName } = this.props;
    JobModel.get(repoName, jobId).then((data) => {
      if (data.logs.length > 0) {
        window.open(
          `${window.location.origin}/${getLogViewerUrl(jobId, repoName)}`,
        );
      }
    });
  };

  handleRunnableClick = (jobInstance) => {
    const { toggleSelectedRunnableJob } = this.props;

    toggleSelectedRunnableJob(jobInstance.props.job.signature);
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
      <div role="button" tabIndex={0} onMouseDown={this.onMouseDown}>
        <table id={this.aggregateId} className="table-hover">
          <tbody>
            {platforms ? (
              platforms.map((platform) => (
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
      </div>
    );
  }
}

PushJobs.propTypes = {
  togglePinJob: PropTypes.func.isRequired,
  setSelectedJob: PropTypes.func.isRequired,
  toggleSelectedRunnableJob: PropTypes.func.isRequired,
  repoName: PropTypes.string.isRequired,
  push: PropTypes.shape({
    id: PropTypes.number,
    revision: PropTypes.string,
  }).isRequired,
  pushGroupState: PropTypes.string.isRequired,
  runnableVisible: PropTypes.bool.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
  platforms: PropTypes.arrayOf(PropTypes.object).isRequired,
  filterModel: PropTypes.shape({}).isRequired,
};

export default connect(null, { setSelectedJob, togglePinJob })(PushJobs);
