import React from 'react';
import PropTypes from 'prop-types';

import { getStatus } from '../../../helpers/job';

function StatusPanel(props) {
  const { selectedJob } = props;
  const shadingClass = `result-status-shading-${getStatus(selectedJob)}`;

  return (
    <li id="result-status-pane" className={`small ${shadingClass}`}>
      <div>
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
  selectedJobFull: PropTypes.object.isRequired,
};

export default StatusPanel;
