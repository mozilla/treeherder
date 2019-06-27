import React from 'react';
import PropTypes from 'prop-types';
import { Container, Form, FormGroup, Label, Input, Table } from 'reactstrap';
import orderBy from 'lodash/orderBy';

import {
  phAlertStatusMap,
  genericErrorMessage,
  errorMessageClass,
} from '../../helpers/constants';
import RepositoryModel from '../../models/repository';
import { getInitializedAlerts, containsText } from '../helpers';
import TruncatedText from '../../shared/TruncatedText';
import ErrorBoundary from '../../shared/ErrorBoundary';

import AlertHeader from './AlertHeader';
import StatusDropdown from './StatusDropdown';
import AlertTableRow from './AlertTableRow';
import DownstreamSummary from './DownstreamSummary';
import AlertActionPanel from './AlertActionPanel';

export default class AlertTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      alertSummary: null,
      downstreamIds: [],
      filteredAlerts: [],
      allSelected: false,
      selectedAlerts: [],
    };
  }

  componentDidMount() {
    this.processAlerts();
  }

  componentDidUpdate(prevProps) {
    const { filters, alertSummary } = this.props;

    if (prevProps.filters !== filters) {
      this.updateFilteredAlerts();
    }
    if (prevProps.alertSummary !== alertSummary) {
      this.processAlerts();
    }
  }

  processAlerts = () => {
    const { alertSummary, optionCollectionMap } = this.props;

    const alerts = getInitializedAlerts(alertSummary, optionCollectionMap);
    alertSummary.alerts = orderBy(
      alerts,
      ['starred', 'title'],
      ['desc', 'desc'],
    );

    this.setState({ alertSummary }, () => {
      this.getDownstreamList();
      this.updateFilteredAlerts();
    });
  };

  getDownstreamList = () => {
    const { alertSummary } = this.state;

    const downstreamIds = [
      ...new Set(
        alertSummary.alerts
          .map(alert => {
            if (
              alert.status === phAlertStatusMap.DOWNSTREAM.id &&
              alert.summary_id !== alertSummary.id
            ) {
              return [alert.summary_id];
            }
            return [];
          })
          .reduce((a, b) => [...a, ...b], []),
      ),
    ];

    this.setState({ downstreamIds });
  };

  filterAlert = alert => {
    const { filters } = this.props;
    const { hideImprovements, hideDownstream, filterText } = filters;
    const { alertSummary } = this.state;

    const matchesFilters =
      (!hideImprovements || alert.is_regression) &&
      (alert.summary_id === alertSummary.id ||
        alert.status !== phAlertStatusMap.DOWNSTREAM.id) &&
      !(
        hideDownstream &&
        alert.status === phAlertStatusMap.REASSIGNED.id &&
        alert.related_summary_id !== alertSummary.id
      ) &&
      !(hideDownstream && alert.status === phAlertStatusMap.DOWNSTREAM.id) &&
      !(hideDownstream && alert.status === phAlertStatusMap.INVALID.id);

    if (!filterText) return matchesFilters;

    const textToTest = `${alert.title} ${alertSummary.bug_number &&
      alertSummary.bug_number.toString()} ${alertSummary.revision.toString()}`;

    // searching with filter input and one or more metricFilter buttons on
    // will produce different results compared to when all filters are off
    return containsText(textToTest, filterText) && matchesFilters;
  };

  updateFilteredAlerts = () => {
    const { alertSummary } = this.state;

    const filteredAlerts = alertSummary.alerts.filter(alert =>
      this.filterAlert(alert),
    );
    this.setState({ filteredAlerts });
  };

  render() {
    const {
      user,
      validated,
      alertSummaries,
      issueTrackers,
      fetchAlertSummaries,
      updateViewState,
      bugTemplate,
      modifyAlert,
    } = this.props;
    const {
      alertSummary,
      downstreamIds,
      filteredAlerts,
      allSelected,
      selectedAlerts,
    } = this.state;

    const downstreamIdsLength = downstreamIds.length;
    const repo = alertSummary
      ? validated.projects.find(repo => repo.name === alertSummary.repository)
      : null;
    const repoModel = new RepositoryModel(repo);

    return (
      <Container fluid className="px-0 max-width-default">
        <ErrorBoundary
          errorClasses={errorMessageClass}
          message={genericErrorMessage}
        >
          {filteredAlerts.length > 0 && alertSummary && (
            <Form>
              <Table className="compare-table mb-0">
                <thead>
                  <tr className="bg-lightgray border">
                    <th
                      colSpan="8"
                      className="text-left alert-summary-header-element"
                    >
                      <FormGroup check>
                        <Label check className="pl-1">
                          <Input
                            data-testid={`alert summary ${alertSummary.id.toString()} checkbox`}
                            aria-labelledby={`alert summary ${alertSummary.id.toString()} title`}
                            type="checkbox"
                            checked={allSelected}
                            disabled={!user.isStaff}
                            onChange={() =>
                              this.setState({
                                allSelected: !allSelected,
                                selectedAlerts: !allSelected
                                  ? [...alertSummary.alerts]
                                  : [],
                              })
                            }
                          />
                          <AlertHeader
                            alertSummary={alertSummary}
                            repoModel={repoModel}
                            issueTrackers={issueTrackers}
                          />
                        </Label>
                      </FormGroup>
                    </th>
                    <th className="table-width-sm align-top font-weight-normal">
                      <StatusDropdown
                        alertSummary={alertSummary}
                        updateState={state => this.setState(state)}
                        repoModel={repoModel}
                        updateViewState={updateViewState}
                        issueTrackers={issueTrackers}
                        bugTemplate={bugTemplate}
                        user={user}
                        filteredAlerts={filteredAlerts}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map(alert => (
                    <AlertTableRow
                      key={alert.id}
                      alertSummary={alertSummary}
                      alert={alert}
                      user={user}
                      updateSelectedAlerts={alerts => this.setState(alerts)}
                      selectedAlerts={selectedAlerts}
                      updateViewState={updateViewState}
                      modifyAlert={modifyAlert}
                    />
                  ))}
                  {downstreamIdsLength > 0 && (
                    <tr
                      className={`${
                        alertSummary.notes
                          ? 'border-top border-left border-right'
                          : 'border'
                      }`}
                    >
                      <td
                        colSpan="9"
                        className="text-left text-muted pl-3 py-4"
                      >
                        <span className="font-weight-bold">
                          Downstream alert summaries:{' '}
                        </span>
                        {downstreamIds.map((id, index) => (
                          <DownstreamSummary
                            key={id}
                            id={id}
                            alertSummaries={alertSummaries}
                            position={downstreamIdsLength - 1 - index}
                            updateViewState={updateViewState}
                          />
                        ))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
              {alertSummary.notes ||
              allSelected ||
              selectedAlerts.length > 0 ? (
                <div className="border mb-4 sticky-footer max-width-default text-left text-muted p-0">
                  {alertSummary.notes && (
                    <div className="bg-white px-3 py-4">
                      <TruncatedText
                        title="Notes: "
                        maxLength={167}
                        text={alertSummary.notes}
                        showMoreClass="text-info"
                      />
                    </div>
                  )}
                  {selectedAlerts.length > 0 && (
                    <AlertActionPanel
                      selectedAlerts={selectedAlerts}
                      allSelected={allSelected}
                      alertSummaries={alertSummaries}
                      alertSummary={alertSummary}
                      fetchAlertSummaries={fetchAlertSummaries}
                      updateState={state => this.setState(state)}
                      updateViewState={updateViewState}
                      modifyAlert={modifyAlert}
                    />
                  )}
                </div>
              ) : (
                <br />
              )}
            </Form>
          )}
        </ErrorBoundary>
      </Container>
    );
  }
}

AlertTable.propTypes = {
  alertSummary: PropTypes.shape({}),
  user: PropTypes.shape({}),
  validated: PropTypes.shape({
    projects: PropTypes.arrayOf(PropTypes.shape({})),
  }).isRequired,
  alertSummaries: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  issueTrackers: PropTypes.arrayOf(PropTypes.shape({})),
  optionCollectionMap: PropTypes.shape({}).isRequired,
  filters: PropTypes.shape({
    filterText: PropTypes.string,
    hideDownstream: PropTypes.bool,
    hideImprovements: PropTypes.bool,
  }).isRequired,
  fetchAlertSummaries: PropTypes.func.isRequired,
  updateViewState: PropTypes.func.isRequired,
  bugTemplate: PropTypes.shape({}),
  modifyAlert: PropTypes.func,
};

AlertTable.defaultProps = {
  alertSummary: null,
  user: null,
  issueTrackers: [],
  bugTemplate: null,
  modifyAlert: undefined,
};
