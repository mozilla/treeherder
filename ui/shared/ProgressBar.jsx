import React from 'react';
import PropTypes from 'prop-types';
import { ProgressBar as BSProgressBar } from 'react-bootstrap';

import SimpleTooltip from './SimpleTooltip';

const ProgressBar = ({ magnitude, regression, color }) => {
  const truncMag = regression
    ? (Math.floor((100 - magnitude) * 100) / 100).toFixed(2)
    : (Math.floor(magnitude * 100) / 100).toFixed(2);

  // For regression, show colored bar on the right
  // For improvement, show colored bar on the left
  const leftValue = regression ? 100 - magnitude : magnitude;
  const rightValue = regression ? magnitude : 100 - magnitude;

  return (
    <SimpleTooltip
      text={
        <BSProgressBar
          aria-label={`Lower is better. Metric: ${truncMag} % regressed`}
        >
          <BSProgressBar
            now={leftValue}
            variant={regression ? '' : color}
            key={1}
            style={regression ? { backgroundColor: '#e9ecef' } : undefined}
          />
          <BSProgressBar
            now={rightValue}
            variant={regression ? color : ''}
            key={2}
            style={!regression ? { backgroundColor: '#e9ecef' } : undefined}
          />
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
