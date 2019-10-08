import React from 'react';
import PropTypes from 'prop-types';
import { Button, Label } from 'reactstrap';

function getLogUrlProps(logKey, logUrl, logViewerUrl, logViewerFullUrl) {
  if (logKey === 'rawlog') {
    return {
      title: 'Open the raw log in a new window',
      target: '_blank',
      rel: 'noopener noreferrer',
      href: logUrl.url,
      'copy-value': logUrl.url,
    };
  }
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

export default function LogItem(props) {
  const {
    logUrls,
    logViewerUrl,
    logViewerFullUrl,
    logKey,
    logDescription,
  } = props;

  return (
    <React.Fragment>
      {/* Case 1: Two or more logurls - Display a dropdown */}
      {logUrls.length > 1 && (
        <li key={logKey}>
          <span className="dropdown">
            <span
              role="button"
              title={`Select a ${logDescription}`}
              data-toggle="dropdown"
              className="logviewer-btn btn-view-nav btn-sm nav-menu-btn dropdown-toggle"
            >
              {props.children}
            </span>
            <ul className="dropdown-menu checkbox-dropdown-menu" role="menu">
              {logUrls.map(logUrl => {
                return (
                  <li key={`${logKey}-${logUrl.id}`}>
                    <div>
                      <Label className="dropdown-item">
                        <a
                          {...getLogUrlProps(
                            logKey,
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
        <li key={logKey}>
          <a
            className="logviewer-btn"
            {...getLogUrlProps(
              logKey,
              logUrls[0],
              logViewerUrl,
              logViewerFullUrl,
            )}
          >
            {props.children}
          </a>
        </li>
      )}

      {/* Case 3: No logurl - Display disabled button */}
      {!logUrls.length && (
        <li key={logKey}>
          <Button
            className="logviewer-btn disabled bg-transparent border-0"
            title="No logs available for this job"
            aria-label="No logs available for this job"
          >
            {props.children}
          </Button>
        </li>
      )}
    </React.Fragment>
  );
}

LogItem.propTypes = {
  logUrls: PropTypes.array.isRequired,
  logViewerUrl: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
};

LogItem.defaultProps = {
  logViewerUrl: null,
  logViewerFullUrl: null,
};
