import React from 'react';
import PropTypes from 'prop-types';

import { getStatus } from '../../../helpers/job';

export default function StatusPanel(props) {
  const { selectedJob } = props;
  const shadingClass = `result-status-shading-${getStatus(selectedJob)}`;

  return (
    <li
      id="result-status-pane"
      className={`small ${shadingClass}`}
    >
      <div>
        <label>Result:</label>
        <span> {selectedJob.result}</span>
      </div>
      <div>
        <label>State:</label>
        <span> {selectedJob.state}</span>
      </div>
    </li>
  );
}

StatusPanel.propTypes = {
  selectedJob: PropTypes.object.isRequired,
};

