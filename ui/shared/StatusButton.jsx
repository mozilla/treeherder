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
  externalFailureUrl,
  externalFailureTooltip,
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

  const statusContent = (
    <React.Fragment>
      <FontAwesomeIcon
        icon={getIcon(result)}
        className={`me-2 text-${resultColorMap[result]}`}
      />
      <span className={`text-${resultColorMap[result]}`}>{text}</span>
    </React.Fragment>
  );

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
        {externalFailureUrl && failureCount ? (
          <a
            href={externalFailureUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={externalFailureTooltip}
          >
            {statusContent}
          </a>
        ) : (
          statusContent
        )}
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
  externalFailureUrl: PropTypes.string,
  externalFailureTooltip: PropTypes.string,
};

export default StatusButton;
