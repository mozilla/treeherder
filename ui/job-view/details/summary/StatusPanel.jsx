import React from 'react';
import PropTypes from 'prop-types';

import { getStatus } from '../../../helpers/job';

export default function StatusPanel(props) {
  const { job } = props;
  const shadingClass = `result-status-shading-${getStatus(job)}`;

  return (
    <ul className="list-unstyled">
      <li
        id="result-status-pane"
        className={`small ${shadingClass}`}
      >
        <div>
          <label>Result:</label>
          <span> {job.result}</span>
        </div>
        <div>
          <label>State:</label>
          <span> {job.state}</span>
        </div>
      </li>
    </ul>
  );
}

StatusPanel.propTypes = {
  job: PropTypes.object.isRequired,
};

