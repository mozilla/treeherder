import React from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  UncontrolledDropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from 'reactstrap';

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
    <li key={logKey}>
      {/* Case 1: Two or more logurls - Display a dropdown */}
      {logUrls.length > 1 && (
        <UncontrolledDropdown>
          <DropdownToggle
            title={`Select a ${logDescription}`}
            className="logviewer-btn btn-view-nav"
          >
            {props.children}
          </DropdownToggle>
          <DropdownMenu>
            {logUrls.map((logUrl) => (
              <DropdownItem
                tag="a"
                {...getLogUrlProps(
                  logKey,
                  logUrl,
                  logViewerUrl,
                  logViewerFullUrl,
                )}
                key={`${logKey}-${logUrl.id}`}
              >
                {logUrl.name} ({logUrl.id})
              </DropdownItem>
            ))}
          </DropdownMenu>
        </UncontrolledDropdown>
      )}

      {/* Case 2: Only one logurl - Display a button */}
      {logUrls.length === 1 && (
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
      )}

      {/* Case 3: No logurl - Display disabled button */}
      {!logUrls.length && (
        <Button
          className="logviewer-btn disabled bg-transparent border-0"
          title="No logs available for this job"
          aria-label="No logs available for this job"
        >
          {props.children}
        </Button>
      )}
    </li>
  );
}

LogItem.propTypes = {
  logUrls: PropTypes.arrayOf(PropTypes.object).isRequired,
  logViewerUrl: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
};

LogItem.defaultProps = {
  logViewerUrl: null,
  logViewerFullUrl: null,
};
