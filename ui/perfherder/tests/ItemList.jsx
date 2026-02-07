
import PropTypes from 'prop-types';

export default function ItemList(props) {
  const { items, maxSeen = 2 } = props;

  return (
    <span>
      {items.slice(0, maxSeen).map((item) => (
        <span key={item} className="item-badge me-1">
          {item}
        </span>
      ))}
      {items.length > maxSeen && (
        <span
          className="item-badge me-1"
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
