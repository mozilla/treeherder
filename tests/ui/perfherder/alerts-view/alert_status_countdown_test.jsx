import React from 'react';
import { render, waitFor, cleanup, fireEvent } from '@testing-library/react';

import testAlertSummaries from '../../mock/alert_summaries';
import issueTrackers from '../../../../treeherder/perf/fixtures/issue_tracker';
import AlertStatusCountdown from '../../../../ui/perfherder/alerts/AlertStatusCountdown';

let testAlertSummary = testAlertSummaries[0];
issueTrackers.map((issue) => ({
  id: issue.pk,
  issueTrackerUrl: issue.fields.name,
  text: issue.fields.task_base_url,
}));
const testStatusDropdown = (summaryTags, alertSummary) => {
  testAlertSummary.performance_tags = summaryTags;

  if (alertSummary) {
    testAlertSummary = alertSummary;
  }

  return render(<AlertStatusCountdown alertSummary={testAlertSummary} />);
};

afterEach(cleanup);

// Alert created on Monday
test('Alert is created on Monday, Triage countdown shows 3 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';
  alert.triage_due_date = '2022-02-10T11:41:31.419156';

  // current day is set to Monday
  Date.now = jest.fn(() => Date.parse('2022-02-07T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Triage: 3 days left');
});

test('Alert is created on Monday, Triage countdown shows 2 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';
  alert.triage_due_date = '2022-02-10T11:41:31.419156';

  // current day is set to Tuesday
  Date.now = jest.fn(() => Date.parse('2022-02-08T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Triage: 2 days left');
});

test('Alert is created on Monday, Triage countdown shows 1 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';
  alert.triage_due_date = '2022-02-10T11:41:31.419156';

  // current day is set to Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-09T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Triage: 1 days left');
});

test('Alert is created on Monday, Triage countdown shows hours left', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';
  alert.triage_due_date = '2022-02-10T11:41:31.419156';

  // current day is set to Thursday
  Date.now = jest.fn(() => Date.parse('2022-02-10T01:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Triage: 10 hours left');
});

test('Alert is created on Monday, Triage countdown shows Overdue', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';
  alert.triage_due_date = '2022-02-10T11:41:31.419156';

  // current day is set to Friday
  Date.now = jest.fn(() => Date.parse('2022-02-11T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Triage: Overdue');
});

test('Alert is created on Monday, Bug countdown shows 5 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';
  alert.first_triaged = '2022-02-07T11:41:31.419156';
  alert.bug_due_date = '2022-02-14T11:41:31.419156';

  // current day is set to Monday
  Date.now = jest.fn(() => Date.parse('2022-02-07T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: 5 days left');
});

test('Alert is created on Monday, Bug countdown shows 4 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';
  alert.first_triaged = '2022-02-07T11:41:31.419156';
  alert.bug_due_date = '2022-02-14T11:41:31.419156';

  // current day is set to Tuesday
  Date.now = jest.fn(() => Date.parse('2022-02-08T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: 4 days left');
});

test('Alert is created on Monday, Bug countdown shows 3 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';
  alert.first_triaged = '2022-02-07T11:41:31.419156';
  alert.bug_due_date = '2022-02-14T11:41:31.419156';

  // current day is set to Tuesday
  Date.now = jest.fn(() => Date.parse('2022-02-09T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: 3 days left');
});

test('Alert is created on Monday, Bug countdown shows 2 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';
  alert.first_triaged = '2022-02-07T11:41:31.419156';
  alert.bug_due_date = '2022-02-14T11:41:31.419156';

  // current day is set to Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-10T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: 2 days left');
});

test('Alert is created on Monday, Bug countdown shows 1 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';
  alert.first_triaged = '2022-02-07T11:41:31.419156';
  alert.bug_due_date = '2022-02-14T11:41:31.419156';

  // current day is set to Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-11T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: 1 days left');
});

test('Alert is created on Monday, Bug countdown shows hours left', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';
  alert.first_triaged = '2022-02-07T11:41:31.419156';
  alert.bug_due_date = '2022-02-14T10:41:31.419156';

  // current day is set to Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-11T12:40:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: 23 hours left');
});

test('Alert is created on Monday, Bug countdown shows Overdue', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';
  alert.first_triaged = '2022-02-07T11:41:31.419156';
  alert.bug_due_date = '2022-02-14T11:41:31.419156';

  // current day is set to Friday
  Date.now = jest.fn(() => Date.parse('2022-02-15T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: Overdue');
});

// testing what the tooltip shows for the cases when the alert is created either on Wednesday, Thursday, Friday or the weekend

