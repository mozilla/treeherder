import React from 'react';
import PropTypes from 'prop-types';
import { VictoryPie, VictoryTooltip } from 'victory';

import { getPercentComplete } from '../helpers/display';

const StatusProgress = (props) => {
  const {
    counts: { success, testfailed, busted, running, pending },
    customStyle,
  } = props;
  const failed = testfailed || 0 + busted || 0;
  const percentComplete = props.counts ? getPercentComplete(props.counts) : 0;

  return (
    <div className={customStyle}>
      <VictoryPie
        data={[
          { x: 'success', y: success },
          { x: 'running', y: running + pending },
          { x: 'failed', y: failed },
        ]}
        colorScale={['#28a745', 'lightgrey', '#dc3545']}
        labels={({ datum }) => (datum.y > 0 ? `${datum.x}: ${datum.y}` : '')}
        labelComponent={
          <VictoryTooltip pointerLength={0} flyoutComponent={<div />} />
        }
        labelRadius={({ innerRadius }) => innerRadius}
        height={250}
        width={250}
        innerRadius={70}
        radius={85}
      />
      <div className="absolute-progress">
        <div className="metric-name">{percentComplete}%</div>
        <div>Complete</div>
      </div>
    </div>
  );
};

StatusProgress.propTypes = {
  counts: PropTypes.objectOf(PropTypes.number).isRequired,
  customStyle: PropTypes.string,
};

StatusProgress.defaultProps = {
  customStyle: '',
};

export default StatusProgress;
