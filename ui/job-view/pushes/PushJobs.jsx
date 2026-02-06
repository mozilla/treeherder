import React, { useMemo, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import { getPushTableId } from '../../helpers/aggregateId';
import { findInstance } from '../../helpers/job';
import { getUrlParam } from '../../helpers/location';
import { getLogViewerUrl } from '../../helpers/url';
import JobModel from '../../models/job';
import { selectJobViaUrl } from '../redux/stores/selectedJob';
import { togglePinJob } from '../redux/stores/pinnedJobs';

import Platform from './Platform';

function PushJobs({
  push,
  repoName,
  filterModel,
  pushGroupState,
  runnableVisible,
  duplicateJobsVisible,
  groupCountsExpanded,
  platforms,
  toggleSelectedRunnableJob,
  togglePinJob,
  selectJobViaUrl,
}) {
  const aggregateId = useMemo(
    () => getPushTableId(repoName, push.id, push.revision),
    [repoName, push.id, push.revision],
  );

  const selectJob = useCallback(
    (job) => {
      // URL-FIRST: Only update the URL here.
      // The URL change will trigger syncSelectionFromUrl in PushList,
      // which handles updating Redux state and visual selection.
      // This eliminates race conditions by having a single path for selection.
      selectJobViaUrl(job);
    },
    [selectJobViaUrl],
  );

  const handleLogViewerClick = useCallback(
    (jobId) => {
      // Open logviewer in a new window
      JobModel.get(repoName, jobId).then((data) => {
        if (data.logs.length > 0) {
          window.open(
            `${window.location.origin}${getLogViewerUrl(
              jobId,
              repoName,
              null,
              data,
            )}`,
          );
        }
      });
    },
    [repoName],
  );

  const handleRunnableClick = useCallback(
    (jobInstance) => {
      toggleSelectedRunnableJob(jobInstance.props.job.signature);
      jobInstance.toggleRunnableSelected();
    },
    [toggleSelectedRunnableJob],
  );

  const onMouseDown = useCallback(
    (ev) => {
      const jobInstance = findInstance(ev.target);
      const selectedTaskRun = getUrlParam('selectedTaskRun');

      if (jobInstance && jobInstance.props && jobInstance.props.job) {
        const { job } = jobInstance.props;
        if (ev.button === 1) {
          // Middle click
          handleLogViewerClick(job.id);
        } else if (ev.metaKey || ev.ctrlKey) {
          // Pin job
          if (!selectedTaskRun) {
            selectJob(job);
          }
          togglePinJob(job);
        } else if (job && job.state === 'runnable') {
          // Toggle runnable
          handleRunnableClick(jobInstance);
        } else {
          selectJob(job); // Left click
        }
      }
    },
    [togglePinJob, selectJob, handleLogViewerClick, handleRunnableClick],
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div onMouseDown={onMouseDown}>
      <table id={aggregateId} className="table-hover">
        <tbody>
          {platforms ? (
            platforms.map((platform) => (
              <Platform
                platform={platform}
                filterModel={filterModel}
                pushGroupState={pushGroupState}
                key={`${platform.name}${platform.option}`}
                duplicateJobsVisible={duplicateJobsVisible}
                groupCountsExpanded={groupCountsExpanded}
                runnableVisible={runnableVisible}
                toggleSelectedRunnableJob={toggleSelectedRunnableJob}
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

PushJobs.propTypes = {
  togglePinJob: PropTypes.func.isRequired,
  selectJobViaUrl: PropTypes.func.isRequired,
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
  platforms: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  filterModel: PropTypes.shape({}).isRequired,
};

export default connect(null, { selectJobViaUrl, togglePinJob })(memo(PushJobs));
