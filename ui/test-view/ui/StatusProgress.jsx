import React from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'reactstrap';
import { connect } from 'react-redux';

const mapStateToProps = ({ groups }) => ({ counts: groups.counts });

const StatusProgress = props => (
  <Progress multi>
    <Progress bar color="danger" value={props.counts.failed} />
    <Progress bar color="success" value={props.counts.success} />
    <Progress bar color="info" value={props.counts.running} striped />
    <Progress bar color="default" value={props.counts.pending} />
  </Progress>
);

StatusProgress.propTypes = {
  counts: PropTypes.object.isRequired,
};

export default connect(mapStateToProps)(StatusProgress);
