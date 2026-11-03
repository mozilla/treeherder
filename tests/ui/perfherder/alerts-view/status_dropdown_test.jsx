import { render, waitFor, cleanup, fireEvent } from '@testing-library/react';

import testAlertSummaries from '../../mock/alert_summaries';
import testPerformanceTags from '../../mock/performance_tags';
import repos from '../../mock/repositories';
import StatusDropdown from '../../../../ui/perfherder/alerts/StatusDropdown';
import issueTrackers from '../../../../treeherder/perf/fixtures/issue_tracker';
import { alertStatusMap } from '../../../../ui/perfherder/perf-helpers/constants';

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
      filteredAlerts={testAlerts}
      performanceTags={testPerformanceTags}
      frameworks={[{ id: 1, name: dummyFrameworkName }]}
    />,
  );
};

afterEach(cleanup);

test("Summary with no tags shows 'Add tags'", async () => {
  const { getByText } = testStatusDropdown([]);

  // Open the status dropdown first
  const statusDropdown = await waitFor(() => getByText('untriaged'));
  fireEvent.click(statusDropdown);

  // Wait for state update after clicking dropdown
  await waitFor(() => {
    const dropdownItem = getByText('Add tags');
    expect(dropdownItem).toBeInTheDocument();
  });
});

test("Summary with tags shows 'Edit tags'", async () => {
  const { getByText } = testStatusDropdown(['harness']);

  // Open the status dropdown first
  const statusDropdown = await waitFor(() => getByText('untriaged'));
  fireEvent.click(statusDropdown);

  // Wait for state update after clicking dropdown
  await waitFor(() => {
    const dropdownItem = getByText('Edit tags');
    expect(dropdownItem).toBeInTheDocument();
  });
});

test("Tags modal opens from 'Add tags'", async () => {
  const { getByText, getByTestId } = testStatusDropdown([]);

  // Open the status dropdown first
  const statusDropdown = await waitFor(() => getByText('untriaged'));
  fireEvent.click(statusDropdown);

  // Wait for dropdown to open
  const dropdownItem = await waitFor(() => getByText('Add tags'));

  fireEvent.click(dropdownItem);

  // Wait for state update after clicking dropdown item and modal to appear
  await waitFor(() => {
    const modal = getByTestId('tags-modal');
    expect(modal).toBeInTheDocument();
  });
});

test("Tags modal opens from 'Edit tags'", async () => {
  const { getByText, getByTestId } = testStatusDropdown(['harness']);

  // Open the status dropdown first
  const statusDropdown = await waitFor(() => getByText('untriaged'));
  fireEvent.click(statusDropdown);

  // Wait for dropdown to open
  const dropdownItem = await waitFor(() => getByText('Edit tags'));

  fireEvent.click(dropdownItem);

  // Wait for state update after clicking dropdown item and modal to appear
  await waitFor(() => {
    const modal = getByTestId('tags-modal');
    expect(modal).toBeInTheDocument();
  });
});

test("'Request backout' is offered for a critical summary", async () => {
  const { getByText } = testStatusDropdown([], {
    ...testAlertSummaries[0],
    bug_number: null,
    severity: 'critical',
  });

  fireEvent.click(await waitFor(() => getByText('untriaged')));

  await waitFor(() => {
    expect(getByText('Request backout')).toBeInTheDocument();
  });
});

test("'Request backout' is not offered for a normal summary", async () => {
  const { getByText, queryByText } = testStatusDropdown([], {
    ...testAlertSummaries[0],
    bug_number: null,
    severity: 'normal',
  });

  fireEvent.click(await waitFor(() => getByText('untriaged')));

  await waitFor(() => {
    expect(getByText('File bug')).toBeInTheDocument();
  });
  expect(queryByText('Request backout')).toBeNull();
});

test('The backout comment names each severe test once', () => {
  const dropdown = new StatusDropdown({
    alertSummary: testAlertSummaries[0],
    frameworks: [],
  });

  const severeTests = dropdown.getSevereTests({
    id: 1,
    alerts: [
      {
        severity: 'critical',
        related_summary_id: null,
        series_signature: {
          suite: 'speedometer3',
          test: 'score',
          machine_platform: 'windows11-64-24h2-shippable',
        },
      },
      {
        // a suite with no subtests repeats its name in test
        severity: 'subcritical',
        related_summary_id: null,
        series_signature: {
          suite: 'newssite-applink-startup',
          test: 'newssite-applink-startup',
          machine_platform: 'android-hw-a55-14-0-aarch64-shippable',
        },
      },
      {
        severity: 'normal',
        related_summary_id: null,
        series_signature: {
          suite: 'other',
          test: 'total',
          machine_platform: 'linux2404-64-shippable',
        },
      },
    ],
  });

  expect(severeTests).toBe(
    'speedometer3 score windows11-64-24h2-shippable, ' +
      'newssite-applink-startup android-hw-a55-14-0-aarch64-shippable',
  );
});

test('The backout comment lists a repeated test only once', () => {
  const dropdown = new StatusDropdown({
    alertSummary: testAlertSummaries[0],
    frameworks: [],
  });
  const signature = {
    suite: 'speedometer3',
    test: 'score',
    machine_platform: 'windows11-64-24h2-shippable',
  };

  const severeTests = dropdown.getSevereTests({
    id: 1,
    alerts: [
      // same test, distinct signatures: different extra options or application
      {
        severity: 'critical',
        related_summary_id: null,
        series_signature: { ...signature },
      },
      {
        severity: 'critical',
        related_summary_id: null,
        series_signature: { ...signature },
      },
    ],
  });

  expect(severeTests).toBe('speedometer3 score windows11-64-24h2-shippable');
});

