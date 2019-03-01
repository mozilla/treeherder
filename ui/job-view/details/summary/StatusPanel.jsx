import React from 'react';
import PropTypes from 'prop-types';

import { getStatus } from '../../../helpers/job';
import { withSelectedJob } from '../../context/SelectedJob';

function StatusPanel(props) {
  const { selectedJob } = props;
  const shadingClass = `result-status-shading-${getStatus(selectedJob)}`;

  return (
    <li id="result-status-pane" className={`small ${shadingClass}`}>
      <div>
        <strong>Result:</strong>
        <span> {selectedJob.result}</span>
      </div>
      <div>
        <strong>State:</strong>
        <span> {selectedJob.state}</span>
      </div>
    </li>
  );
}

StatusPanel.propTypes = {
  selectedJob: PropTypes.object.isRequired,
};

export default withSelectedJob(StatusPanel);
