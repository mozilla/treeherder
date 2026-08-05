const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

export const isWeekend = () => {
  const day = new Date(Date.now()).getDay();
  return day === 0 || day === 6;
};

export const alertIsTriaged = (alertSummary) => !!alertSummary.first_triaged;
export const alertIsLinkedToBug = (alertSummary) => !!alertSummary.bug_number;

// Before: two exported functions, getTimeDifference() and getCountdownText(), that
// callers had to invoke in sequence and pass the intermediate { hours, days } object
// between them. getTimeDifference used a week-counting heuristic (full weeks × 2
// weekend days) that gave wrong results when the date range crossed a partial week.
// getCountdownText also checked "hours left" before "Overdue", so an alert that was
// overdue by less than 24 h would display "0 hours left" instead of "Overdue".
//
// After: workingMsBetween() is a private helper that steps day-by-day to count
// weekend days precisely, and getCountdownLabel() is the single public entry point
// that returns the final display string in one call.
const workingMsBetween = (now, dueDate) => {
  const totalMs = dueDate.getTime() - now.getTime();
  if (totalMs <= 0) return 0;

  let weekendDayCount = 0;
  let cursor = new Date(now.getTime());
  while (cursor < dueDate) {
    const day = cursor.getUTCDay();
    if (day === 0 || day === 6) weekendDayCount++;
    cursor.setTime(cursor.getTime() + MS_PER_DAY);
  }

  return Math.max(0, totalMs - weekendDayCount * MS_PER_DAY);
};

export const getCountdownLabel = (now, dueDate) => {
  // Overdue check must come first — the old code checked "hours left" before
  // "Overdue", causing an alert past its due date by <24 h to show "0 hours left".
  if (now >= dueDate) return 'Overdue';

  const workingMs = workingMsBetween(now, dueDate);
  if (workingMs < MS_PER_DAY) {
    return `${Math.ceil(workingMs / MS_PER_HOUR)} hours left`;
  }
  return `${Math.ceil(workingMs / MS_PER_DAY)} days left`;
};
