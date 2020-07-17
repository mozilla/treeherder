import React from 'react';
import PropTypes from 'prop-types';

export default function JobCount(props) {
  const { className, title, onClick, count } = props;
  const classes = [
    className,
    'btn group-btn btn-xs job-group-count filter-shown',
  ];

  return (
    <button
      type="button"
      className={classes.join(' ')}
      title={title}
      onClick={onClick}
      data-testid="job-group-count"
    >
      {count}
    </button>
  );
}

JobCount.propTypes = {
  className: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  count: PropTypes.number.isRequired,
};
