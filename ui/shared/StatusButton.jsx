import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router';
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
  let result = 'in progress';
  let text = `In Progress`;

  // This is a fall-through condition.  We get...
  // fail: If we have passed or in progress as well as failures
  // in progress: If we have passed, and in progress but no failures
  // pass: Only if all tests are completed with no failures.
  if (failureCount) {
    result = 'fail';
    text = `Failures (${failureCount})`;
  } else if (inProgressCount) {
    text = `In Progress (${inProgressCount})`;
  } else if (status === 'pass') {
    text = 'Passed';
    result = 'pass';
  }
  return (
    <React.Fragment>
      <Link
        className="status-link link-darker-secondary pb-1"
        to={`/push-health/push?repo=${repo}&revision=${revision}&tab=${title.toLowerCase()}`}
      >
        {title} <FontAwesomeIcon icon={faChevronRight} />
      </Link>
      <br />
      <div className="pt-2">
        <FontAwesomeIcon
          icon={getIcon(result)}
          className={`me-2 text-${resultColorMap[result]}`}
        />
        <span className={`text-${resultColorMap[result]}`}>{text}</span>
      </div>
    </React.Fragment>
  );
};

StatusButton.propTypes = {
  title: PropTypes.string.isRequired,
  failureCount: PropTypes.number.isRequired,
  inProgressCount: PropTypes.number,
  status: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
};

export default StatusButton;
