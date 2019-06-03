import React from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'reactstrap';

import SimpleTooltip from '../shared/SimpleTooltip';

const ProgressBar = ({ magnitude, regression, color }) => (
  <SimpleTooltip
    text={
      <Progress multi>
        {/* the % of the bars that are colored and transparent is based on the newIsBetter metric,
        which determines whether the colored bar for magnitude is displayed on the left or right */}
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
      </Progress>
    }
    tooltipText="Relative magnitude of change (scale from 0 - 20%+)"
  />
);

ProgressBar.propTypes = {
  regression: PropTypes.bool.isRequired,
  magnitude: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
};

export default ProgressBar;
