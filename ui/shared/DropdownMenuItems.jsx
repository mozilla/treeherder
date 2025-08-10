import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

const createDropdownItem = (
  item,
  namespace,
  updateData,
  selectedItem,
  className,
) => {
  return (
    <Dropdown.Item
      as="a"
      key={`${namespace}${item}`}
      onClick={() => updateData(item)}
      className={`${className || ''}`}
    >
      <FontAwesomeIcon
        icon={faCheck}
        className={`mr-1 ${selectedItem === item ? '' : 'hide'}`}
        title={selectedItem === item ? 'Selected' : ''}
      />
      {item}
    </Dropdown.Item>
  );
};

const DropdownMenuItems = ({
  selectedItem,
  updateData,
  options,
  pinned,
  namespace,
  otherPinned,
}) => (
  <>
    {/* Items pinned to top of dropdown */}
    {pinned.length > 0 && (
      <React.Fragment>
        {pinned.map((item) =>
          createDropdownItem(
            item,
            namespace,
            updateData,
            selectedItem,
            'top-pinned',
          ),
        )}
        <Dropdown.Divider />
      </React.Fragment>
    )}
    {options.map((item) =>
      createDropdownItem(item, namespace, updateData, selectedItem),
    )}
    {/* Items pinned to bottom of dropdown */}
    {otherPinned.length > 0 && (
      <React.Fragment>
        <Dropdown.Divider />
        {otherPinned.map((item) =>
          createDropdownItem(
            item,
            namespace,
            updateData,
            selectedItem,
            'bottom-pinned',
          ),
        )}
      </React.Fragment>
    )}
  </>
);

DropdownMenuItems.propTypes = {
  updateData: PropTypes.func,
  selectedItem: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  pinned: PropTypes.arrayOf(PropTypes.string),
  namespace: PropTypes.string,
  // optional pinned Items, ideally to be positioned at the bottom of the drop down
  otherPinned: PropTypes.arrayOf(PropTypes.string),
};

DropdownMenuItems.defaultProps = {
  updateData: null,
  selectedItem: null,
  pinned: [],
  namespace: '',
  otherPinned: [],
};

export default DropdownMenuItems;
