import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';

import { resultColorMap, getIcon } from './helpers';

const StatusButton = ({ title, result, count, repo, revision }) => {
  let resultText = 'Passed';

  if (result === 'fail') {
    resultText = `Failures (${count})`;
  } else if (result === 'unknown') {
    resultText = 'In progress';
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
          className={`mr-2 text-${resultColorMap[result]}`}
        />
        <span className={`text-${resultColorMap[result]}`}>{resultText}</span>
      </div>
    </React.Fragment>
  );
};

StatusButton.propTypes = {
  title: PropTypes.string.isRequired,
  result: PropTypes.string.isRequired,
  count: PropTypes.number,
  revision: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
};

StatusButton.defaultProps = {
  count: 0,
};

export default StatusButton;
