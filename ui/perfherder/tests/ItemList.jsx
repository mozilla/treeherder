import React from 'react';
import PropTypes from 'prop-types';

export default function ItemList(props) {
  const { items, maxSeen } = props;

  return (
    <span>
      {items.slice(0, maxSeen).map(item => (
        <span key={item} className="item-badge mr-1">
          {item}
        </span>
      ))}
      {items.length > maxSeen && (
        <span
          className="item-badge mr-1"
          title={items.slice(maxSeen).join(', ')}
        >
          ...
        </span>
      )}
    </span>
  );
}

ItemList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
  maxSeen: PropTypes.number,
};

ItemList.defaultProps = {
  maxSeen: 2,
};
