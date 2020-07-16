import React from 'react';
import PropTypes from 'prop-types';
import { LazyLog } from 'react-lazylog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faFileAlt } from '@fortawesome/free-solid-svg-icons';

import TextLogStepModel from '../../models/textLogStep';
import { getLogViewerUrl } from '../../helpers/url';
import { errorLinesCss } from '../../helpers/display';

class LogviewerTab extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      highlight: null,
    };
  }

  componentDidMount() {
    const {
      selectedTaskFull: { id: taskId },
    } = this.props;

    TextLogStepModel.get(taskId).then((textLogSteps) => {
      const stepErrors = textLogSteps.length ? textLogSteps[0].errors : [];
      const logErrors = stepErrors.map((error) => ({
        line: error.line,
        lineNumber: error.line_number + 1,
      }));
      const firstErrorLineNumber = logErrors.length
        ? [logErrors[0].lineNumber]
        : null;

      errorLinesCss(logErrors);
      this.setState({ highlight: firstErrorLineNumber });
    });
  }

  render() {
    const { selectedTaskFull, repoName } = this.props;
    const { highlight } = this.state;
    const { url } = selectedTaskFull.logs[0];

    return (
      <div className="h-100 w-100" aria-label="Log">
        <span className="log-viewer-top-bar-buttons">
          <a
            className="p-1 mr-2 text-darker-secondary"
            href={getLogViewerUrl(selectedTaskFull.id, repoName)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the full-screen Log Viewer for this task"
          >
            <FontAwesomeIcon icon={faExpand} className="mr-1" />
            Full Screen
          </a>
          <a
            className="p-2 text-darker-secondary"
            href={getLogViewerUrl(selectedTaskFull.id, repoName)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the full-screen Log Viewer for this task"
          >
            <FontAwesomeIcon icon={faFileAlt} className="mr-1" />
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
