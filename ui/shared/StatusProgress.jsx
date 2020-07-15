import React from 'react';
import PropTypes from 'prop-types';
import { VictoryPie } from 'victory';

import { getPercentComplete } from '../helpers/display';

const StatusProgress = (props) => {
  const {
    counts: { success, testfailed, busted, running, pending },
  } = props;
  const failed = testfailed || 0 + busted || 0;
  const percentComplete = props.counts ? getPercentComplete(props.counts) : 0;

  return (
    <div className="relative">
      <VictoryPie
        data={[
          { x: 'success', y: success },
          { x: 'running', y: running },
          { x: 'pending', y: pending },
          { x: 'failed', y: failed },
        ]}
        colorScale={['#28a745', '#17a2b8', '#6c757d', '#dc3545']}
        labels={() => ''}
        height={200}
        width={200}
        padding={{ top: 20, bottom: 15 }}
        innerRadius={70}
        radius={85}
        style={{
          labels: {
            fontSize: 12,
          },
        }}
      />
      <div className="absolute">
        <div style={{ fontSize: '30px' }}>{percentComplete}%</div>
        <div>Complete</div>
      </div>
    </div>
  );
};

StatusProgress.propTypes = {
  counts: PropTypes.objectOf(PropTypes.number).isRequired,
};

export default StatusProgress;
