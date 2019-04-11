import React from 'react';
import PropTypes from 'prop-types';
import { Container, Form, FormGroup, Label, Input, Table } from 'reactstrap';
import orderBy from 'lodash/orderBy';

import {
  phAlertStatusMap,
  phDefaultTimeRangeValue,
  phTimeRanges,
} from '../../helpers/constants';
import RepositoryModel from '../../models/repository';
import { getInitializedAlerts } from '../helpers';
import TruncatedText from '../../shared/TruncatedText';

import AlertHeader from './AlertHeader';
import StatusDropdown from './StatusDropdown';
import AlertTableRow from './AlertTableRow';
import DownstreamSummary from './DownstreamSummary';

// TODO
// * if there are no alerts after filtering, that alertSummaryTable should not be shown
// and it shouldn't be shown if there aren't actually any alerts

export default class AlertTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      alertSummary: null,
      downstreamIds: [],
      filteredAlerts: [],
    };
  }

  componentDidMount() {
    this.processAlerts();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.filters !== this.props.filters) {
      this.updateFilteredAlerts();
    }
    if (prevProps.alertSummary !== this.props.alertSummary) {
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

  selectAlerts = () => {
    const { alertSummary: oldAlertSummary } = this.state;
    const alertSummary = { ...oldAlertSummary };
    alertSummary.allSelected = !alertSummary.allSelected;

    alertSummary.alerts.forEach(function selectAlerts(alert) {
      alert.selected = alert.visible && alertSummary.allSelected;
    });
    this.setState({ alertSummary });
  };

  // TODO move to alertTableRow
  getTimeRange = () => {
    const { alertSummary } = this.state;

    const defaultTimeRange =
      alertSummary.repository === 'mozilla-beta'
        ? 7776000
        : phDefaultTimeRangeValue;
    const timeRange = Math.max(
      defaultTimeRange,
      phTimeRanges
        .map(time => time.value)
        .find(
          value => Date.now() / 1000.0 - alertSummary.push_timestamp < value,
        ),
    );

    return timeRange;
  };

  filterAlert = alert => {
    const { hideImprovements, hideDownstream, filterText } = this.props.filters;
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

    const words = filterText
      .split(' ')
      .map(word => `(?=.*${word})`)
      .join('');
    const regex = RegExp(words, 'gi');
    const text = `${alert.title} ${alertSummary.bug_number &&
      alertSummary.bug_number.toString()} ${alertSummary.revision.toString()}`;

    // searching with filter input and one or more metricFilter buttons on
    // will produce different results compared to when all filters are off
    return regex.test(text) && matchesFilters;
  };

  updateFilteredAlerts = () => {
    const { alertSummary } = this.state;
    const filteredAlerts = alertSummary.alerts.filter(alert =>
      this.filterAlert(alert),
    );
    this.setState({ filteredAlerts });
  };

  render() {
    const { user, validated, alertSummaries, issueTrackers } = this.props;
    const { alertSummary, downstreamIds, filteredAlerts } = this.state;

    const downstreamIdsLength = downstreamIds.length;
    const repo = alertSummary
      ? validated.projects.find(repo => repo.name === alertSummary.repository)
      : null;
    const repoModel = new RepositoryModel(repo);

    return (
      <Container fluid className="px-0 max-width-default">
        {filteredAlerts.length > 0 && (
          <Form>
            {alertSummary && (
              <Table className="compare-table">
                <thead>
                  <tr className="bg-lightgray border">
                    <th
                      colSpan="8"
                      className="text-left alert-summary-header-element"
                    >
                      <FormGroup check>
                        <Label check className="pl-1">
                          <Input
                            type="checkbox"
                            disabled={!user.isStaff}
                            onClick={this.selectAlerts}
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
                        user={user}
                        updateState={alertSummary =>
                          this.setState({ alertSummary })
                        }
                        repoModel={repoModel}
                        issueTrackers={issueTrackers}
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
                      timeRange={this.getTimeRange()}
                    />
                  ))}
                  {downstreamIdsLength > 0 && (
                    <tr className="border">
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
                          />
                        ))}
                      </td>
                    </tr>
                  )}
                  {alertSummary.notes && (
                    <tr className="border">
                      <td
                        colSpan="9"
                        className="max-width-row-text text-left text-muted pl-3 py-4"
                      >
                        <TruncatedText
                          title="Notes: "
                          maxLength={167}
                          text={alertSummary.notes}
                          showMoreClass="text-info"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            )}
          </Form>
        )}
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
};

AlertTable.defaultProps = {
  alertSummary: null,
  user: null,
  issueTrackers: [],
};
