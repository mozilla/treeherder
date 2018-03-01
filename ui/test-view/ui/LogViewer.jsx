import React from 'react';
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
