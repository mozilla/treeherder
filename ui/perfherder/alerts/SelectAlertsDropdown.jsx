import React from 'react';
import PropTypes from 'prop-types';
import DropdownItem from 'reactstrap/lib/DropdownItem';
import DropdownMenu from 'reactstrap/lib/DropdownMenu';
import DropdownToggle from 'reactstrap/lib/DropdownToggle';
import UncontrolledDropdown from 'reactstrap/lib/UncontrolledDropdown';
import Input from 'reactstrap/lib/Input';
import Label from 'reactstrap/lib/Label';

import { alertStatusMap } from '../perf-helpers/constants';
import { getStatus } from '../perf-helpers/helpers';

class SelectAlertsDropdown extends React.Component {
  status = {
    all: 'all',
    none: 'none',
    triaged: 'triaged',
    untriaged: 'untriaged',
  };

  selectAlertsByStatus = (selectedStatus) => {
    const { filteredAlerts, setSelectedAlerts } = this.props;
    let { allSelected } = this.props;

    let selectedAlerts = [...filteredAlerts];

    if (selectedStatus === this.status.none) {
      selectedAlerts = [];
      allSelected = false;
    } else if (selectedStatus === this.status.all) {
      allSelected = true;
    } else if (selectedStatus !== this.status.all) {
      selectedAlerts = selectedAlerts.filter((alert) => {
        const alertStatus = getStatus(alert.status, alertStatusMap);

        if (selectedStatus === this.status.triaged) {
          return alertStatus !== this.status.untriaged;
        }

        return alertStatus === selectedStatus;
      });
      allSelected = selectedAlerts.length === filteredAlerts.length;
    }

    setSelectedAlerts({
      selectedAlerts,
      allSelected,
    });
  };

  render() {
    const { user, allSelected, alertSummaryId } = this.props;
    const { untriaged, triaged, all, none } = this.status;

    return (
      <React.Fragment>
        <Label check className="pl-1">
          <Input
            data-testid={`alert summary ${alertSummaryId} checkbox`}
            type="checkbox"
            checked={allSelected}
            disabled={!user.isStaff}
            onChange={() => {
              return allSelected
                ? this.selectAlertsByStatus(none)
                : this.selectAlertsByStatus(all);
            }}
          />
        </Label>
        <UncontrolledDropdown size="sm" className="mr-2">
          <DropdownToggle
            aria-label="alert selection options"
            caret
            className="d-flex mt-1"
            disabled={!user.isStaff}
          />
          <DropdownMenu>
            <DropdownItem header>Check alerts</DropdownItem>
            <DropdownItem onClick={() => this.selectAlertsByStatus(all)}>
              All
            </DropdownItem>
            <DropdownItem onClick={() => this.selectAlertsByStatus(none)}>
              None
            </DropdownItem>
            <DropdownItem onClick={() => this.selectAlertsByStatus(triaged)}>
              Triaged
            </DropdownItem>
            <DropdownItem onClick={() => this.selectAlertsByStatus(untriaged)}>
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
  setSelectedAlerts: PropTypes.func.isRequired,
  user: PropTypes.shape({}).isRequired,
  filteredAlerts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  allSelected: PropTypes.bool.isRequired,
};
