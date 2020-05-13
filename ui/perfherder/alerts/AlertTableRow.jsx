/* eslint-disable react/no-did-update-set-state */

import React from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStar as faStarSolid,
  faUser,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';

import { createQueryParams } from '../../helpers/url';
import { getStatus, getGraphsURL, modifyAlert, formatNumber } from '../helpers';
import SimpleTooltip from '../../shared/SimpleTooltip';
import ProgressBar from '../../shared/ProgressBar';
import {
  alertStatusMap,
  backfillRetriggeredTitle,
  phDefaultTimeRangeValue,
  phTimeRanges,
} from '../constants';

export default class AlertTableRow extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      starred: this.props.alert.starred,
      checkboxSelected: false,
    };
  }

  componentDidUpdate(prevProps) {
    const { selectedAlerts, alert } = this.props;

    // reset alert checkbox when an action is taken in the AlertActionPanel
    // (it resets selectedAlerts) or an individual alert has been deselected
    // and removed from selectedAlerts
    if (prevProps.selectedAlerts !== selectedAlerts) {
      if (!selectedAlerts.length) {
        this.setState({ checkboxSelected: false });
      } else {
        const index = selectedAlerts.findIndex((item) => item.id === alert.id);
        this.setState({ checkboxSelected: index !== -1 });
      }
    }
  }

  getTimeRange = () => {
    const { alertSummary } = this.props;

    const defaultTimeRange =
      alertSummary.repository === 'mozilla-beta'
        ? 7776000
        : phDefaultTimeRangeValue;
    const timeRange = Math.max(
      defaultTimeRange,
      phTimeRanges
        .map((time) => time.value)
        .find(
          (value) => Date.now() / 1000.0 - alertSummary.push_timestamp <= value,
        ),
    );
    // default value of one year, for one a push_timestamp exceeds the one year value slightly
    return timeRange || 31536000;
  };

  toggleStar = async () => {
    const { starred } = this.state;
    const { alert } = this.props;
    const updatedStar = {
      starred: !starred,
    };
    // passed as prop only for testing purposes
    const { data, failureStatus } = await this.props.modifyAlert(
      alert,
      updatedStar,
    );

    if (failureStatus) {
      return this.props.updateViewState({
        errorMessages: [`Failed to update alert ${alert.id}: ${data}`],
      });
    }
    this.setState(updatedStar);
  };

  getReassignment = (alert) => {
    let text = 'to';
    let alertId = alert.related_summary_id;

    if (alert.related_summary_id === this.props.alertSummary.id) {
      text = 'from';
      alertId = alert.summary_id;
    }
    return (
      <span>
        {` ${text} `}
        <a
          href={`#/alerts?id=${alertId}`}
          rel="noopener noreferrer"
          className="text-darker-info"
        >{`alert #${alertId}`}</a>
      </span>
    );
  };

  updateCheckbox = () => {
    const { updateSelectedAlerts, selectedAlerts, alert } = this.props;
    const { checkboxSelected } = this.state;

    const index = selectedAlerts.findIndex((item) => item.id === alert.id);

    if (checkboxSelected && index === -1) {
      return updateSelectedAlerts({
        selectedAlerts: [...selectedAlerts, alert],
      });
    }

    if (!checkboxSelected && index !== -1) {
      selectedAlerts.splice(index, 1);
      return updateSelectedAlerts({ selectedAlerts, allSelected: false });
    }
  };

  renderAlertStatus = (alert, alertStatus, statusColor) => {
    return (
      <React.Fragment>
        (
        {statusColor === 'text-success' && (
          <FontAwesomeIcon icon={faCheck} color="#28a745" />
        )}{' '}
        <span className={statusColor}>{alertStatus}</span>
        {alert.related_summary_id && this.getReassignment(alert)}
        {alert.backfill_record ? (
          <span className="text-darker-info">, important</span>
        ) : null}
        )
      </React.Fragment>
    );
  };

  getTitleText = (alert, alertStatus) => {
    const { repository, framework, id } = this.props.alertSummary;

    let statusColor = '';
    let textEffect = '';
    if (alertStatus === 'invalid') {
      statusColor = 'text-danger';
    }
    if (alertStatus === 'untriaged') {
      statusColor = 'text-success';
    }
    if (
      alertStatus === 'invalid' ||
      (alert.related_summary_id && alert.related_summary_id !== id)
    ) {
      textEffect = 'strike-through';
    }
    const timeRange = this.getTimeRange();
    return (
      <span>
        <span
          className={textEffect}
          id={`alert ${alert.id} title`}
          title={alert.backfill_record ? backfillRetriggeredTitle : ''}
        >
          {alert.title}
        </span>{' '}
        {this.renderAlertStatus(alert, alertStatus, statusColor)}
        <span className="result-links">
          <a
            href={getGraphsURL(alert, timeRange, repository, framework)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {' '}
            graph
          </a>
          {alert.series_signature.has_subtests && (
            <a
              href={this.getSubtestsURL()}
              target="_blank"
              rel="noopener noreferrer"
            >
              {' '}
              · subtests
            </a>
          )}
        </span>
      </span>
    );
  };

  // arbitrary scale from 0-20% multiplied by 5, capped
  // at 100 (so 20% regression === 100% bad)
  getCappedMagnitude = (percent) => Math.min(Math.abs(percent) * 5, 100);

  getSubtestsURL = () => {
    const { alert, alertSummary } = this.props;
    const urlParameters = {
      framework: alertSummary.framework,
      originalProject: alertSummary.repository,
      originalSignature: alert.series_signature.id,
      newProject: alertSummary.repository,
      newSignature: alert.series_signature.id,
      originalRevision: alertSummary.prev_push_revision,
      newRevision: alertSummary.revision,
    };

    return `#/comparesubtest${createQueryParams(urlParameters)}`;
  };

  render() {
    const { user, alert, alertSummary } = this.props;
    const { starred, checkboxSelected } = this.state;

    const alertStatus = getStatus(alert.status, alertStatusMap);
    const tooltipText = alert.classifier_email
      ? `Classified by ${alert.classifier_email}`
      : 'Classified automatically';
    const bookmarkClass = starred ? 'visible' : '';

    return (
      <tr
        className={
          alertSummary.notes ? 'border-top border-left border-right' : 'border'
        }
        data-testid={alert.id}
      >
        <td className="table-width-xs px-1">
          <FormGroup check className="ml-2 pl-4">
            <Label hidden>alert {alert.id} title</Label>
            <Input
              aria-label={`alert ${alert.id} title`}
              data-testid={`alert ${alert.id} checkbox`}
              type="checkbox"
              disabled={!user.isStaff}
              checked={checkboxSelected}
              onChange={() =>
                this.setState(
                  { checkboxSelected: !checkboxSelected },
                  this.updateCheckbox,
                )
              }
            />
          </FormGroup>
        </td>
        <td className="px-0">
          <Button
            color="black"
            aria-label={
              starred
                ? 'Remove bookmark from this Alert'
                : 'Bookmark this Alert'
            }
            className={`${bookmarkClass} border p-0 border-0 bg-transparent`}
            data-testid={`alert ${alert.id.toString()} star`}
            onClick={this.toggleStar}
          >
            <FontAwesomeIcon
              title={starred ? 'starred' : 'not starred'}
              icon={starred ? faStarSolid : faStarRegular}
            />
          </Button>
        </td>
        <td className="text-left">
          {alertStatus !== 'untriaged' ? (
            <SimpleTooltip
              text={this.getTitleText(alert, alertStatus)}
              tooltipText={tooltipText}
            />
          ) : (
            this.getTitleText(alert, alertStatus)
          )}
        </td>
        <td className="table-width-md">{formatNumber(alert.prev_value)}</td>
        <td className="table-width-sm">
          <span
            className={alert.is_regression ? 'text-danger' : 'text-success'}
          >
            {alert.prev_value < alert.new_value && <span>&lt;</span>}
            {alert.prev_value > alert.new_value && <span>&gt;</span>}
          </span>
        </td>
        <td className="table-width-md">{formatNumber(alert.new_value)}</td>
        <td className="table-width-md">
          <SimpleTooltip
            textClass="detail-hint"
            text={`${alert.amount_pct}%`}
            tooltipText={`Absolute difference: ${alert.amount_abs}`}
          />
        </td>
        <td className="table-width-lg">
          <ProgressBar
            magnitude={this.getCappedMagnitude(alert.amount_pct)}
            regression={alert.is_regression}
            color={!alert.is_regression ? 'success' : 'danger'}
          />
        </td>
        <td className="table-width-sm">
          <SimpleTooltip
            textClass="detail-hint"
            text={
              alert.manually_created ? (
                <FontAwesomeIcon
                  title="Alert created by a Sheriff"
                  icon={faUser}
                />
              ) : (
                formatNumber(alert.t_value)
              )
            }
            tooltipText={
              alert.manually_created
                ? 'Alert created by a Sheriff'
                : 'Confidence value as calculated by Perfherder alerts. Note that this is NOT the same as the calculation used in the compare view'
            }
          />
        </td>
      </tr>
    );
  }
}

AlertTableRow.propTypes = {
  alertSummary: PropTypes.shape({
    repository: PropTypes.string,
    framework: PropTypes.number,
    id: PropTypes.number,
  }).isRequired,
  user: PropTypes.shape({}),
  alert: PropTypes.shape({
    starred: PropTypes.bool,
  }).isRequired,
  updateSelectedAlerts: PropTypes.func.isRequired,
  selectedAlerts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  updateViewState: PropTypes.func.isRequired,
  modifyAlert: PropTypes.func,
};

AlertTableRow.defaultProps = {
  user: null,
  modifyAlert,
};
