import React from 'react';
import { render, waitFor, cleanup, fireEvent } from '@testing-library/react';

import testAlertSummaries from '../../mock/alert_summaries';
import testPerformanceTags from '../../mock/performance_tags';
import repos from '../../mock/repositories';
import StatusDropdown from '../../../../ui/perfherder/alerts/StatusDropdown';
import issueTrackers from '../../../../treeherder/perf/fixtures/issue_tracker';

let testAlertSummary = testAlertSummaries[0];
const testAlerts = testAlertSummary.alerts;
const testRepoModel = repos[2];

const testUser = {
  username: 'mozilla-ldap/test_user@mozilla.com',
  isLoggedIn: true,
  isStaff: true,
  email: 'test_user@mozilla.com',
};

const dummyFrameworkName = 'someTestFramework';
const testIssueTrackers = issueTrackers.map((issue) => ({
  id: issue.pk,
  issueTrackerUrl: issue.fields.name,
  text: issue.fields.task_base_url,
}));

const testStatusDropdown = (summaryTags, alertSummary) => {
  testAlertSummary.performance_tags = summaryTags;

  if (alertSummary) {
    testAlertSummary = alertSummary;
  }

  return render(
    <StatusDropdown
      alertSummary={testAlertSummary}
      user={testUser}
      updateState={() => {}}
      repoModel={testRepoModel}
      updateViewState={() => {}}
      issueTrackers={testIssueTrackers}
      bugTemplate={null}
      filteredAlerts={testAlerts}
      performanceTags={testPerformanceTags}
      frameworks={[{ id: 1, name: dummyFrameworkName }]}
    />,
  );
};

afterEach(cleanup);

test("Summary with no tags shows 'Add tags'", async () => {
  const { getByText } = testStatusDropdown([]);

  const dropdownItem = await waitFor(() => getByText('Add tags'));

  expect(dropdownItem).toBeInTheDocument();
});

test("Summary with tags shows 'Edit tags'", async () => {
  const { getByText } = testStatusDropdown(['harness']);

  const dropdownItem = await waitFor(() => getByText('Edit tags'));

  expect(dropdownItem).toBeInTheDocument();
});

test("Tags modal opens from 'Add tags'", async () => {
  const { getByText, getByTestId } = testStatusDropdown([]);

  const dropdownItem = await waitFor(() => getByText('Add tags'));

  fireEvent.click(dropdownItem);

  const modal = await waitFor(() => getByTestId('tags-modal'));

  expect(modal).toBeInTheDocument();
});

test("Tags modal opens from 'Edit tags'", async () => {
  const { getByText, getByTestId } = testStatusDropdown(['harness']);

  const dropdownItem = await waitFor(() => getByText('Edit tags'));

  fireEvent.click(dropdownItem);

  const modal = await waitFor(() => getByTestId('tags-modal'));

  expect(modal).toBeInTheDocument();
});

