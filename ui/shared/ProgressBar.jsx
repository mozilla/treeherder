import React from 'react';
import PropTypes from 'prop-types';
import { ProgressBar as BSProgressBar } from 'react-bootstrap';

import SimpleTooltip from './SimpleTooltip';

const ProgressBar = ({ magnitude, regression, color }) => {
  const truncMag = regression
    ? (Math.floor((100 - magnitude) * 100) / 100).toFixed(2)
    : (Math.floor(magnitude * 100) / 100).toFixed(2);
  return (
    <SimpleTooltip
      text={
        <BSProgressBar
          aria-label={`Lower is better. Metric: ${truncMag} % regressed`}
        >
          {/* the % of the bars that are colored and transparent is based on the newIsBetter metric,
          which determines whether the colored bar for magnitude is displayed on the left or right */}
          <div aria-hidden="true" className="progress w-100">
            <BSProgressBar
              now={regression ? 100 - magnitude : magnitude}
              variant={regression ? undefined : color}
              style={
                regression ? { backgroundColor: 'transparent' } : undefined
              }
            />
            <BSProgressBar
              now={regression ? magnitude : 100 - magnitude}
              variant={regression ? color : undefined}
              style={
                regression ? undefined : { backgroundColor: 'transparent' }
              }
            />
          </div>
        </BSProgressBar>
      }
      tooltipText="Relative magnitude of change (scale from 0 - 20%+)"
    />
  );
};

ProgressBar.propTypes = {
  regression: PropTypes.bool.isRequired,
  magnitude: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
};

export default ProgressBar;
