import React from 'react';
import PropTypes from 'prop-types';
import DropdownItem from 'reactstrap/lib/DropdownItem';
import DropdownMenu from 'reactstrap/lib/DropdownMenu';
import DropdownToggle from 'reactstrap/lib/DropdownToggle';
import UncontrolledDropdown from 'reactstrap/lib/UncontrolledDropdown';
import Input from 'reactstrap/lib/Input';
import Label from 'reactstrap/lib/Label';

class SelectAlertsDropdown extends React.Component {
  status = {
    all: 'all',
    none: 'none',
    triaged: 'triaged',
    untriaged: 'untriaged',
  };

  render() {
    const {
      selectAlertsByStatus,
      toggleAllAlerts,
      user,
      allSelected,
      alertSummary,
    } = this.props;
    const { untriaged, triaged, all, none } = this.status;

    return (
      <React.Fragment>
        <Label check className="pl-1">
          <Input
            data-testid={`alert summary ${alertSummary.id.toString()} checkbox`}
            aria-labelledby={`alert summary ${alertSummary.id.toString()} title`}
            type="checkbox"
            checked={allSelected}
            disabled={!user.isStaff}
            onChange={() => {
              toggleAllAlerts();
            }}
          />
        </Label>
        <UncontrolledDropdown
          size="sm"
          className="mr-2"
          disabled={!user.isStaff}
        >
          <DropdownToggle caret className="d-flex mt-1" />
          <DropdownMenu>
            <DropdownItem header>Check alerts</DropdownItem>
            <DropdownItem onClick={() => selectAlertsByStatus(all)}>
              All
            </DropdownItem>
            <DropdownItem onClick={() => selectAlertsByStatus(none)}>
              None
            </DropdownItem>
            <DropdownItem onClick={() => selectAlertsByStatus(triaged)}>
              Triaged
            </DropdownItem>
            <DropdownItem onClick={() => selectAlertsByStatus(untriaged)}>
              Untriaged
            </DropdownItem>
          </DropdownMenu>
        </UncontrolledDropdown>
      </React.Fragment>
    );
  }
}

export default SelectAlertsDropdown;

SelectAlertsDropdown.propTypes = {
  selectAlertsByStatus: PropTypes.func.isRequired,
  toggleAllAlerts: PropTypes.func.isRequired,
  user: PropTypes.shape({}).isRequired,
};
