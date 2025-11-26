import React from 'react';
import PropTypes from 'prop-types';
import { LazyLog } from 'react-lazylog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faFileAlt } from '@fortawesome/free-solid-svg-icons';

import { getLogViewerUrl, textLogErrorsEndpoint } from '../../helpers/url';
import { errorLinesCss } from '../../helpers/display';
import { getData } from '../../helpers/http';
import { getProjectJobUrl } from '../../helpers/location';

class LogviewerTab extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      highlight: null,
    };
  }

  async componentDidMount() {
    const {
      selectedTaskFull: { id: jobId },
    } = this.props;

    const { data, failureStatus } = await getData(
      getProjectJobUrl(textLogErrorsEndpoint, jobId),
    );
    if (!failureStatus && data.length) {
      const logErrors = data.map((error) => ({
        line: error.line,
        lineNumber: error.line_number + 1,
      }));

      const firstErrorLineNumber = logErrors.length
        ? [logErrors[0].lineNumber]
        : null;

      errorLinesCss(logErrors);
      this.setState({ highlight: firstErrorLineNumber });
    }
  }

  render() {
    const { selectedTaskFull, repoName } = this.props;
    const { highlight } = this.state;
    const { url } = selectedTaskFull.logs.find(
      (log) => log.name === 'live_backing_log',
    );

    return (
      <div className="h-100 w-100" aria-label="Log">
        <span className="log-viewer-top-bar-buttons">
          <a
            className="p-1 me-2 text-darker-secondary"
            href={getLogViewerUrl(selectedTaskFull.id, repoName)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the full-screen Log Viewer for this task"
          >
            <FontAwesomeIcon icon={faExpand} className="me-1" />
            Full Screen
          </a>
          <a
            className="p-2 text-darker-secondary"
            href={getLogViewerUrl(selectedTaskFull.id, repoName)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the full-screen Log Viewer for this task"
          >
            <FontAwesomeIcon icon={faFileAlt} className="me-1" />
            Text Log
          </a>
        </span>
        <LazyLog
          url={url}
          scrollToLine={highlight ? highlight[0] : 0}
          highlight={highlight}
          selectableLines
          rowHeight={13}
          extraLines={3}
          enableSearch
        />
      </div>
    );
  }
}

LogviewerTab.propTypes = {
  selectedTaskFull: PropTypes.shape({}).isRequired,
  repoName: PropTypes.string.isRequired,
};

export default LogviewerTab;
