import React from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'reactstrap';

const StatusProgress = (props) => {
  const {
    counts: { success, testfailed, busted, running, pending },
  } = props;
  const failed = testfailed || 0 + busted || 0;

  return (
    <Progress
      multi
      title={`${failed} failed, ${success} success, ${running} running, ${pending} pending`}
    >
      <Progress bar color="danger" value={failed} />
      <Progress bar color="success" value={success} />
      <Progress bar color="info" value={running} striped />
      <Progress bar color="secondary" value={pending} />
    </Progress>
  );
};

StatusProgress.propTypes = {
  counts: PropTypes.objectOf(PropTypes.number).isRequired,
};

export default StatusProgress;
