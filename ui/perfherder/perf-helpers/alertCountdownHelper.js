import { weekdays } from './constants';

export const isWeekend = () => {
  const currentDate = new Date(Date.now());
  const currentDay = currentDate.getDay();

  return currentDay === weekdays.saturday || currentDay === weekdays.sunday;
};

export const getTimeDifference = (currentDate, dueDate) => {
  const timeDifference = Math.abs(dueDate - currentDate);
  let differenceInDays = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
  // saturday and sunday are considered weekend days
  const weekendDaysCount = 2;
  // convert days to weeks and keeps the count of full weeks
  const weeksCount = Math.trunc(differenceInDays / 7);
  // count the total weekend days
  const weekendDaysToSubstract = weekendDaysCount * weeksCount;
  const currentDay = currentDate.getUTCDay();
  const dueDay = dueDate.getUTCDay();

  // [1. Mon] [2. Tue] [3. Wed] [4. Thu]    [5. Fri] [6. Sat] [7. Sun]
  //                            currentDate -------- -------- ----->>>
  // -------- -------> dueDate
  if (currentDay > dueDay) {
    // If weekday of startDate is bigger than endDate then it is a new week,
    // and we have to subtract the weekend days
    differenceInDays -= weekendDaysCount;
  } else {
    // substracts the total weekend days from the total days
    differenceInDays -= weekendDaysToSubstract;
  }

  let hoursDifference = Math.ceil(timeDifference / (1000 * 60 * 60));
  const shouldGetHoursLeft =
    currentDay === weekdays.friday && dueDay === weekdays.monday;
  // If due date is Monday and today is Friday and we have to show the hours left,
  // we have to subtract the weekend hours from the difference
  if (shouldGetHoursLeft) {
    hoursDifference -= 2 * 24;
  }
  return {
    hours: hoursDifference,
    days: differenceInDays,
  };
};

export const getCountdownText = (now, dueDate, difference) => {
  if (difference.hours < 24 && difference.hours >= 0) {
    return `${difference.hours} hours left`;
  }

  if (now.getTime() >= dueDate.getTime()) {
    return `Overdue`;
  }

  return `${difference.days} days left`;
};

export const alertIsTriaged = (alertSummary) => {
  return !!alertSummary.first_triaged;
};

export const alertIsLinkedToBug = (alertSummary) => {
  return !!alertSummary.bug_number;
};
