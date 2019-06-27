import React from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'reactstrap';
import { connect } from 'react-redux';

const mapStateToProps = ({ groups }) => ({ counts: groups.counts });

const StatusProgress = props => {
  const { counts } = props;
  const { failed, success, running, pending } = counts;

  return (
    <Progress multi>
      <Progress bar color="danger" value={failed} />
      <Progress bar color="success" value={success} />
      <Progress bar color="info" value={running} striped />
      <Progress bar color="default" value={pending} />
    </Progress>
  );
};

StatusProgress.propTypes = {
  counts: PropTypes.object.isRequired,
};

export default connect(mapStateToProps)(StatusProgress);
