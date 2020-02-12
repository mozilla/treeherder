import React from 'react';
import PropTypes from 'prop-types';
import { DropdownMenu, DropdownItem } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

const DropdownMenuItems = ({
  selectedItem,
  updateData,
  options,
  pinned = [],
  namespace = '',
}) => (
  <DropdownMenu className="overflow-auto dropdown-menu-height">
    {/* Items pinned to top of dropdown */}
    {pinned.length > 0 &&
      pinned.map(item => (
        <DropdownItem
          tag="a"
          key={`${namespace}${item}`}
          onClick={() => updateData(item)}
        >
          <FontAwesomeIcon
            icon={faCheck}
            className={`mr-1 ${selectedItem === item ? '' : 'hide'}`}
            title={selectedItem === item ? 'Checked' : ''}
          />
          {item}
        </DropdownItem>
      ))}

    {options
      .filter(item => !pinned.includes(item))
      .sort((a, b) => a > b)
      .map(item => (
        <DropdownItem
          tag="a"
          key={`${namespace}${item}`}
          onClick={() => updateData(item)}
        >
          <FontAwesomeIcon
            icon={faCheck}
            className={`mr-1 ${selectedItem === item ? '' : 'hide'}`}
            title={selectedItem === item ? 'Checked' : ''}
          />
          {item}
        </DropdownItem>
      ))}
  </DropdownMenu>
);

DropdownMenuItems.propTypes = {
  updateData: PropTypes.func,
  selectedItem: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
};

DropdownMenuItems.defaultProps = {
  updateData: null,
  selectedItem: null,
};

export default DropdownMenuItems;