test('The backout comment covers alerts reassigned into the summary', () => {
  const dropdown = new StatusDropdown({
    alertSummary: testAlertSummaries[0],
    frameworks: [],
  });

  const severeTests = dropdown.getSevereTests({
    id: 1,
    alerts: [
      {
        severity: 'critical',
        related_summary_id: null,
        series_signature: {
          suite: 'speedometer3',
          test: 'score',
          machine_platform: 'windows11-64-24h2-shippable',
        },
      },
    ],
    related_alerts: [
      {
        severity: 'subcritical',
        related_summary_id: 1,
        series_signature: {
          suite: 'newssite-applink-startup',
          test: 'applink_startup',
          machine_platform: 'android-hw-a55-14-0-aarch64-shippable',
        },
      },
    ],
  });

  expect(severeTests).toBe(
    'speedometer3 score windows11-64-24h2-shippable, ' +
      'newssite-applink-startup applink_startup android-hw-a55-14-0-aarch64-shippable',
  );
});

test('The backout comment skips critical alerts moved to another summary', () => {
  const dropdown = new StatusDropdown({
    alertSummary: testAlertSummaries[0],
    frameworks: [],
  });

  const severeTests = dropdown.getSevereTests({
    id: 1,
    alerts: [
      // reassigned to summary 2, so it is no longer part of summary 1
      {
        severity: 'critical',
        status: alertStatusMap.reassigned,
        related_summary_id: 2,
        series_signature: {
          suite: 'speedometer3',
          test: 'score',
          machine_platform: 'windows11-64-24h2-shippable',
        },
      },
    ],
    related_alerts: [
      // reassigned into summary 1 from elsewhere, so it still counts
      {
        severity: 'critical',
        status: alertStatusMap.reassigned,
        related_summary_id: 1,
        series_signature: {
          suite: 'newssite-applink-startup',
          test: 'applink_startup',
          machine_platform: 'android-hw-a55-14-0-aarch64-shippable',
        },
      },
    ],
  });

  expect(severeTests).toBe(
    'newssite-applink-startup applink_startup android-hw-a55-14-0-aarch64-shippable',
  );
});

test('The backout comment leaves out invalid and infra alerts', () => {
  const dropdown = new StatusDropdown({
    alertSummary: testAlertSummaries[0],
    frameworks: [],
  });

  const severeTests = dropdown.getSevereTests({
    id: 1,
    alerts: [
      {
        severity: 'critical',
        status: alertStatusMap.invalid,
        related_summary_id: null,
        series_signature: {
          suite: 'speedometer3',
          test: 'score',
          machine_platform: 'windows11-64-24h2-shippable',
        },
      },
      {
        severity: 'critical',
        status: alertStatusMap.infra,
        related_summary_id: null,
        series_signature: {
          suite: 'speedometer3',
          test: 'total',
          machine_platform: 'linux2404-64-shippable',
        },
      },
      {
        severity: 'critical',
        status: alertStatusMap.untriaged,
        related_summary_id: null,
        series_signature: {
          suite: 'newssite-applink-startup',
          test: 'applink_startup',
          machine_platform: 'android-hw-a55-14-0-aarch64-shippable',
        },
      },
    ],
  });

  expect(severeTests).toBe(
    'newssite-applink-startup applink_startup android-hw-a55-14-0-aarch64-shippable',
  );
});

test('The backout comment is empty once every severe alert has moved to another summary', () => {
  const dropdown = new StatusDropdown({
    alertSummary: testAlertSummaries[0],
    frameworks: [],
  });

  const severeTests = dropdown.getSevereTests({
    id: 1,
    alerts: [
      {
        severity: 'critical',
        status: alertStatusMap.reassigned,
        related_summary_id: 2,
        series_signature: {
          suite: 'speedometer3',
          test: 'score',
          machine_platform: 'windows11-64-24h2-shippable',
        },
      },
      {
        severity: 'subcritical',
        status: alertStatusMap.downstream,
        related_summary_id: 3,
        series_signature: {
          suite: 'newssite-applink-startup',
          test: 'applink_startup',
          machine_platform: 'android-hw-a55-14-0-aarch64-shippable',
        },
      },
    ],
    related_alerts: [],
  });

  expect(severeTests).toBe('');
});

test("'Request backout' is not offered for a summary with no severity", async () => {
  const { getByText, queryByText } = testStatusDropdown([], {
    ...testAlertSummaries[0],
    bug_number: null,
    severity: null,
  });

  fireEvent.click(await waitFor(() => getByText('untriaged')));

  await waitFor(() => {
    expect(getByText('File bug')).toBeInTheDocument();
  });
  expect(queryByText('Request backout')).toBeNull();
});

test('filterValidAlerts returns only valid alerts (acknowledged, untriaged, and valid reassigned)', () => {
  const alertSummary = { id: 100 };
  const dropdown = new StatusDropdown({
    alertSummary,
    frameworks: [],
    filteredAlerts: [
      { id: 1, status: alertStatusMap.acknowledged },
      { id: 2, status: alertStatusMap.untriaged },
      { id: 3, status: alertStatusMap.reassigned, summary_id: 99 },
      { id: 4, status: alertStatusMap.reassigned, summary_id: 100 },
      { id: 5, status: alertStatusMap.invalid },
    ],
  });

  const validAlerts = dropdown.filterValidAlerts();

  expect(validAlerts).toHaveLength(3);
  expect(validAlerts.map(a => a.id)).toEqual([1, 2, 3]);
});

test('filterValidAlerts defaults to an empty array if filteredAlerts is undefined', () => {
  const dropdown = new StatusDropdown({
    alertSummary: { id: 100 },
    frameworks: [],
  });

  expect(dropdown.filterValidAlerts()).toEqual([]);
});
