import { memo } from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'react-bootstrap';

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
      <Badge
        {...(totalFailedJobs > 0
          ? { bg: 'warning', text: 'dark' }
          : { bg: 'secondary' })}
        title={`${inProgress} jobs pending`}
        className="push-counts"
      >
        {totalFailedJobs > 0
          ? `${totalFailedJobs} ${totalFailedJobs === 1 ? 'job' : 'jobs'} failed - `
          : ''}
        {fixedByCommit >= 1 && (
          <span
            className="badge text-bg-warning ms-1"
            title="Count of Fixed By Commit tasks for this push"
          >
            {fixedByCommit}
          </span>
        )}
        {percentComplete}% - {inProgress} pending
      </Badge>
    );
  }

  if (percentComplete === 100) {
    if (totalFailedJobs > 0) {
      return (
        <Badge
          bg="danger"
          title={`${totalFailedJobs} jobs failures`}
          className="push-counts"
        >
          {totalFailedJobs} {totalFailedJobs === 1 ? 'job' : 'jobs'} failed
        </Badge>
      );
    }
    return (
      <Badge
        bg="success"
        title={`${completed} completed jobs`}
        className="push-counts"
      >
        All {completed} jobs completed
      </Badge>
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
