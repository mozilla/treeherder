import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faFileAlt } from '@fortawesome/free-solid-svg-icons';

import { getLogViewerUrl } from '../../helpers/url';
import ClassicLogViewer from '../../logviewer/ClassicLogViewer';
import { useErrorLines } from '../../logviewer/useErrorLines';

const LogviewerTab = ({ selectedTaskFull, repoName }) => {
  const { firstErrorLine } = useErrorLines(selectedTaskFull.id);

  const url = selectedTaskFull.logs.find(
    (log) => log.name === 'live_backing_log',
  )?.url;

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
      {url && <ClassicLogViewer url={url} initialLine={firstErrorLine} />}
    </div>
  );
};

LogviewerTab.propTypes = {
  selectedTaskFull: PropTypes.shape({}).isRequired,
  repoName: PropTypes.string.isRequired,
};

export default LogviewerTab;
