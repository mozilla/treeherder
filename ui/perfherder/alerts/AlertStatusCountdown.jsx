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
  getCountdownLabel,
  isWeekend,
} from '../perf-helpers/alertCountdownHelper';

// Before: defined inside render() on every call, allocating a new object each time.
// After: module-level constant, allocated once.
const DUE_DATE_FORMAT = {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
};

// Before: 'en-UK' is not a valid BCP-47 locale tag and silently falls back to the
// system locale, producing inconsistent date formats across machines.
// After: 'en-GB' is the correct tag for British English.
const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleString('en-GB', DUE_DATE_FORMAT);

const iconClassFor = (label) => {
  if (label === 'Overdue') return countdownClasses.overdue;
  if (label.includes('hours')) return countdownClasses.today;
  return countdownClasses.ok;
};

// Before: class component with a getDueDateCountdownsStatus() method that mutated
// this.showCountdownToTriageIcon as a side effect, computed both triage and bug
// countdowns even when only one was shown, and used three boolean flags
// (showTriageCountdown, showBugCountdown, showReady) to control what to render.
// triageDueDate / bugDueDate were also shadowed in render(): first holding a raw
// ISO string from alertSummary, then overwritten with a formatted display string.
//
// After: function component with a linear three-branch state machine — each branch
// returns exactly what it renders, with no shared mutable state.
export default function AlertStatusCountdown({ alertSummary }) {
  const alertStatus = getStatus(alertSummary.status);

  if (alertStatus !== 'untriaged' || isWeekend()) {
    return <div data-testid="status-countdown" />;
  }

  const triaged = alertIsTriaged(alertSummary);
  const hasBug = alertIsLinkedToBug(alertSummary);

  if (triaged && hasBug) {
    return (
      <div data-testid="status-countdown">
        <div className="due-date-container">
          <div className="clock-container">
            <SimpleTooltip
              text={
                <FontAwesomeIcon
                  icon={faCheck}
                  className={countdownClasses.ready}
                  data-testid="triage-clock-icon"
                />
              }
              tooltipText={
                <div data-testid="due-date-status">
                  <h5>Ready for acknowledge</h5>
                </div>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  const dueDateStr = triaged
    ? alertSummary.bug_due_date
    : alertSummary.triage_due_date;

  const now = new Date(Date.now());
  const label = getCountdownLabel(now, new Date(dueDateStr));
  const heading = triaged ? 'Bug Due' : 'Triage Due';

  return (
    <div data-testid="status-countdown">
      <div className="due-date-container">
        <div className="clock-container">
          <SimpleTooltip
            text={
              <FontAwesomeIcon
                icon={faClock}
                className={iconClassFor(label)}
                data-testid="triage-clock-icon"
              />
            }
            tooltipText={
              <div data-testid="due-date-status">
                <div className="countdown-section">
                  <h5>
                    {heading}: {formatDate(dueDateStr)}
                  </h5>
                  <p>Time left: {label}</p>
                </div>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

AlertStatusCountdown.propTypes = {
  alertSummary: PropTypes.shape({}).isRequired,
};
