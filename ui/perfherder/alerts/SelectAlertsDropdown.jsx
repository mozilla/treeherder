import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, Form } from 'react-bootstrap';

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
        <Form.Check
          className="ps-1 me-1"
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
        <Dropdown size="sm" className="me-2">
          <Dropdown.Toggle
            variant="secondary"
            aria-label="alert selection options"
            className="d-flex mt-1"
            disabled={!user.isStaff}
          />
          <Dropdown.Menu className="overflow-auto dropdown-menu-height">
            <Dropdown.Header>Check alerts</Dropdown.Header>
            <Dropdown.Item onClick={() => this.selectAlertsByStatus(all)}>
              All
            </Dropdown.Item>
            <Dropdown.Item onClick={() => this.selectAlertsByStatus(none)}>
              None
            </Dropdown.Item>
            <Dropdown.Item onClick={() => this.selectAlertsByStatus(triaged)}>
              Triaged
            </Dropdown.Item>
            <Dropdown.Item onClick={() => this.selectAlertsByStatus(untriaged)}>
              Untriaged
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
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
