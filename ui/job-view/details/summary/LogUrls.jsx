import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt } from '@fortawesome/free-regular-svg-icons';

import logviewerIcon from '../../../img/logviewerIcon.svg';

function getLogUrlProps(logUrl, logViewerUrl, logViewerFullUrl) {
  switch (logUrl.parse_status) {
    case 'parsed':
      return {
        target: '_blank',
        rel: 'noopener',
        href: logViewerUrl,
        'copy-value': logViewerFullUrl,
        title: 'Open the log viewer in a new window',
      };
    case 'failed':
      return {
        className: 'disabled',
        title: 'Log parsing has failed',
      };
    case 'skipped-size':
      return {
        className: 'disabled',
        title: 'Log parsing was skipped',
      };
    case 'pending':
      return {
        className: 'disabled',
        title: 'Log parsing in progress',
      };
  }
}

const cloneLogsUrls = [
  { id: 440915850,
    job_id: 269912805,
    name: 'builds-4h',
    parse_status: parsed,
    url: 'https://queue.taskcluster.net/v1/task/AcEBYiT5RyCTuOHbT-G2HQ/runs/0/artifacts/public/logs/live_backing.log' },

  { id: 440915850,
    job_id: 269912805,
    name: 'builds-4h',
    parse_status: parsed,
    url:'https://queue.taskcluster.net/v1/task/AcEBYiT5RyCTuOHbT-G2HQ/runs/0/artifacts/public/logs/live_backing.log'},
  {
    id: 440915850,
    job_id: 269912805,
    name: 'builds-4h',
    parse_status: parsed,
    url: 'https://queue.taskcluster.net/v1/task/AcEBYiT5RyCTuOHbT-G2HQ/runs/0/artifacts/public/logs/live_backing.log'
  },
];

export default function LogUrls(props) {
  const { cloneLogUrls, logUrls, logViewerUrl, logViewerFullUrl } = props;

  return (
    <React.Fragment>
      {cloneLogUrls.map(jobLogUrl => (
        <li key={`logview-${jobLogUrl.id}`}>
          <a
            className="logviewer-btn"
            {...getLogUrlProps(jobLogUrl, logViewerUrl, logViewerFullUrl)}
          >
            <img
              alt="Logviewer"
              src={logviewerIcon}
              className="logviewer-icon"
            />
          </a>
        </li>
      ))}
      {!logUrls.length && (
        <li>
          <Button
            className="logviewer-btn disabled bg-transparent border-0"
            title="No logs available for this job"
            aria-label="No logs available for this job"
          >
            <img
              alt="Logviewer"
              src={logviewerIcon}
              className="logviewer-icon"
            />
          </Button>
        </li>
      )}

      {logUrls.map(jobLogUrl => (
        <li key={`raw-${jobLogUrl.id}`}>
          <a
            title="Open the raw log in a new window"
            target="_blank"
            rel="noopener noreferrer"
            href={jobLogUrl.url}
            copy-value={jobLogUrl.url}
          >
            <FontAwesomeIcon icon={faFileAlt} size="lg" title="Raw Log" />
          </a>
        </li>
      ))}
      {!logUrls.length && (
        <li>
          <Button
            className="disabled raw-log-icon text-white-50 bg-transparent border-0"
            title="No logs available for this job"
            aria-label="No logs available for this job"
          >
            <FontAwesomeIcon icon={faFileAlt} title="No logs" />
          </Button>
        </li>
      )}
    </React.Fragment>
  );
}

LogUrls.propTypes = {
  logUrls: PropTypes.array.isRequired,
  logViewerUrl: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
};

LogUrls.defaultProps = {
  logViewerUrl: null,
  logViewerFullUrl: null,
};
