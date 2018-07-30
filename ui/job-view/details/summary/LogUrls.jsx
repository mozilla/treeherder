import React from 'react';
import PropTypes from 'prop-types';

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
    case 'pending':
      return {
        className: 'disabled',
        title: 'Log parsing in progress',
      };
  }
}

export default function LogUrls(props) {
  const { logUrls, logViewerUrl, logViewerFullUrl } = props;

  return (
    <React.Fragment>
      {logUrls.map(jobLogUrl => (<li key={`logview-${jobLogUrl.id}`}>
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
      </li>))}
      <li>
        {!logUrls.length && <a
          className="logviewer-btn disabled"
          title="No logs available for this job"
        >
          <img
            alt="Logviewer"
            src={logviewerIcon}
            className="logviewer-icon"
          />
        </a>}
      </li>

      {logUrls.map(jobLogUrl => (<li key={`raw-${jobLogUrl.id}`}>
        <a
          id="raw-log-btn"
          className="raw-log-icon"
          title="Open the raw log in a new window"
          target="_blank"
          rel="noopener noreferrer"
          href={jobLogUrl.url}
          copy-value={jobLogUrl.url}
        ><span className="fa fa-file-text-o" /></a>
      </li>))}
      {!logUrls.length && <li>
        <a
          className="disabled raw-log-icon"
          title="No logs available for this job"
        ><span className="fa fa-file-text-o" /></a>
      </li>}
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
