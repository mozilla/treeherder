import React from 'react';
import PropTypes from 'prop-types';

import ItemBadge from './ItemBadge';

export default function ItemList(props) {
  const { items, maxSeen } = props;

  return (
    <span>
      {items.slice(0, maxSeen).map(item => (
        <ItemBadge itemText={item} />
      ))}
      {items.length > maxSeen && (
        <ItemBadge itemText="..." title={items.slice(maxSeen).join(', ')} />
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
