import React from 'react';
import PropTypes from 'prop-types';
import { Container, Form, FormGroup, Table, Row, Col } from 'reactstrap';
import orderBy from 'lodash/orderBy';

import {
  alertStatusMap,
  maximumVisibleAlertSummaryRows,
  browsertimeId,
} from '../perf-helpers/constants';
import {
  genericErrorMessage,
  errorMessageClass,
} from '../../helpers/constants';
import RepositoryModel from '../../models/repository';
import {
  getInitializedAlerts,
  containsText,
  updateAlertSummary,
} from '../perf-helpers/helpers';
import TruncatedText from '../../shared/TruncatedText';
import ErrorBoundary from '../../shared/ErrorBoundary';
import TableColumnHeader from '../shared/TableColumnHeader';
import SortButtonDisabled from '../shared/SortButtonDisabled';
import { tableSort, getNextSort, sort, sortTables } from '../perf-helpers/sort';

import AlertTableRow from './AlertTableRow';
import AlertHeader from './AlertHeader';
import StatusDropdown from './StatusDropdown';
import DownstreamSummary from './DownstreamSummary';
import AlertActionPanel from './AlertActionPanel';
import SelectAlertsDropdown from './SelectAlertsDropdown';
import CollapsableRows from './CollapsableRows';

export default class AlertTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      alertSummary: null,
      downstreamIds: [],
      filteredAlerts: [],
      filteredAndSortedAlerts: [],
      allSelected: false,
      selectedAlerts: [],
      tableConfig: {
        Test: {
          name: 'Test',
          sortValue: 'title',
          currentSort: tableSort.default,
        },
        Platform: {
          name: 'Platform',
          sortValue: 'machine_platform',
          currentSort: tableSort.default,
        },
        TagsOptions: {
          name: 'Tags & Options',
          sortValue: 'tags',
          currentSort: tableSort.default,
        },
        Magnitude: {
          name: 'Magnitude of Change',
          sortValue: 'amount_abs',
          currentSort: tableSort.default,
        },
        Confidence: {
          name: 'Confidence',
          sortValue: 't_value',
          currentSort: tableSort.default,
        },
        DebuggingInformation: {
          name: 'Debug Tools',
          sortValue: '',
          currentSort: tableSort.default,
        },
        NoiseProfile: {
          name: 'Information',
          sortValue: 'noise_profile',
          currentSort: tableSort.default,
        },
      },
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
          .map((alert) => {
            if (
              alert.status === alertStatusMap.downstream &&
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

  filterAlert = (alert) => {
    const {
      hideDownstream,
      hideAssignedToOthers,
      filterText,
    } = this.props.filters;
    const { username } = this.props.user;
    const { alertSummary } = this.state;

    const notRelatedDownstream =
      alert.summary_id === alertSummary.id ||
      alert.status !== alertStatusMap.downstream;
    const concealableReassigned =
      hideDownstream &&
      alert.status === alertStatusMap.reassigned &&
      alert.related_summary_id !== alertSummary.id;
    const concealableDownstream =
      hideDownstream && alert.status === alertStatusMap.downstream;
    const concealableInvalid =
      hideDownstream && alert.status === alertStatusMap.invalid;
    const concealableAssignedToOthers =
      hideAssignedToOthers && alertSummary.assignee_username !== username;

    const matchesFilters =
      notRelatedDownstream &&
      !concealableReassigned &&
      !concealableDownstream &&
      !concealableInvalid &&
      !concealableAssignedToOthers;

    if (!filterText) return matchesFilters;

    const textToTest = `${alert.title} ${
      alertSummary.bug_number && alertSummary.bug_number.toString()
    } ${alertSummary.revision.toString()}`;

    // searching with filter input and one or more metricFilter buttons on
    // will produce different results compared to when all filters are off
    return containsText(textToTest, filterText) && matchesFilters;
  };

  getAlertsSortedByDefault = (filteredAlerts) => {
    const fields = [
      'starred',
      'backfill_record',
      'is_regression',
      't_value',
      'amount_abs',
      'title',
    ];
    const sortOrders = ['desc', 'asc', 'desc', 'desc', 'desc', 'asc'];
    return orderBy(filteredAlerts, fields, sortOrders);
  };

  updateFilteredAlerts = () => {
    const { alertSummary, tableConfig } = this.state;
    Object.keys(tableConfig).forEach((key) => {
      tableConfig[key].currentSort = tableSort.default;
    });

    const filteredAlerts = alertSummary.alerts.filter((alert) =>
      this.filterAlert(alert),
    );
    const filteredAndSortedAlerts = this.getAlertsSortedByDefault(
      filteredAlerts,
    );
    this.setState({
      tableConfig,
      filteredAlerts,
      filteredAndSortedAlerts,
      allSelected: false,
      selectedAlerts: [],
    });
  };

  updateAssignee = async (newAssigneeUsername) => {
    const {
      updateAlertSummary,
      updateViewState,
      fetchAlertSummaries,
    } = this.props;
    const { alertSummary } = this.state;

    const { data, failureStatus } = await updateAlertSummary(alertSummary.id, {
      assignee_username: newAssigneeUsername,
    });

    if (!failureStatus) {
      // now refresh UI, by syncing with backend
      fetchAlertSummaries(alertSummary.id);
    } else {
      updateViewState({
        errorMessages: [
          `Failed to set new assignee "${newAssigneeUsername}". (${data})`,
        ],
      });
    }

    return { failureStatus };
  };

  changeRevision = async (newRevisionTo, newRevisionFrom) => {
    const {
      updateAlertSummary,
      updateViewState,
      fetchAlertSummaries,
    } = this.props;
    const { alertSummary } = this.state;
    const { data, failureStatus } = await updateAlertSummary(alertSummary.id, {
      revision: newRevisionTo,
      prev_push_revision: newRevisionFrom,
    });

    if (!failureStatus) {
      // now refresh UI, by syncing with backend
      fetchAlertSummaries(alertSummary.id);
    } else {
      updateViewState({
        errorMessages: [`Failed to set revisions. (${data})`],
      });
    }

    return { failureStatus };
  };

  setSelectedAlerts = ({ selectedAlerts, allSelected }) =>
    this.setState({
      selectedAlerts,
      allSelected,
    });

  onChangeSort = (currentColumn) => {
    const { tableConfig } = this.state;
    const { filteredAlerts } = this.state;
    const { default: defaultSort } = tableSort;
    const { currentSort, sortValue } = currentColumn;
    const nextSort = getNextSort(currentSort);

    Object.keys(tableConfig).forEach((key) => {
      tableConfig[key].currentSort = defaultSort;
    });
    currentColumn.currentSort = nextSort;
    let filteredAndSortedAlerts = this.getAlertsSortedByDefault(filteredAlerts);
    if (nextSort !== defaultSort) {
      filteredAndSortedAlerts = sort(
        sortValue,
        nextSort,
        filteredAlerts,
        sortTables.alert,
      );
    }

    this.setState({ filteredAndSortedAlerts, tableConfig });
  };

  render() {
    const {
      user,
      projects,
      frameworks,
      alertSummaries,
      issueTrackers,
      fetchAlertSummaries,
      updateViewState,
      modifyAlert,
      performanceTags,
    } = this.props;
    const {
      alertSummary,
      downstreamIds,
      filteredAlerts,
      allSelected,
      selectedAlerts,
      tableConfig,
      filteredAndSortedAlerts,
    } = this.state;

    const downstreamIdsLength = downstreamIds.length;
    const repo = alertSummary
      ? projects.find((repo) => repo.name === alertSummary.repository)
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
              <Container fluid className="bg-lightgray border">
                <Row className="px-0 max-width-default">
                  <Col
                    xs={10}
                    className="text-left alert-summary-header-element"
                  >
                    <FormGroup check className="d-inline-flex">
                      <SelectAlertsDropdown
                        setSelectedAlerts={this.setSelectedAlerts}
                        user={user}
                        filteredAlerts={filteredAlerts}
                        allSelected={allSelected}
                        alertSummaryId={alertSummary.id.toString()}
                      />
                      <AlertHeader
                        frameworks={frameworks}
                        alertSummary={alertSummary}
                        repoModel={repoModel}
                        issueTrackers={issueTrackers}
                        user={user}
                        updateAssignee={this.updateAssignee}
                        changeRevision={this.changeRevision}
                        updateViewState={updateViewState}
                      />
                    </FormGroup>
                  </Col>
                  <Col className="d-flex justify-content-end p-2">
                    <StatusDropdown
                      alertSummary={alertSummary}
                      updateState={(state) => this.setState(state)}
                      repoModel={repoModel}
                      updateViewState={updateViewState}
                      issueTrackers={issueTrackers}
                      user={user}
                      filteredAlerts={filteredAlerts}
                      frameworks={frameworks}
                      performanceTags={performanceTags}
                    />
                  </Col>
                </Row>
              </Container>

              <Table className="compare-table mb-0">
                <tbody>
                  <tr className="border subtest-header">
                    <th aria-label="Select alerts"> </th>
                    <th aria-label="Star alert or open graph"> </th>
                    <th className="align-bottom">
                      <TableColumnHeader
                        column={tableConfig.Test}
                        data-testid={`${alertSummary.id} ${tableConfig.Test}`}
                        onChangeSort={this.onChangeSort}
                      />
                    </th>
                    <th className="align-bottom">
                      <TableColumnHeader
                        column={tableConfig.Platform}
                        onChangeSort={this.onChangeSort}
                      />
                    </th>
                    {alertSummary.framework === browsertimeId && (
                      <th className="align-bottom text-nowrap">
                        <span
                          data-testid={`${alertSummary.id} ${tableConfig.DebuggingInformation.name}`}
                        >
                          {tableConfig.DebuggingInformation.name}
                        </span>
                        <SortButtonDisabled
                          column={tableConfig.DebuggingInformation}
                        />
                      </th>
                    )}
                    <th className="align-bottom">
                      <TableColumnHeader
                        column={tableConfig.NoiseProfile}
                        onChangeSort={this.onChangeSort}
                      />
                    </th>
                    <th className="align-bottom text-nowrap">
                      <span>{tableConfig.TagsOptions.name}</span>
                      <SortButtonDisabled column={tableConfig.TagsOptions} />
                    </th>
                    <th className="align-bottom">
                      <TableColumnHeader
                        column={tableConfig.Magnitude}
                        onChangeSort={this.onChangeSort}
                      />
                    </th>
                    <th className="align-bottom">
                      <TableColumnHeader
                        column={tableConfig.Confidence}
                        onChangeSort={this.onChangeSort}
                      />
                    </th>
                  </tr>
                  {filteredAndSortedAlerts.length <=
                    maximumVisibleAlertSummaryRows &&
                    filteredAndSortedAlerts.map((alert) => (
                      <AlertTableRow
                        key={alert.id}
                        alertSummary={alertSummary}
                        alert={alert}
                        frameworks={frameworks}
                        user={user}
                        updateSelectedAlerts={(alerts) => this.setState(alerts)}
                        selectedAlerts={selectedAlerts}
                        updateViewState={updateViewState}
                        modifyAlert={modifyAlert}
                        fetchAlertSummaries={fetchAlertSummaries}
                      />
                    ))}
                  {filteredAndSortedAlerts.length >
                    maximumVisibleAlertSummaryRows && (
                    <CollapsableRows
                      filteredAndSortedAlerts={filteredAndSortedAlerts}
                      alertSummary={alertSummary}
                      frameworks={frameworks}
                      user={user}
                      updateSelectedAlerts={(alerts) => this.setState(alerts)}
                      selectedAlerts={selectedAlerts}
                      updateViewState={updateViewState}
                      modifyAlert={modifyAlert}
                      fetchAlertSummaries={fetchAlertSummaries}
                    />
                  )}
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
                        color="darker-info"
                        title="Notes: "
                        maxLength={167}
                        text={alertSummary.notes}
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
                      updateState={(state) => this.setState(state)}
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
  user: PropTypes.shape({}).isRequired,
  alertSummaries: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  issueTrackers: PropTypes.arrayOf(PropTypes.shape({})),
  optionCollectionMap: PropTypes.shape({}).isRequired,
  filters: PropTypes.shape({
    filterText: PropTypes.string,
    hideDownstream: PropTypes.bool,
    hideAssignedToOthers: PropTypes.bool,
  }).isRequired,
  fetchAlertSummaries: PropTypes.func.isRequired,
  updateViewState: PropTypes.func.isRequired,
  modifyAlert: PropTypes.func,
  updateAlertSummary: PropTypes.func,
  projects: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  performanceTags: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

AlertTable.defaultProps = {
  alertSummary: null,
  issueTrackers: [],
  modifyAlert: undefined,
  // leverage dependency injection
  // to improve code testability
  updateAlertSummary,
};
