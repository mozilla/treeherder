import React from 'react';
import PropTypes from 'prop-types';
import { Button, Label } from 'reactstrap';
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

export default function LogUrls(props) {
  const { logUrls, logViewerUrl, logViewerFullUrl } = props;

  return (
    <React.Fragment>
      {/* Log Viewer */}
      {/* Case 1: Two or more logurls - Display a dropdown */}
      {logUrls.length > 1 && (
        <li key="logview">
          <span className="dropdown">
            <span
              role="button"
              title="Select a log viewer"
              data-toggle="dropdown"
              className="btn btn-view-nav btn-sm nav-menu-btn dropdown-toggle"
            >
              <img
                alt="Logviewer"
                src={logviewerIcon}
                className="logviewer-icon"
              />
            </span>
            <ul className="dropdown-menu checkbox-dropdown-menu" role="menu">
              {logUrls.map(logUrl => {
                return (
                  <li key={`logview-${logUrl.id}`}>
                    <div>
                      <Label className="dropdown-item">
                        <a
                          {...getLogUrlProps(
                            logUrl,
                            logViewerUrl,
                            logViewerFullUrl,
                          )}
                        >
                          {logUrl.name} ({logUrl.id})
                        </a>
                      </Label>
                    </div>
                  </li>
                );
              })}
            </ul>
          </span>
        </li>
      )}

      {/* Case 2: Only one logurl - Display a button */}
      {logUrls.length === 1 && (
        <li key={`logview-${logUrls[0].id}`}>
          <a
            className="logviewer-btn"
            {...getLogUrlProps(logUrls[0], logViewerUrl, logViewerFullUrl)}
          >
            <img
              alt="Logviewer"
              src={logviewerIcon}
              className="logviewer-icon"
            />
          </a>
        </li>
      )}

      {/* Case 3: No logurl - Display disabled button */}
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

      {/* Raw Log */}
      {/* Case 1: Two or more logurls - Display a dropdown */}
      {logUrls.length > 1 && (
        <li key="raw">
          <span className="dropdown">
            <span
              role="button"
              title="Select a raw log"
              data-toggle="dropdown"
              className="btn btn-view-nav btn-sm nav-menu-btn dropdown-toggle"
            >
              <FontAwesomeIcon icon={faFileAlt} size="lg" />
            </span>
            <ul className="dropdown-menu checkbox-dropdown-menu" role="menu">
              {logUrls.map(logUrl => {
                return (
                  <li key={`raw-${logUrl.id}`}>
                    <div>
                      <Label className="dropdown-item">
                        <a
                          title="Open the raw log in a new window"
                          target="_blank"
                          rel="noopener noreferrer"
                          href={logUrl.url}
                          copy-value={logUrl.url}
                        >
                          {logUrl.name} ({logUrl.id})
                        </a>
                      </Label>
                    </div>
                  </li>
                );
              })}
            </ul>
          </span>
        </li>
      )}

      {/* Case 2: Only one logurl - Display a button */}
      {logUrls.length === 1 && (
        <li key={`raw-${logUrls[0].id}`}>
          <a
            title="Open the raw log in a new window"
            target="_blank"
            rel="noopener noreferrer"
            href={logUrls[0].url}
            copy-value={logUrls[0].url}
          >
            <FontAwesomeIcon icon={faFileAlt} size="lg" title="Raw Log" />
          </a>
        </li>
      )}

      {/* Case 3: No logurl - Display disabled button */}
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
