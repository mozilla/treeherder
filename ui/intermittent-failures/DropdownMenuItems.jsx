import React from 'react';
import Icon from 'react-fontawesome';
import PropTypes from 'prop-types';

import { DropdownMenu, DropdownItem } from 'reactstrap';

export default class DropdownMenuItems extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedItem: this.props.default,
    };
    this.changeSelection = this.changeSelection.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.default) {
      this.setState({ selectedItem: nextProps.default });
    }
  }

  changeSelection(event) {
    const { selectedItem } = this.state;
    const selectedText = event.target.innerText;

    if (selectedText !== selectedItem) {
      this.setState({ selectedItem: selectedText }, () => this.props.updateData(selectedText));
    }
  }

  render() {
    const { selectedItem } = this.state;
    const { options } = this.props;

    return (
      <DropdownMenu>
        {options.map(item =>
          (<DropdownItem key={item} onClick={this.changeSelection}>
            <Icon
              name="check"
              className={`pr-1 ${selectedItem === item ? '' : 'hide'}`}
            />
            {item}
          </DropdownItem>))}
      </DropdownMenu>
    );
  }
}

DropdownMenuItems.propTypes = {
  updateData: PropTypes.func,
  default: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
};

DropdownMenuItems.defaultProps = {
  updateData: null,
  default: null,
};
