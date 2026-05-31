import PropTypes from 'prop-types';
import { Badge } from 'react-bootstrap';

function StatusPanel(props) {
  const { selectedJobFull, taskExpired = false } = props;
  const shadingClass = `result-status-shading-${selectedJobFull.resultStatus}`;

  return (
    <li id="result-status-pane" className={`fs-80 ${shadingClass} p-0`}>
      <div className="ms-1">
        <strong>Result:</strong>
        <span> {selectedJobFull.result}</span>
      </div>
      <div>
        <strong>State:</strong>
        <span> {selectedJobFull.state}</span>
      </div>
      {taskExpired && (
        <div className="ms-1 pb-1">
          <Badge
            bg="secondary"
            title="The Taskcluster task definition is no longer available. Some details and actions are unavailable."
            data-testid="taskcluster-expired-badge"
          >
            Expired
          </Badge>
        </div>
      )}
    </li>
  );
}

StatusPanel.propTypes = {
  selectedJobFull: PropTypes.shape({}).isRequired,
  taskExpired: PropTypes.bool,
};

export default StatusPanel;
