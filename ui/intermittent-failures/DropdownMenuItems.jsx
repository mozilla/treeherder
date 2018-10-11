import React from 'react';
import Icon from 'react-fontawesome';
import PropTypes from 'prop-types';
import { DropdownMenu, DropdownItem } from 'reactstrap';

const DropdownMenuItems = ({ selectedItem, updateData, options }) =>
(
  <DropdownMenu>
    {options.map(item =>
      (<DropdownItem key={item} onClick={event => updateData(event.target.innerText)}>
        <Icon
          name="check"
          className={`pr-1 ${selectedItem === item ? '' : 'hide'}`}
        />
        {item}
      </DropdownItem>))}
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

