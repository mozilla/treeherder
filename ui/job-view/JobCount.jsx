import React from 'react';
import PropTypes from 'prop-types';

export default function JobCount(props) {
  const { className, title, onClick, countKey, count } = props;
  const classes = [className, 'btn group-btn btn-xs job-group-count filter-shown'];

  return (
    <button
      className={classes.join(' ')}
      title={title}
      onClick={onClick}
      key={countKey}
    >{count}</button>
  );
}

JobCount.propTypes = {
  className: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  countKey: PropTypes.number.isRequired,
  count: PropTypes.number.isRequired,
};
