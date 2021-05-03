import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';

import { resultColorMap, getIcon } from '../helpers/display';

const StatusButton = ({
  title,
  failureCount,
  inProgressCount,
  status,
  repo,
  revision,
}) => {
  let text = `Not run`;
  // This is a fall-through condition.  We get...
  // fail: If we have passed or in progress as well as failures
  // in progress: If we have passed, and in progress but no failures
  // pass: Only if all tests are completed with no failures.
  if (failureCount) {
    text = `Failures (${failureCount})`;
  } else if (inProgressCount) {
    text = `In Progress (${inProgressCount})`;
  } else if (status === 'pass') {
    text = 'Passed';
  } else if (status === 'unknown') {
    text = 'In Progress';
  }
  return (
    <React.Fragment>
      {status === 'none' ? (
        <span className="status-link link-darker-secondary">
          {title} <FontAwesomeIcon icon={faChevronRight} />
        </span>
      ) : (
        <Link
          className="status-link link-darker-secondary pb-1"
          to={`/push-health/push?repo=${repo}&revision=${revision}&tab=${title.toLowerCase()}`}
        >
          {title} <FontAwesomeIcon icon={faChevronRight} />
        </Link>
      )}
      <br />
      <div className="pt-2">
        <FontAwesomeIcon
          icon={getIcon(status)}
          className={`mr-2 text-${resultColorMap[status]}`}
        />
        <span className={`text-${resultColorMap[status]}`}>{text}</span>
      </div>
    </React.Fragment>
  );
};

StatusButton.propTypes = {
  title: PropTypes.string.isRequired,
  failureCount: PropTypes.number.isRequired,
  inProgressCount: PropTypes.number.isRequired,
  status: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
};

export default StatusButton;
