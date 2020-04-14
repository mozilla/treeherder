import React from 'react';
import PropTypes from 'prop-types';

function StatusPanel(props) {
  const { selectedJobFull } = props;
  const shadingClass = `result-status-shading-${selectedJobFull.resultStatus}`;

  return (
    <li id="result-status-pane" className={`small ${shadingClass} p-0`}>
      <div className="ml-1">
        <strong>Result:</strong>
        <span> {selectedJobFull.result}</span>
      </div>
      <div>
        <strong>State:</strong>
        <span> {selectedJobFull.state}</span>
      </div>
    </li>
  );
}

StatusPanel.propTypes = {
  selectedJobFull: PropTypes.shape({}).isRequired,
};

export default StatusPanel;
