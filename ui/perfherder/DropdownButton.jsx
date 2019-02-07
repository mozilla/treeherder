import React from 'react';
import PropTypes from 'prop-types';
import { ButtonDropdown, DropdownToggle } from 'reactstrap';

import DropdownMenuItems from '../shared/DropdownMenuItems';

export default class DropdownButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: false,
      selectedItem: this.props.defaultText,
    };
  }

  updateState = selectedItem => {
    this.setState({ selectedItem });
    this.props.updateData(selectedItem);
  };

  render() {
    const { selectedItem, isOpen } = this.state;
    const { data, defaultTextClass } = this.props;
    return (
      <ButtonDropdown
        className={defaultTextClass}
        isOpen={isOpen}
        toggle={() =>
          this.setState({
            isOpen: !this.state.isOpen,
          })
        }
      >
        <DropdownToggle caret>{selectedItem}</DropdownToggle>
        {data && (
          <DropdownMenuItems
            options={data}
            selectedItem={selectedItem}
            updateData={this.updateState}
          />
        )}
      </ButtonDropdown>
    );
  }
}

DropdownButton.propTypes = {
  data: PropTypes.arrayOf(PropTypes.string).isRequired,
  defaultText: PropTypes.string.isRequired,
  updateData: PropTypes.func.isRequired,
  defaultTextClass: PropTypes.string,
};

DropdownButton.defaultProps = {
  defaultTextClass: 'text-nowrap',
};
