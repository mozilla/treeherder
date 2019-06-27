import React from 'react';
import PropTypes from 'prop-types';

export default function ListItem(props) {
  const { text } = props;
  return (
    <li>
      <p className="failure-summary-line-empty mb-0">{text}</p>
    </li>
  );
}

ListItem.propTypes = {
  text: PropTypes.string.isRequired,
};
