/* eslint-disable react/no-did-update-set-state */

import React from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStar as faStarSolid,
  faUser,
  faCheck,
  faChartLine,
  faFire,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { Link } from 'react-router-dom';

import { createQueryParams } from '../../helpers/url';
import {
  getStatus,
  getGraphsURL,
  modifyAlert,
  formatNumber,
  getFrameworkName,
  getTimeRange,
} from '../perf-helpers/helpers';
import SimpleTooltip from '../../shared/SimpleTooltip';
import {
  alertStatusMap,
  alertBackfillResultStatusMap,
  alertBackfillResultVisual,
  backfillRetriggeredTitle,
  noiseProfiles,
} from '../perf-helpers/constants';
import { Perfdocs } from '../perf-helpers/perfdocs';

import AlertTablePlatform from './AlertTablePlatform';
import AlertTableTagsOptions from './AlertTableTagsOptions';
import Magnitude from './Magnitude';
import BadgeTooltip from './BadgeTooltip';

export default class AlertTableRow extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      starred: this.props.alert.starred,
      checkboxSelected: false,
      icons: [],
    };
  }

  componentDidMount() {
    const { alert } = this.props;

    this.showCriticalMagnitudeIcons(alert);
  }

  componentDidUpdate(prevProps) {
    const { selectedAlerts, alert } = this.props;

    // reset alert checkbox when an action is taken in the AlertActionPanell
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

  toggleStar = async () => {
    const { starred } = this.state;
    const { alert, fetchAlertSummaries, alertSummary } = this.props;
    const updatedStar = {
      starred: !starred,
    };
    // passed as prop only for testing purposes
    const { data, failureStatus } = await this.props.modifyAlert(
      alert,
      updatedStar,
    );

    if (!failureStatus) {
      // now refresh UI, by syncing with backend
      fetchAlertSummaries(alertSummary.id);
    } else {
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
        <Link
          to={`./alerts?id=${alertId}`}
          className="text-darker-info"
        >{`alert #${alertId}`}</Link>
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
        )}
        <span className={statusColor}>{alertStatus}</span>
        {alert.related_summary_id && this.getReassignment(alert)})
      </React.Fragment>
    );
  };

  getBackfillStatusInfo = (alert) => {
    if (!alert.backfill_record || alert.backfill_record.status === undefined)
      return null;
    const statusesToDisplayTasksCount = ['backfilled', 'successful', 'failed'];
    const backfillStatus = getStatus(
      alert.backfill_record.status,
      alertBackfillResultStatusMap,
    );

    const alertBackfillStatus = alertBackfillResultVisual[backfillStatus];
    // Added only for testing locally the UI changes
    // To be removed once this is in production
    alertBackfillStatus.backfillsFailed =
      alert.backfill_record.total_backfills_failed || 0;
    alertBackfillStatus.backfillsSuccessful =
      alert.backfill_record.total_backfills_successful || 0;
    alertBackfillStatus.backfillsInProgress =
      alert.backfill_record.total_backfills_in_progress || 0;

    if (
      statusesToDisplayTasksCount.includes(backfillStatus) &&
      // the next checks are here to not confuse users
      // since we won't have count for tasks right away
      // to be removed after changes are in prod
      (alertBackfillStatus.backfillsFailed !== 0 ||
        alertBackfillStatus.backfillsInProgress !== 0 ||
        alertBackfillStatus.backfillsSuccessful !== 0)
    )
      alertBackfillStatus.displayTasksCount = true;

    return alertBackfillStatus;
  };

  getTitleText = (alert, alertStatus) => {
    const { framework, id } = this.props.alertSummary;
    const { frameworks } = this.props;

    let statusColor = '';
    let textEffect = '';
    if (alertStatus === 'invalid') {
      statusColor = 'text-danger';
    }
    if (alertStatus === 'untriaged') {
      statusColor = 'text-warning';
    }
    if (
      alertStatus === 'invalid' ||
      (alert.related_summary_id && alert.related_summary_id !== id)
    ) {
      textEffect = 'strike-through';
    }
    const frameworkName = getFrameworkName(frameworks, framework);
    const { title } = alert;
    const { suite, test, machine_platform: platform } = alert.series_signature;
    const perfdocs = new Perfdocs(frameworkName, suite, platform, title);
    const hasDocumentation = perfdocs.hasDocumentation();
    const duplicatedName = suite === test;

    return (
      <div className="alert-title-container">
        <div
          className={`alert-title ${textEffect}`}
          id={`alert ${alert.id} title`}
          title={alert.backfill_record ? backfillRetriggeredTitle : ''}
        >
          {hasDocumentation && alert.title ? (
            <span
              className="alert-docs"
              data-testid={`alert ${alert.id} title`}
            >
              <a
                data-testid="docs"
                href={perfdocs.documentationURL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {suite}
              </a>{' '}
              {!duplicatedName && test}
            </span>
          ) : (
            <span data-testid={`alert ${alert.id} title`}>
              {suite} {!duplicatedName && test}
            </span>
          )}
        </div>
        <div>
          {this.renderAlertStatus(alert, alertStatus, statusColor)}{' '}
          <span className="result-links">
            {alert.series_signature.has_subtests && (
              <a
                href={this.getSubtestsURL()}
                target="_blank"
                rel="noopener noreferrer"
              >
                · subtests
              </a>
            )}
          </span>
        </div>
      </div>
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

    return `./comparesubtest${createQueryParams(urlParameters)}`;
  };

  showCriticalMagnitudeIcons(alert) {
    const alertMagnitude = Math.round(alert.amount_pct);
    const alertNewValue = alert.new_value;
    let numberOfIcons = 0;
    let exceedsMaximumIcons = false;

    if (alert.is_regression) {
      if (
        alertMagnitude >= 100 &&
        alertNewValue !== 0 &&
        alertMagnitude < 200
      ) {
        numberOfIcons = 1;
      } else if (alertMagnitude >= 200 && alertMagnitude < 300) {
        numberOfIcons = 2;
      } else if (alertMagnitude === 300) {
        numberOfIcons = 3;
      } else if (alertMagnitude > 300) {
        numberOfIcons = 3;
        exceedsMaximumIcons = true;
      }
    } else if (alertMagnitude === 100 && alertNewValue === 0) {
      this.setState((prevState) => ({
        icons: [
          ...prevState.icons,
          <SimpleTooltip
            key={alert.id}
            text={
              <FontAwesomeIcon
                icon={faFire}
                className="icon-green-flame icon"
              />
            }
            tooltipText="This should be treated as a regression"
          />,
        ],
      }));
    }

    for (let i = 0; i < numberOfIcons; i++) {
      this.setState((prevState) => ({
        icons: [
          ...prevState.icons,
          <SimpleTooltip
            key={i}
            text={<FontAwesomeIcon icon={faFire} className="icon" />}
            tooltipText="Magnitude"
          />,
        ],
      }));

      if (exceedsMaximumIcons && i === numberOfIcons - 1) {
        this.setState((prevState) => ({
          icons: [
            ...prevState.icons,
            <FontAwesomeIcon
              key={i + 1}
              icon={faPlus}
              className="icon-plus icon"
            />,
          ],
        }));
      }
    }
  }

  render() {
    const { user, alert, alertSummary } = this.props;
    const { starred, checkboxSelected, icons } = this.state;
    const { repository, framework } = alertSummary;

    const { tags, extra_options: options } = alert.series_signature;

    const tagsAndOptions = tags.concat(options);
    const stripDuplicates = new Set(tagsAndOptions.filter((item) => item));
    const items = Array.from(stripDuplicates).map((element) => ({
      name: element,
      tag: tags.includes(element),
      option: options.includes(element),
      tagAndOption: tags.includes(element) && options.includes(element),
    }));

    const timeRange = getTimeRange(alertSummary);

    const alertStatus = getStatus(alert.status, alertStatusMap);
    const tooltipText = alert.classifier_email
      ? `Classified by ${alert.classifier_email}`
      : 'Classified automatically';
    const bookmarkClass = starred ? 'visible' : '';
    const noiseProfile = alert.noise_profile || 'N\\A';
    const noiseProfileTooltip = alert.noise_profile
      ? noiseProfiles[alert.noise_profile.replace('/', '')]
      : noiseProfiles.NA;

    const backfillStatusInfo = this.getBackfillStatusInfo(alert);
    let sherlockTooltip = backfillStatusInfo && backfillStatusInfo.message;
    if (backfillStatusInfo && backfillStatusInfo.displayTasksCount) {
      sherlockTooltip = (
        <>
          <i>{backfillStatusInfo.message}</i>
          <br />
          In progress: {backfillStatusInfo.backfillsInProgress}
          <br />
          Successful: {backfillStatusInfo.backfillsSuccessful}
          <br />
          Failed: {backfillStatusInfo.backfillsFailed}
          <br />
        </>
      );
    }

    return (
      <tr
        className={
          alertSummary.notes ? 'border-top border-left border-right' : 'border'
        }
        aria-label="Alert table row"
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
        <td className="px-0 d-flex flex-column align-items-start border-top-0">
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
          <a
            href={getGraphsURL(alert, timeRange, repository, framework)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-dark button btn border p-0 border-0 bg-transparent"
            aria-label="graph-link"
          >
            <FontAwesomeIcon title="Open graph" icon={faChartLine} />
          </a>
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
          {backfillStatusInfo && (
            <span className="text-darker-info">
              <SimpleTooltip
                key={alert.id}
                text={
                  <FontAwesomeIcon
                    icon={backfillStatusInfo.icon}
                    color={backfillStatusInfo.color}
                    data-testid={`alert ${alert.id.toString()} sherlock icon`}
                  />
                }
                tooltipText={sherlockTooltip}
              />
            </span>
          )}
        </td>
        <td className="table-width-lg">
          <div className="information-container">
            <AlertTablePlatform
              platform={alert.series_signature.machine_platform}
            />
          </div>
        </td>
        <td className="table-width-lg">
          <div className="information-container">
            <div className="option">
              <BadgeTooltip
                textClass="detail-hint"
                text={noiseProfile}
                tooltipText={noiseProfileTooltip}
                autohide={false}
              />
            </div>
            {icons.length > 0 ? (
              <div className="option" data-testid="flame-icons">
                {icons}
              </div>
            ) : (
              ''
            )}
          </div>
        </td>
        <td className="table-width-lg tags-and-options-td">
          <AlertTableTagsOptions alertId={alert.id} items={items} />
        </td>
        <td className="table-width-md">
          <Magnitude alert={alert} />
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
