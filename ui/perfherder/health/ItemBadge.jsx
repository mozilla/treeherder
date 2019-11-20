import React from 'react';
import PropTypes from 'prop-types';

export default function ItemBadge(props) {
  const { itemText, title } = props;

  return (
    <span key={`item_${itemText}`} className="item-outlined mx-1" title={title}>
      {itemText}
    </span>
  );
}

ItemBadge.propTypes = {
  itemText: PropTypes.string.isRequired,
};
