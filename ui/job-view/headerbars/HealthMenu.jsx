import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle } from 'reactstrap';

import DropdownMenuItems from '../../shared/DropdownMenuItems';

export const PUSH_HEALTH_VISIBILITY = 'pushHealthVisibility';

class HealthMenu extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      dropdownOpen: false,
    };
  }

  toggle = () => {
    this.setState(prevState => ({
      dropdownOpen: !prevState.dropdownOpen,
    }));
  };

  render() {
    const { pushHealthVisibility, setPushHealthVisibility } = this.props;
    const { dropdownOpen } = this.state;

    return (
      <Dropdown isOpen={dropdownOpen} toggle={this.toggle}>
        <DropdownToggle
          caret
          title="Change visibility of the Push Health badge/link"
          className="btn-view-nav nav-menu-btn"
        >
          Health
        </DropdownToggle>
        <DropdownMenuItems
          options={['All', 'Try', 'None']}
          updateData={setPushHealthVisibility}
          selectedItem={pushHealthVisibility}
        />
      </Dropdown>
    );
  }
}

HealthMenu.propTypes = {
  pushHealthVisibility: PropTypes.string.isRequired,
  setPushHealthVisibility: PropTypes.func.isRequired,
};

export default HealthMenu;
