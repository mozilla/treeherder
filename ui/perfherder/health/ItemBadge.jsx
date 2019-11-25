import React from 'react';
import PropTypes from 'prop-types';

export default function ItemBadge(props) {
  const { itemText, outlined, title } = props;

  return (
    <span
      key={`item_${itemText}`}
      className={`item-badge mr-1 ${outlined ? 'item-outlined' : ''}`}
      title={title}
    >
      {itemText}
    </span>
  );
}

ItemBadge.propTypes = {
  itemText: PropTypes.string.isRequired,
  outlined: PropTypes.bool,
};

ItemBadge.defaultProps = {
  outlined: false,
};
