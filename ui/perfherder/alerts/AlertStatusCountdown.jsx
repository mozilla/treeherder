import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock } from '@fortawesome/free-regular-svg-icons';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

import SimpleTooltip from '../../shared/SimpleTooltip';
import { getStatus } from '../perf-helpers/helpers';
import { countdownClasses } from '../perf-helpers/constants';
import {
  alertIsLinkedToBug,
  alertIsTriaged,
  getCountdownText,
  getTimeDifference,
  isWeekend,
} from '../perf-helpers/alertCountdownHelper';

export default class AlertStatusCountdown extends React.Component {
  constructor(props) {
    super(props);

    this.showCountdownToTriageIcon = true;
  }

  getDueDateCountdownsStatus() {
    const { alertSummary } = this.props;
    let {
      triage_due_date: triageDueDate,
      bug_due_date: bugDueDate,
    } = alertSummary;

    const currentDate = new Date(Date.now());
    triageDueDate = new Date(triageDueDate);
    bugDueDate = new Date(bugDueDate);

    const timeToTriageDifference = getTimeDifference(
      currentDate,
      triageDueDate,
    );
    const timeToBugDifference = getTimeDifference(currentDate, bugDueDate);

    const countdowns = {
      triage: '',
      bug: '',
    };

    if (isWeekend()) {
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

    if (!alertIsTriaged(alertSummary)) {
      countdownClass = this.getCountdownClass(countdown.triage);
    } else if (
      alertIsTriaged(alertSummary) &&
      !alertIsLinkedToBug(alertSummary)
    ) {
      countdownClass = this.getCountdownClass(countdown.bug);
    } else {
      countdownClass = countdownClasses.ready;
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
                        countdownClass === countdownClasses.ready
                          ? faCheck
                          : faClock
                      }
                      className={countdownClass}
                      data-testid="triage-clock-icon"
                    />
                  }
                  tooltipText={
                    <div data-testid="due-date-status">
                      {alertSummary.bug_number && (
                        <h5>Ready for acknowledge</h5>
                      )}
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
