import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt } from '@fortawesome/free-regular-svg-icons';

import logviewerIcon from '../../../img/logviewerIcon.svg';

import LogItem from './LogItem';

export default function LogUrls(props) {
  const { logUrls, logViewerUrl, logViewerFullUrl } = props;
  const logUrlsUseful = logUrls.filter(
    (logUrl) => !logUrl.name.includes('perfherder-data'),
  );

  return (
    <React.Fragment>
      {/* Log Viewer */}
      <LogItem
        logUrls={logUrlsUseful}
        logViewerUrl={logViewerUrl}
        logViewerFullUrl={logViewerFullUrl}
        logKey="logviewer"
        logDescription="log viewer"
      >
        <img alt="Logviewer" src={logviewerIcon} className="logviewer-icon" />
      </LogItem>

      {/* Raw Log */}
      <LogItem
        logUrls={logUrlsUseful}
        logViewerUrl={logViewerUrl}
        logViewerFullUrl={logViewerFullUrl}
        logKey="rawlog"
        logDescription="raw log"
      >
        <FontAwesomeIcon
          icon={faFileAlt}
          size="lg"
          className="logviewer-icon"
        />
      </LogItem>
    </React.Fragment>
  );
}

LogUrls.propTypes = {
  logUrls: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  logViewerUrl: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
};

LogUrls.defaultProps = {
  logViewerUrl: null,
  logViewerFullUrl: null,
};
