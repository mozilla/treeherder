import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock } from '@fortawesome/free-regular-svg-icons';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

import SimpleTooltip from '../../shared/SimpleTooltip';
import {
  getStatus,
  getTimeDifference,
  getCountdownText,
  alertIsTriaged,
  alertIsLinkedToBug,
} from '../perf-helpers/helpers';
import { countdownClasses, weekdays } from '../perf-helpers/constants';

export default class AlertStatusCountdown extends React.Component {
  constructor(props) {
    super(props);

    this.showCountdownToTriageIcon = true;
  }

  getDueDateCountdownsStatus() {
    const { alertSummary } = this.props;

    const currentDate = new Date(Date.now());
    const currentDay = currentDate.getDay();
    const triageDueDate = new Date(alertSummary.triage_due_date);
    const bugDueDate = new Date(alertSummary.bug_due_date);

    const timeToTriageDifference = getTimeDifference(
      currentDate,
      triageDueDate,
    );
    const timeToBugDifference = getTimeDifference(currentDate, bugDueDate);

    const countdowns = {
      triage: '',
      bug: '',
    };

    const accessedDuringWeekend =
      currentDay === weekdays.saturday || currentDay === weekdays.sunday;
    if (accessedDuringWeekend) {
      this.showCountdownToTriageIcon = false;
      return countdowns;
    }
    if (alertIsTriaged(alertSummary)) {
      countdowns.bug = getCountdownText(
        currentDate,
        bugDueDate,
        timeToBugDifference,
      );
    } else {
      countdowns.triage = getCountdownText(
        currentDate,
        triageDueDate,
        timeToTriageDifference,
      );
      countdowns.bug = getCountdownText(
        currentDate,
        bugDueDate,
        timeToBugDifference,
      );
    }

    return countdowns;
  }

  getCountdownClass(countdown) {
    if (countdown === 'Overdue') {
      return countdownClasses.overdue;
    }
    if (countdown.endsWith('hours left')) {
      return countdownClasses.today;
    }
    return countdownClasses.ok;
  }

  render() {
    const { alertSummary } = this.props;

    const alertStatus = getStatus(alertSummary.status);
    const countdown = this.getDueDateCountdownsStatus();
    let countdownClass;

    if (!alertIsLinkedToBug(alertSummary)) {
      countdownClass = this.getCountdownClass(countdown.triage);
    } else if (alertIsLinkedToBug(alertSummary)) {
      countdownClass = countdownClasses.ready;
    } else {
      // If bug_number is not populated then the alert was triaged,
      // show bug countdown
      countdownClass = this.getCountdownClass(countdown.bug);
    }

    const showCountdown =
      alertStatus === 'untriaged' && this.showCountdownToTriageIcon;

    return (
      <React.Fragment>
        <div data-testid="status-countdown">
          {showCountdown && (
            <div className="due-date-container">
              <div className="clock-container">
                <SimpleTooltip
                  text={
                    <FontAwesomeIcon
                      icon={
                        countdownClass === 'due-date-ready' ? faCheck : faClock
                      }
                      className={countdownClass}
                      data-testid="triage-clock-icon"
                    />
                  }
                  tooltipText={
                    <div data-testid="due-date-status">
                      {alertSummary.bug_number && <h5>Ready</h5>}
                      {!alertSummary.bug_number &&
                      alertSummary.first_triaged ? (
                        <>
                          <h5>Due date:</h5>
                          <p>Bug: {countdown.bug}</p>
                        </>
                      ) : (
                        <>
                          <h5>Due date:</h5>
                          <p>Triage: {countdown.triage}</p>
                        </>
                      )}
                    </div>
                  }
                />
              </div>
            </div>
          )}
        </div>
      </React.Fragment>
    );
  }
}

AlertStatusCountdown.propTypes = {
  alertSummary: PropTypes.shape({}).isRequired,
};
