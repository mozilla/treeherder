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

test('Triage to countdown shows 3 working days left', async () => {
  const alert = testAlertSummaries[0];
  alert.created = '2022-02-07T11:41:31.419156';

  Date.now = jest.fn(() => Date.parse('2022-02-7'));

  const { getByTestId } = testStatusDropdown([], alert);

  const dueDateIcon = await waitFor(() => getByTestId(`triage-test`));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));

  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;

  expect(dueDateStatusText).toBe('Working days left: 3');
});

test('Triage to countdown shows 2 working days left', async () => {
  const alert = testAlertSummaries[0];
  alert.created = '2022-02-07T11:41:31.419156';

  Date.now = jest.fn(() => Date.parse('2022-02-8'));

  const { getByTestId } = testStatusDropdown([], alert);

  const dueDateIcon = await waitFor(() => getByTestId(`triage-test`));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));

  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;

  expect(dueDateStatusText).toBe('Working days left: 2');
});

test('Triage to countdown shows 1 working days left', async () => {
  const alert = testAlertSummaries[0];
  alert.created = '2022-02-07T11:41:31.419156';

  Date.now = jest.fn(() => Date.parse('2022-02-9'));

  const { getByTestId } = testStatusDropdown([], alert);

  const dueDateIcon = await waitFor(() => getByTestId(`triage-test`));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));

  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;

  expect(dueDateStatusText).toBe('Working days left: 1');
});

test('Triage to countdown shows Today', async () => {
  const alert = testAlertSummaries[0];
  alert.created = '2022-02-07T11:41:31.419156';

  Date.now = jest.fn(() => Date.parse('2022-02-10'));

  const { getByTestId } = testStatusDropdown([], alert);

  const dueDateIcon = await waitFor(() => getByTestId(`triage-test`));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));

  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;

  expect(dueDateStatusText).toBe('Today');
});

test('Triage to countdown shows Overdue', async () => {
  const alert = testAlertSummaries[0];
  alert.created = '2022-02-07T11:41:31.419156';

  Date.now = jest.fn(() => Date.parse('2022-02-11'));

  const { getByTestId } = testStatusDropdown([], alert);

  const dueDateIcon = await waitFor(() => getByTestId(`triage-test`));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));

  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;

  expect(dueDateStatusText).toBe('Overdue');
});

test('Triage to countdown shows 3 working days left when alert is createad on Friday', async () => {
  const alert = testAlertSummaries[0];
  alert.created = '2022-02-11T11:41:31.419156';

  Date.now = jest.fn(() => Date.parse('2022-02-11'));

  const { getByTestId } = testStatusDropdown([], alert);

  const dueDateIcon = await waitFor(() => getByTestId(`triage-test`));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));

  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;

  expect(dueDateStatusText).toBe('Working days left: 3');
});

test('Triage to countdown shows 3 working days left when alert is createad on Saturday and the website is accessed on Monday', async () => {
  const alert = testAlertSummaries[0];
  alert.created = '2022-02-12T11:41:31.419156';

  Date.now = jest.fn(() => Date.parse('2022-02-14'));

  const { getByTestId } = testStatusDropdown([], alert);

  const dueDateIcon = await waitFor(() => getByTestId(`triage-test`));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));

  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;

  expect(dueDateStatusText).toBe('Working days left: 3');
});

test('Triage to countdown shows 3 working days left when alert is createad on Sunday and the website is accessed on Monday', async () => {
  const alert = testAlertSummaries[0];
  alert.created = '2022-02-13T11:41:31.419156';

  Date.now = jest.fn(() => Date.parse('2022-02-14'));

  const { getByTestId } = testStatusDropdown([], alert);

  const dueDateIcon = await waitFor(() => getByTestId(`triage-test`));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));

  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;

  expect(dueDateStatusText).toBe('Working days left: 3');
});

test('Triage to countdown shows 3 working days left when the due date its either Saturday or Sunday and the alert is created on Tuesday', async () => {
  const alert = testAlertSummaries[0];
  alert.created = '2022-02-08T11:41:31.419156';

  Date.now = jest.fn(() => Date.parse('2022-02-8'));

  const { getByTestId } = testStatusDropdown([], alert);

  const dueDateIcon = await waitFor(() => getByTestId(`triage-test`));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));

  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;

  expect(dueDateStatusText).toBe('Working days left: 3');
});

test('Triage to countdown shows 3 working days left when the due date its either Saturday or Sunday and the alert is created on Wednesday', async () => {
  const alert = testAlertSummaries[0];
  alert.created = '2022-02-09T11:41:31.419156';

  Date.now = jest.fn(() => Date.parse('2022-02-9'));

  const { getByTestId } = testStatusDropdown([], alert);

  const dueDateIcon = await waitFor(() => getByTestId(`triage-test`));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));

  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;

  expect(dueDateStatusText).toBe('Working days left: 3');
});

test('Triage to countdown shows 3 working days left when the due date its on Monday, the alert is created on Thursday and it skips the weekend', async () => {
  const alert = testAlertSummaries[0];
  alert.created = '2022-02-10T11:41:31.419156';

  Date.now = jest.fn(() => Date.parse('2022-02-10'));

  const { getByTestId } = testStatusDropdown([], alert);

  const dueDateIcon = await waitFor(() => getByTestId(`triage-test`));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));

  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;

  expect(dueDateStatusText).toBe('Working days left: 3');
});

test('Triage to countdown shows nothing when the website is accessed during the weekend', async () => {
  const alert = testAlertSummaries[0];
  alert.created = '2022-02-10T11:41:31.419156';

  Date.now = jest.fn(() => Date.parse('2022-02-13'));

  const { getByTestId } = testStatusDropdown([], alert);

  const dueDateIcon = await waitFor(() => getByTestId(`triage-test`));

  fireEvent.mouseOver(dueDateIcon);

  const dueDateStatus = await waitFor(() => getByTestId('due-date-status'));

  const dueDateStatusText = dueDateStatus.querySelector('span').innerHTML;

  expect(dueDateStatusText).toBe('');
});
