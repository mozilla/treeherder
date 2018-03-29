import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import logUrl from '../../img/logviewerIcon.png';

export default function LogViewer(props) {
  return (
    <span className="logviewer badge">
      <Link
        to={`/logviewer.html#/?repo=${props.repo}&job_id=${props.job.jobId}`}
        target="_blank"
        rel="noopener"
        title="Open the log viewer in a new window"
      >
        <img src={logUrl} className="logviewer-icon" alt="" />
      </Link>
    </span>
  );
}

LogViewer.propTypes = {
  repo: PropTypes.string.isRequired,
  job: PropTypes.object.isRequired,
};
