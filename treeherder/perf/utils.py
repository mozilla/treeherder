import datetime

MON, TUE, WED, THU, FRI, SAT, SUN = range(1, 8)
TRIAGE_DAYS = 2
BUG_DAYS = 4
# critical and sub-critical alerts share the same, shorter deadlines
CRITICAL_TRIAGE_DAYS = 1
CRITICAL_BUG_DAYS = 2


def calculate_time_to(created, due_days=TRIAGE_DAYS):
    due_date = created

    # if the alert was created in weekend, move the date to Monday
    if due_date.isoweekday() == SAT:
        due_date = due_date + datetime.timedelta(2)
    if due_date.isoweekday() == SUN:
        due_date = due_date + datetime.timedelta(1)

    if due_date.isoweekday() + due_days < SAT:
        # add the time-to days
        due_date = due_date + datetime.timedelta(due_days)
    # if the resulted date is on weekend, skip the weekend
    elif due_date.isoweekday() + due_days in [SAT, SUN]:
        due_date = due_date + datetime.timedelta(due_days + 2)
    # if the time-to days is greater than 7 then it contains weekend(s)
    # move the due date with the numbers of weekend days
    elif due_date.isoweekday() + due_days > SUN:
        due_date += datetime.timedelta(due_days + int((due_date.isoweekday() + due_days) / 7) * 2)

    if due_date.isoweekday() == SAT:
        due_date = due_date + datetime.timedelta(2)
    elif due_date.isoweekday() == SUN:
        due_date = due_date + datetime.timedelta(1)

    return due_date
