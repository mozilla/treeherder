import { weekdays } from './constants';

export const isWeekend = () => {
  const currentDate = new Date(Date.now());
  const currentDay = currentDate.getDay();

  return currentDay === weekdays.saturday || currentDay === weekdays.sunday;
};

export const getTimeDifference = (currentDate, dueDate) => {
  const msInHour = 1000 * 60 * 60;
  const msInDay = msInHour * 24;
  const totalMs = dueDate.getTime() - currentDate.getTime();

  // if the due date is in the past, return 0
  if (totalMs <= 0) {
    return { hours: 0, days: 0 };
  }

  let weekendDays = 0;
  let tempDate = new Date(currentDate.getTime());

  // step forward exactly 24 hours at a time to count weekend days
  while (tempDate < dueDate) {
    const dayOfWeek = tempDate.getUTCDay();

    if (dayOfWeek === weekdays.sunday || dayOfWeek === weekdays.saturday) {
      weekendDays++;
    }
    tempDate.setTime(tempDate.getTime() + msInDay);
  }

  // subtract the weekend time from the total time
  const workingMs = Math.max(0, totalMs - (weekendDays * msInDay));

  return {
    hours: Math.ceil(workingMs / msInHour),
    days: Math.ceil(workingMs / msInDay),
  };
};

export const getCountdownText = (now, dueDate, difference) => {
  // check if it's overdue first
  if (now.getTime() >= dueDate.getTime()) {
    return `Overdue`;
  }

  if (difference.hours < 24 && difference.hours >= 0) {
    return `${difference.hours} hours left`;
  }

  return `${difference.days} days left`;
};

export const alertIsTriaged = (alertSummary) => {
  return !!alertSummary.first_triaged;
};

export const alertIsLinkedToBug = (alertSummary) => {
  return !!alertSummary.bug_number;
};
