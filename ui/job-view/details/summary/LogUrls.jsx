import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt } from '@fortawesome/free-regular-svg-icons';

import logviewerIcon from '../../../img/logviewerIcon.svg';

import LogItem from './LogItem';

export default function LogUrls(props) {
  const { logUrls, logViewerUrl, logViewerFullUrl } = props;

  return (
    <React.Fragment>
      {/* Log Viewer */}
      {
        <LogItem
          logUrls={logUrls}
          logViewerUrl={logViewerUrl}
          logViewerFullUrl={logViewerFullUrl}
          logKey="logviewer"
          logDescription="log viewer"
        >
          <img alt="Logviewer" src={logviewerIcon} className="logviewer-icon" />
        </LogItem>
      }

      {/* Raw Log */}
      {
        <LogItem
          logUrls={logUrls}
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
      }
    </React.Fragment>
  );
}

LogUrls.propTypes = {
  logUrls: PropTypes.arrayOf(PropTypes.object).isRequired,
  logViewerUrl: PropTypes.string,
  logViewerFullUrl: PropTypes.string,
};

LogUrls.defaultProps = {
  logViewerUrl: null,
  logViewerFullUrl: null,
};