// Alert created on Monday
test('Alert is created on Monday, Triage to countdown shows 3 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';

  // current day is set to Monday
  Date.now = jest.fn(() => Date.parse('2022-02-7'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 3');
});

test('Alert is created on Monday, Triage to countdown shows 2 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';

  // current day is set to Tuesday
  Date.now = jest.fn(() => Date.parse('2022-02-8'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 2');
});

test('Alert is created on Monday, Triage to countdown shows 1 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';

  // current day is set to Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-9'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 1');
});

test('Alert is created on Monday, Triage to countdown shows Today', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';

  // current day is set to Thursday
  Date.now = jest.fn(() => Date.parse('2022-02-10'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Today');
});

test('Alert is created on Monday, Triage to countdown shows Overdue', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Monday
  alert.created = '2022-02-07T11:41:31.419156';

  // current day is set to Friday
  Date.now = jest.fn(() => Date.parse('2022-02-11'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Overdue');
});

// Alert created on Tuesday
test('Alert is created on Tuesday, Triage to countdown shows 3 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Tuesday
  alert.created = '2022-02-08T11:41:31.419156';

  // current day is set to Tuesday
  Date.now = jest.fn(() => Date.parse('2022-02-8'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 3');
});

test('Alert is created on Tuesday, Triage to countdown shows 2 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Tuesday
  alert.created = '2022-02-08T11:41:31.419156';

  // current day is set to Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-9'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 2');
});

test('Alert is created on Tuesday, Triage to countdown shows 1 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Tuesday
  alert.created = '2022-02-08T11:41:31.419156';

  // current day is set to Thursday
  Date.now = jest.fn(() => Date.parse('2022-02-10'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 1');
});

test('Alert is created on Tuesday, Triage to countdown shows Today', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Tuesday
  alert.created = '2022-02-08T11:41:31.419156';

  // current day is set to Friday
  Date.now = jest.fn(() => Date.parse('2022-02-11'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Today');
});

test('Alert is created on Tuesday, Triage to countdown shows Overdue', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Tuesday
  alert.created = '2022-02-08T11:41:31.419156';

  // current day is set to Monday
  Date.now = jest.fn(() => Date.parse('2022-02-14'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Overdue');
});

// testing what the tooltip shows for the cases when the alert is created either on Wednesday, Thursday, Friday or the weekend

// Alert created on Wednesday
test('Alert is created on Wednesday, Triage to countdown shows 3 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';

  // current day is set to Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-9'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 3');
});

test('Alert is created on Wednesday, Triage to countdown shows 2 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';

  // current day is set to Thursday
  Date.now = jest.fn(() => Date.parse('2022-02-10'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 2');
});

test('Alert is created on Wednesday, Triage to countdown shows 1 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';

  // current day is set to Friday
  Date.now = jest.fn(() => Date.parse('2022-02-11'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 1');
});

test('Alert is created on Wednesday, Triage to countdown shows Today', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';

  // current day is set to Monday
  Date.now = jest.fn(() => Date.parse('2022-02-14'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Today');
});

test('Alert is created on Wednesday, Triage to countdown shows Overdue', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';

  // current day is set to Tuesday
  Date.now = jest.fn(() => Date.parse('2022-02-15'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Overdue');
});

// Alert created on Thursday
test('Alert is created on Thursday, Triage to countdown shows 3 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Thursday
  alert.created = '2022-02-10T11:41:31.419156';

  // current day is set to Thursday
  Date.now = jest.fn(() => Date.parse('2022-02-10'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 3');
});

test('Alert is created on Thursday, Triage to countdown shows 2 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Thursday
  alert.created = '2022-02-10T11:41:31.419156';

  // current day is set to Friday
  Date.now = jest.fn(() => Date.parse('2022-02-11'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 2');
});

test('Alert is created on Thursday, Triage to countdown shows 1 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Thursday
  alert.created = '2022-02-10T11:41:31.419156';

  // current day is set to Monday
  Date.now = jest.fn(() => Date.parse('2022-02-14'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 1');
});

test('Alert is created on Thursday, Triage to countdown shows Today', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Thursday
  alert.created = '2022-02-10T11:41:31.419156';

  // current day is set to Tuesday
  Date.now = jest.fn(() => Date.parse('2022-02-15'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Today');
});

test('Alert is created on Thursday, Triage to countdown shows Overdue', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Thursday
  alert.created = '2022-02-09T11:41:31.419156';

  // current day is set to Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-15'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Overdue');
});

// Alert created on Friday
test('Alert is created on Friday, Triage to countdown shows 3 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Friday
  alert.created = '2022-02-11T11:41:31.419156';

  // current day is set to Friday
  Date.now = jest.fn(() => Date.parse('2022-02-11'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 3');
});

test('Alert is created on Friday, Triage to countdown shows 2 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Friday
  alert.created = '2022-02-11T11:41:31.419156';

  // current day is set to Monday
  Date.now = jest.fn(() => Date.parse('2022-02-14'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 2');
});

test('Alert is created on Friday, Triage to countdown shows 1 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Friday
  alert.created = '2022-02-11T11:41:31.419156';

  // current day is set to Tuesday
  Date.now = jest.fn(() => Date.parse('2022-02-15'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 1');
});

test('Alert is created on Friday, Triage to countdown shows Today', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Friday
  alert.created = '2022-02-11T11:41:31.419156';

  // current day is set to Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-16'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Today');
});

test('Alert is created on Friday, Triage to countdown shows Overdue', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Friday
  alert.created = '2022-02-11T11:41:31.419156';

  // current day is set to Thursday
  Date.now = jest.fn(() => Date.parse('2022-02-17'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Overdue');
});

// Alert is created on Saturday, it should work like the alert was created on Monday
test('Alert is created on Saturday, Triage to countdown shows 3 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Saturday
  alert.created = '2022-02-12T11:41:31.419156';

  // current day is set to Monday
  Date.now = jest.fn(() => Date.parse('2022-02-14'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 3');
});

// Alert is created on Sunday, it should work like the alert was created on Monday
test('Alert is created on Sunday, Triage to countdown shows 3 working days', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Sunday
  alert.created = '2022-02-13T11:41:31.419156';

  // current day is set to Monday
  Date.now = jest.fn(() => Date.parse('2022-02-14'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Working days left: 3');
});

// by showing Today status we know that the due date was calculated correctly

test('Showing Today status when Due date day is the same as current day and alert is created on Wednesday', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Wednesday
  alert.created = '2022-02-09T11:41:31.419156';

  // current day is set to equal due date which is calculated to be Monday
  Date.now = jest.fn(() => Date.parse('2022-02-14'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Today');
});

test('Showing Today status when Due date day is the same as current day and alert is created on Thursday', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Thursday
  alert.created = '2022-02-10T11:41:31.419156';

  // current day is set to equal due date which is calculated to be Tuesday
  Date.now = jest.fn(() => Date.parse('2022-02-15'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Today');
});

test('Showing Today status when Due date day is the same as current day and alert is created on Friday', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Friday
  alert.created = '2022-02-11T11:41:31.419156';

  // current day is set to equal due date which is calculated to be Wednesday
  Date.now = jest.fn(() => Date.parse('2022-02-16'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Today');
});

test('Showing Today status when Due date day is the same as current day and alert is created on Saturday', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Saturday
  alert.created = '2022-02-12T11:41:31.419156';

  // current day is set to equal due date which is calculated to be Thursday
  Date.now = jest.fn(() => Date.parse('2022-02-17'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Today');
});

test('Showing Today status when Due date day is the same as current day and alert is created on Sunday', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Sunday
  alert.created = '2022-02-13T11:41:31.419156';

  // current day is set to equal due date which is calculated to be Thursday
  Date.now = jest.fn(() => Date.parse('2022-02-17'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateIcon = await waitFor(() => getByTestId('triage-clock-icon'));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));
  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;
  expect(dueDateStatusText).toBe('Today');
});

test('Triage to countdown shows nothing when the website is accessed during the weekend', async () => {
  const alert = testAlertSummaries[0];

  // created date day is set to Thursday
  alert.created = '2022-02-10T11:41:31.419156';

  // current day is set to Sunday
  Date.now = jest.fn(() => Date.parse('2022-02-13'));

  const { getByTestId } = testStatusDropdown([], alert);
  const dueDateContainer = await waitFor(() => getByTestId('triage-due-date'));
  expect(dueDateContainer.childNodes).toHaveLength(0);
});
