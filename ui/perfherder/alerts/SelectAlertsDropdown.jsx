import React from 'react';
import PropTypes from 'prop-types';
import DropdownItem from 'reactstrap/lib/DropdownItem';
import DropdownMenu from 'reactstrap/lib/DropdownMenu';
import DropdownToggle from 'reactstrap/lib/DropdownToggle';
import UncontrolledDropdown from 'reactstrap/lib/UncontrolledDropdown';

class SelectAlertsDropdown extends React.Component {
  status = {
    untriaged: 'untriaged',
    triaged: 'triaged',
    all: 'all',
    none: 'none',
  };

  render() {
    const { selectAlertsByStatus } = this.props;
    const { untriaged, triaged, all, none } = this.status;

    return (
      <UncontrolledDropdown size="sm">
        <DropdownToggle caret>check alerts</DropdownToggle>
        <DropdownMenu>
          <DropdownItem onClick={() => selectAlertsByStatus(untriaged)}>
            untriaged
          </DropdownItem>
          <DropdownItem onClick={() => selectAlertsByStatus(triaged)}>
            triaged
          </DropdownItem>
          <DropdownItem onClick={() => selectAlertsByStatus(all)}>
            all
          </DropdownItem>
          <DropdownItem onClick={() => selectAlertsByStatus(none)}>
            none
          </DropdownItem>
        </DropdownMenu>
      </UncontrolledDropdown>
    );
  }
}

export default SelectAlertsDropdown;

SelectAlertsDropdown.propTypes = {
  selectAlertsByStatus: PropTypes.func.isRequired,
};
