import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';

export default function BadgeList(props) {
  const { items, maxSeen, color } = props;

  return (
    <span>
      {items.slice(0, maxSeen).map(item => (
        <Badge key={`bdg_${item}`} color={color} className="mr-1">
          {item}
        </Badge>
      ))}
      {items.length > maxSeen && (
        <Badge
          key="see_more"
          color={color}
          title={items.slice(maxSeen).join(', ')}
        >
          ...
        </Badge>
      )}
    </span>
  );
}

BadgeList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
  maxSeen: PropTypes.number,
  color: PropTypes.string,
};

BadgeList.defaultProps = {
  maxSeen: 2,
  color: 'secondary',
};
