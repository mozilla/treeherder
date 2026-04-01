import { memo } from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

import { getPercentComplete } from '../../helpers/display';

function PushCounts({
  completed,
  fixedByCommit,
  pending,
  running,
  test_failed,
  build_failed,
  lint_failed,
}) {
  const totalFailedJobs = test_failed + build_failed + lint_failed;
  const inProgress = pending + running;
  const percentComplete = getPercentComplete({ pending, running, completed });

  if (percentComplete < 100) {
    return (
      <>
        {totalFailedJobs > 0 && (
          <Badge
            bg="warning"
            text="dark"
            title={`${totalFailedJobs} jobs failed`}
            className="push-counts"
          >
            {totalFailedJobs} {totalFailedJobs === 1 ? 'job' : 'jobs'} failed
          </Badge>
        )}
        <div>
          {fixedByCommit >= 1 && (
            <span
              className="badge text-bg-warning ms-1"
              title="Count of Fixed By Commit tasks for this push"
            >
              {fixedByCommit}
            </span>
          )}
          <span className="push-progress">
            <span title="Proportion of jobs that are complete">
              {percentComplete}% - {inProgress} in progress
            </span>
          </span>
        </div>
      </>
    );
  }

  if (percentComplete === 100) {
    return (
      <>
        {totalFailedJobs === 0 ? (
          <FontAwesomeIcon
            title={`${completed} completed jobs`}
            icon={faCheck}
            className="text-success"
          />
        ) : (
          <Badge
            bg="danger"
            title={`${totalFailedJobs} jobs failures`}
            className="push-counts"
          >
            {totalFailedJobs} {totalFailedJobs === 1 ? 'job' : 'jobs'} failed
          </Badge>
        )}

        <span className="push-progress">
          <span>- Complete -</span>
        </span>
      </>
    );
  }
}

PushCounts.propTypes = {
  completed: PropTypes.number.isRequired,
  fixedByCommit: PropTypes.number.isRequired,
  pending: PropTypes.number.isRequired,
  running: PropTypes.number.isRequired,
  test_failed: PropTypes.number.isRequired,
};

export default memo(PushCounts);
