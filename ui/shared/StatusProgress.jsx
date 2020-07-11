import React from 'react';
import PropTypes from 'prop-types';
import { VictoryPie } from 'victory';

const StatusProgress = (props) => {
  const {
    counts: { success, testfailed, busted, running, pending },
  } = props;
  const failed = testfailed || 0 + busted || 0;

  return (
    <VictoryPie
      data={[
        { x: 'success', y: success },
        { x: 'running', y: running },
        { x: 'pending', y: pending },
        { x: 'failed', y: failed },
      ]}
      colorScale={['#28a745', '#17a2b8', '#6c757d', '#dc3545']}
      labels={({ datum }) => (datum.y > 0 ? `${datum.x}: ${datum.y}` : '')}
      height={200}
      padding={{ top: 20, bottom: 15 }}
      style={{
        labels: {
          fontSize: 12,
        },
        parent: { width: '25%' },
      }}
    />
  );
};

StatusProgress.propTypes = {
  counts: PropTypes.objectOf(PropTypes.number).isRequired,
};

export default StatusProgress;