// Alert created on Wednesday
test('Alert is created on Wednesday, Triage countdown shows 3 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';
  alert.first_triaged = '';
  alert.triage_due_date = '2022-02-14T11:41:31.419156';

  // current day is set to Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-09T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Triage: 3 days left');
});

test('Alert is created on Wednesday, Triage countdown shows 2 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';
  alert.first_triaged = '';
  alert.triage_due_date = '2022-02-14T11:41:31.419156';

  // current day is set to Thursday
  Date.now = jest.fn(() => Date.parse('2022-02-10T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Triage: 2 days left');
});

test('Alert is created on Wednesday, Triage countdown shows 1 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';
  alert.first_triaged = '';
  alert.triage_due_date = '2022-02-14T11:41:31.419156';

  // current day is set to Friday
  Date.now = jest.fn(() => Date.parse('2022-02-11T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Triage: 1 days left');
});

test('Alert is created on Wednesday, Triage countdown shows hours left', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';
  alert.first_triaged = '';
  alert.triage_due_date = '2022-02-14T11:41:31.419156';

  // current day is set to Monday
  Date.now = jest.fn(() => Date.parse('2022-02-14T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Triage: 0 hours left');
});

test('Alert is created on Wednesday, Triage countdown shows Overdue', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';
  alert.first_triaged = '';
  alert.triage_due_date = '2022-02-14T11:41:31.419156';

  // current day is set to Tuesday
  Date.now = jest.fn(() => Date.parse('2022-02-15T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Triage: Overdue');
});

test('Alert is created on Wednesday, Bug countdown shows 5 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';
  alert.first_triaged = '2022-02-09T11:41:31.419156';
  alert.bug_due_date = '2022-02-16T11:41:31.419156';

  // current day is set to Monday
  Date.now = jest.fn(() => Date.parse('2022-02-09T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: 5 days left');
});

test('Alert is created on Wednesday, Bug countdown shows 4 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';
  alert.first_triaged = '2022-02-09T11:41:31.419156';
  alert.bug_due_date = '2022-02-16T11:41:31.419156';

  // current day is set to Tuesday
  Date.now = jest.fn(() => Date.parse('2022-02-10T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: 4 days left');
});

test('Alert is created on Wednesday, Bug countdown shows 3 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';
  alert.first_triaged = '2022-02-09T11:41:31.419156';
  alert.bug_due_date = '2022-02-16T11:41:31.419156';

  // current day is set to Tuesday
  Date.now = jest.fn(() => Date.parse('2022-02-11T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: 3 days left');
});

test('Alert is created on Wednesday, Bug countdown shows 2 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';
  alert.first_triaged = '2022-02-09T11:41:31.419156';
  alert.bug_due_date = '2022-02-16T11:41:31.419156';

  // current day is set to Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-14T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: 2 days left');
});

test('Alert is created on Wednesday, Bug countdown shows 1 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';
  alert.first_triaged = '2022-02-09T11:41:31.419156';
  alert.bug_due_date = '2022-02-16T11:41:31.419156';

  // current day is set to Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-15T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: 1 days left');
});

test('Alert is created on Wednesday, Bug countdown shows hours left', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';
  alert.first_triaged = '2022-02-09T11:41:31.419156';
  alert.bug_due_date = '2022-02-16T10:41:31.419156';

  // current day is set to Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-16T12:40:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: 2 hours left');
});

test('Alert is created on Wednesday, Bug countdown shows Overdue', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';
  alert.first_triaged = '2022-02-09T11:41:31.419156';
  alert.bug_due_date = '2022-02-16T11:41:31.419156';

  // current day is set to Friday
  Date.now = jest.fn(() => Date.parse('2022-02-17T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('p').innerHTML;
  expect(dueDateStatusText).toBe('Bug: Overdue');
});

test('Alert is ready, countdown shows Ready', async () => {
  const alert = testAlertSummaries[0];

  alert.first_triaged = '2022-02-09T11:41:31.419156';
  alert.bug_number = '2022021';

  // current day is set to Friday
  Date.now = jest.fn(() => Date.parse('2022-02-17T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('h5').innerHTML;
  expect(dueDateStatusText).toBe('Ready');
});

test('Triage to countdown shows nothing when the website is accessed during the weekend', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Thursday
  alert.created = '2022-02-10T11:41:31.419156';

  // current day is set to Sunday
  Date.now = jest.fn(() => Date.parse('2022-02-13T11:41:31.419156'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateContainer = await waitFor(() => getByTestId('status-countdown'));
  expect(dueDateContainer.childNodes).toHaveLength(0);
});
