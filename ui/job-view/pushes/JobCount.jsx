import React from 'react';
import PropTypes from 'prop-types';

export default function JobCount(props) {
  const { className, title, onClick, count, status } = props;
  const classes = [
    className,
    'btn group-btn btn-xs job-group-count filter-shown',
  ];

  return (
    <button
      type="button"
      className={classes.join(' ')}
      data-status={status}
      title={title}
      onClick={onClick}
      data-testid="job-group-count"
    >
      {count}
    </button>
  );
}

JobCount.propTypes = {
  className: PropTypes.string,
  status: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  count: PropTypes.number.isRequired,
};

JobCount.defaultProps = {
  className: '',
};
