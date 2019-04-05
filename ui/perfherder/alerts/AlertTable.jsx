import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import { Container, Form, FormGroup, Label, Input, Table } from 'reactstrap';

import // alertIsOfState,
// alertSummaryIsOfState,
// alertSummaryMarkAs,
// assignBug,
// editingNotes,
// getAlertStatusText,
// getAlertSummaries,
// getAlertSummary,
// getAlertSummaryTitle,
// getAlertSummaryStatusText,
// getGraphsURL,
// getSubtestsURL,
// getTextualSummary,
// isResolved,
// modifySelectedAlerts,
// refreshAlertSummary,
// saveNotes,
// toggleStar,
// unassignBug,
'../helpers';
import perf from '../../js/perf';

import AlertHeader from './AlertHeader';
import StatusDropdown from './StatusDropdown';

// TODO remove $stateParams and $state after switching to react router
export class AlertTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  updateAlertSummary = () => {
    const { alertSummary } = this.props;
    // TODO see about moving this to state, although it's also used in modifySelectedAlerts
    // (resets to false) which is used in many different parts
    alertSummary.allSelected = !alertSummary.allSelected;
    // TODO should this be changed?
    alertSummary.alerts.forEach(function selectAlerts(alert) {
      alert.selected = alert.visible && alertSummary.allSelected;
    });
  };

  render() {
    const { user, alertSummary, repos, updateAlertVisibility } = this.props;

    return (
      <Container fluid className="px-0">
        <Form>
          <Table>
            <thead>
              <tr className="bg-lightgray">
                <th className="text-left alert-summary-header-element">
                  {/* <div className="justify-content-left"> */}
                  <FormGroup check>
                    <Label check>
                      <Input
                        type="checkbox"
                        disabled={!user.isStaff}
                        onClick={this.updateAlertSummary}
                      />
                      <AlertHeader alertSummary={alertSummary} />
                    </Label>
                  </FormGroup>
                  {/* </div> */}
                </th>
                <th />
                <th />
                <th />
                <th />
                <th />
                <th className="table-width-sm align-top font-weight-normal">
                  <StatusDropdown
                    alertSummary={alertSummary}
                    repos={repos}
                    user={user}
                    updateAlertVisibility={updateAlertVisibility}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr />
            </tbody>
          </Table>
        </Form>
      </Container>
    );
  }
}

AlertTable.propTypes = {
  $stateParams: PropTypes.shape({}),
  $state: PropTypes.shape({}),
  alertSummary: PropTypes.shape({}),
  user: PropTypes.shape({}),
  repos: PropTypes.arrayOf(PropTypes.shape({})),
  updateAlertVisibility: PropTypes.func.isRequired,
};

AlertTable.defaultProps = {
  $stateParams: null,
  $state: null,
  alertSummary: null,
  user: null,
  repos: null,
};

perf.component(
  'alertTable',
  react2angular(
    AlertTable,
    ['alertSummary', 'user', 'repos', 'updateAlertVisibility'],
    ['$stateParams', '$state'],
  ),
);

export default AlertTable;
