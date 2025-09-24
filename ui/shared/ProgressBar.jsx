import React from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'reactstrap';

import SimpleTooltip from './SimpleTooltip';

const ProgressBar = ({ magnitude, regression, color }) => {
  const truncMag = regression
    ? (Math.floor((100 - magnitude) * 100) / 100).toFixed(2)
    : (Math.floor(magnitude * 100) / 100).toFixed(2);
  return (
    <SimpleTooltip
      text={
        <Progress
          multi
          aria-label={`Lower is better. Metric: ${truncMag} % regressed`}
        >
          {/* the % of the bars that are colored and transparent is based on the newIsBetter metric,
          which determines whether the colored bar for magnitude is displayed on the left or right */}
          <div aria-hidden="true" className="progress w-100">
            <Progress
              bar
              value={regression ? 100 - magnitude : magnitude}
              color={regression ? 'transparent' : color}
            />
            <Progress
              bar
              value={regression ? magnitude : 100 - magnitude}
              color={regression ? color : 'transparent'}
            />
          </div>
        </Progress>
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
