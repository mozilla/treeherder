/* eslint-disable jest/expect-expect */
import React from 'react';
import {
  render,
  cleanup,
  fireEvent,
  wait,
  waitForElement,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { createMemoryHistory } from 'history';
import fetchMock from 'fetch-mock';

import {
  backfillRetriggeredTitle,
  unknownFrameworkMessage,
  endpoints,
  summaryStatusMap,
} from '../../../ui/perfherder/constants';
import repos from '../mock/repositories';
import { createQueryParams, getApiUrl } from '../../../ui/helpers/url';
import AlertsView from '../../../ui/perfherder/alerts/AlertsView';
import AlertsViewControls from '../../../ui/perfherder/alerts/AlertsViewControls';
import optionCollectionMap from '../mock/optionCollectionMap';

const testUser = {
  username: 'mozilla-ldap/test_user@mozilla.com',
  isLoggedIn: true,
  isStaff: true,
  email: 'test_user@mozilla.com',
};

const frameworks = [
  { id: -1, name: 'all' },
  { id: 1, name: 'talos' },
  { id: 2, name: 'build_metrics' },
  { id: 4, name: 'awsy' },
  { id: 5, name: 'awfy' },
  { id: 6, name: 'platform_microbench' },
  { id: 10, name: 'raptor' },
  { id: 11, name: 'js-bench' },
  { id: 12, name: 'devtools' },
  { id: 13, name: 'browsertime' },
  { id: 14, name: 'vcs' },
];

const dummyFrameworkName = 'someTestFramework';
const invalidFrameworkId = -1;
const testAlertSummaries = [
  {
    id: 20174,
    push_id: 477720,
    prev_push_id: 477665,
    created: '2019-05-20T11:41:31.419156',
    repository: 'mozilla-inbound',
    framework: invalidFrameworkId,
    alerts: [
      {
        id: 69344,
        status: 0,
        series_signature: {
          id: 1944439,
          framework_id: 1,
          signature_hash: '387af86a444be0b42bf1063359040942d8f59f21',
          machine_platform: 'linux64-shippable-qr',
          suite: 'tp5o',
          test: 'responsiveness',
          lower_is_better: true,
          has_subtests: false,
          option_collection_hash: '102210fe594ee9b33d82058545b1ed14f4c8206e',
          extra_options: ['e10s', 'stylo'],
        },
        is_regression: false,
        prev_value: 1.67,
        new_value: 1.6,
        t_value: 7.97,
        amount_abs: -0.08,
        amount_pct: 4.67,
        summary_id: 20174,
        related_summary_id: null,
        manually_created: false,
        classifier: null,
        starred: false,
        classifier_email: null,
      },
      {
        id: 69345,
        status: 0,
        series_signature: {
          id: 1945375,
          framework_id: 1,
          signature_hash: '461af9d92db3f2d97dc6e4c4d47e7ad256356861',
          machine_platform: 'linux64-shippable-qr',
          suite: 'tp5o_webext',
          test: 'responsiveness',
          lower_is_better: true,
          has_subtests: false,
          option_collection_hash: '102210fe594ee9b33d82058545b1ed14f4c8206e',
          extra_options: ['e10s', 'stylo'],
        },
        is_regression: false,
        prev_value: 2.01,
        new_value: 1.9,
        t_value: 7.5,
        amount_abs: -0.12,
        amount_pct: 5.83,
        summary_id: 20174,
        related_summary_id: null,
        manually_created: false,
        classifier: null,
        starred: false,
        classifier_email: null,
      },
    ],
    related_alerts: [],
    status: 0,
    bug_number: null,
    bug_updated: null,
    issue_tracker: 1,
    notes: null,
    revision: '930f0f51b681aea2a5e915a2770f80a9914ed3df',
    push_timestamp: 1558111832,
    prev_push_revision: '76e3a842e496d78a80cd547b7bf94f041f9bc612',
    assignee_username: null,
    assignee_email: null,
  },
  {
    id: 20239,
    push_id: 480946,
    prev_push_id: 480864,
    created: '2019-05-24T10:51:16.976819',
    repository: 'mozilla-inbound',
    framework: 1,
    alerts: [
      {
        id: 69526,
        status: 0,
        backfill_record: {},
        series_signature: {
          id: 1948230,
          framework_id: 1,
          signature_hash: '76aef17be607c7921b519db44b1d6a781b5775a6',
          machine_platform: 'windows10-64-shippable',
          suite: 'ts_paint',
          test: 'ts_paint',
          lower_is_better: true,
          has_subtests: false,
          option_collection_hash: '102210fe594ee9b33d82058545b1ed14f4c8206e',
          extra_options: ['e10s', 'stylo'],
        },
        is_regression: true,
        prev_value: 315.75,
        new_value: 322.58,
        t_value: 7.29,
        amount_abs: 6.83,
        amount_pct: 2.16,
        summary_id: 20239,
        related_summary_id: null,
        manually_created: false,
        classifier: null,
        starred: false,
        classifier_email: null,
      },
      {
        id: 69530,
        status: 3,
        series_signature: {
          id: 1948296,
          framework_id: 2,
          signature_hash: '5ece5cd7460330dea3b655c7f8d786b79369081e',
          machine_platform: 'windows7-32-shippable',
          suite: 'ts_paint_webext',
          test: 'ts_paint_webext',
          lower_is_better: true,
          has_subtests: false,
          option_collection_hash: '102210fe594ee9b33d82058545b1ed14f4c8206e',
          extra_options: ['e10s', 'stylo'],
        },
        is_regression: true,
        prev_value: 327.62,
        new_value: 338.5,
        t_value: 7.02,
        amount_abs: 10.88,
        amount_pct: 3.32,
        summary_id: 20239,
        related_summary_id: null,
        manually_created: false,
        classifier: 'mozilla-ldap/user@mozilla.com',
        starred: false,
        classifier_email: 'user@mozilla.com',
      },
    ],
    related_alerts: [],
    status: 0,
    bug_number: null,
    bug_updated: null,
    issue_tracker: 1,
    notes: null,
    revision: 'd4a9b4dd03ca5c3db2bd10e8097d9817435ba37d',
    push_timestamp: 1558583128,
    prev_push_revision: 'c8e9b6a81194dff2d37b4f67d23a419fd4587e49',
    assignee_username: 'mozilla-ldap/test_user@mozilla.com',
    assignee_email: 'test_user@mozilla.com',
  },
];

const testIssueTrackers = [
  {
    id: 1,
    text: 'Bugzilla',
    issueTrackerUrl: 'https://bugzilla.mozilla.org/show_bug.cgi?id=',
  },
  {
    id: 2,
    text: 'Github - Servo',
    issueTrackerUrl: 'https://github.com/servo/servo/pull/',
  },
];

const testAlertDropdowns = [
  {
    options: Object.keys(summaryStatusMap),
    selectedItem: 'untriaged',
    updateData: () => {},
  },
  {
    options: [frameworks.map(item => item.name)],
    selectedItem: 'talos',
    updateData: () => {},
  },
];

afterEach(cleanup);

const mockModifyAlert = {
  update(alert, params) {
    return {
      data: {
        ...alert,
        ...params,
      },
      failureStatus: null,
    };
  },
};

// eslint-disable-next-line no-unused-vars
const mockUpdateAlertSummary = (alertSummaryId, params) => ({
  failureStatus: null,
});
const alertsView = () =>
  render(
    <AlertsView
      user={testUser}
      projects={repos}
      location={{
        pathname: '/alerts',
        search: '',
      }}
      history={createMemoryHistory('/alerts')}
      frameworks={frameworks}
    />,
  );

const alertsViewControls = ({
  isListingAlertSummaries = null,
  user: userMock = null,
  alertDropdowns: alertDropdownMock = null,
} = {}) => {
  const user = userMock !== null ? userMock : testUser;
  const alertDropdowns =
    alertDropdownMock !== null ? alertDropdownMock : testAlertDropdowns;

  return render(
    <AlertsViewControls
      validated={{
        hideDwnToInv: undefined,
        hideImprovements: undefined,
        filter: undefined,
        updateParams: () => {},
      }}
      isListingAlertSummaries={isListingAlertSummaries}
      dropdownOptions={alertDropdowns}
      alertSummaries={testAlertSummaries}
      issueTrackers={testIssueTrackers}
      optionCollectionMap={optionCollectionMap}
      fetchAlertSummaries={() => {}}
      updateViewState={() => {}}
      user={user}
      modifyAlert={(alert, params) => mockModifyAlert.update(alert, params)}
      updateAlertSummary={() =>
        Promise.resolve({ failureStatus: false, data: 'alert summary data' })
      }
      projects={repos}
      location={{
        pathname: '/alerts',
        search: '',
      }}
      frameworks={[{ id: 1, name: dummyFrameworkName }]}
      history={createMemoryHistory('/alerts')}
    />,
  );
};

const modifyAlertSpy = jest.spyOn(mockModifyAlert, 'update');

beforeAll(() => {
  fetchMock.mock(getApiUrl(endpoints.issueTrackers), testIssueTrackers);

  fetchMock.mock(
    `${getApiUrl(endpoints.alertSummary)}${createQueryParams({
      framework: testAlertSummaries[1].framework,
      page: 1,
      status: testAlertSummaries[1].status,
    })}`,
    {
      count: 2,
      next: null,
      previous: null,
      results: testAlertSummaries,
    },
  );

  fetchMock.mock(
    `${getApiUrl(endpoints.alertSummary)}${createQueryParams({
      framework: testAlertSummaries[1].framework,
      page: 1,
    })}`,
    {
      count: 2,
      next: null,
      previous: null,
      results: testAlertSummaries,
    },
  );

  fetchMock.mock(
    `${getApiUrl(endpoints.alertSummary)}${createQueryParams({
      page: 1,
    })}`,
    {
      count: 2,
      next: null,
      previous: null,
      results: testAlertSummaries,
    },
  );

  fetchMock.mock(getApiUrl('/optioncollectionhash/'), [
    {
      option_collection_hash: '102210fe594ee9b33d82058545b1ed14f4c8206e',
      options: [
        {
          name: '32',
        },
      ],
    },
  ]);
});

test('toggle buttons should filter alert summary and alerts by selected filter', async () => {
  const { getByText, getByTestId } = alertsViewControls();
  const hideImprovements = getByText('Hide improvements');
  const hideDownstream = getByText('Hide downstream / reassigned to / invalid');

  const alertSummary1 = await waitForElement(() =>
    getByTestId(`alert summary ${testAlertSummaries[0].id.toString()} title`),
  );
  const alertSummary2 = await waitForElement(() =>
    getByTestId(`alert summary ${testAlertSummaries[1].id.toString()} title`),
  );

  // alertSummary2's alerts
  const alert1 = await waitForElement(() => getByTestId('69526'));
  const alert2 = await waitForElement(() => getByTestId('69530'));

  // no filters selected
  expect(alertSummary1).toBeInTheDocument();
  expect(alertSummary2).toBeInTheDocument();
  expect(alert1).toBeInTheDocument();
  expect(alert2).toBeInTheDocument();

  expect(hideImprovements).not.toHaveClass('active');
  expect(hideDownstream).not.toHaveClass('active');

  // one filter selected
  fireEvent.click(hideImprovements);

  expect(hideImprovements).toHaveClass('active');
  expect(alertSummary1).not.toBeInTheDocument();
  expect(alertSummary2).toBeInTheDocument();
  expect(alert1).toBeInTheDocument();
  expect(alert2).toBeInTheDocument();

  // second filter selected
  fireEvent.click(hideDownstream);
  expect(alertSummary1).not.toBeInTheDocument();
  expect(alertSummary2).toBeInTheDocument();
  expect(alert1).toBeInTheDocument();
  expect(alert2).not.toBeInTheDocument();
});

test('clicking the star icon for an alert updates that alert', async () => {
  const { getByTestId } = alertsViewControls();

  const starIcon = await waitForElement(() => getByTestId('alert 69345 star'));
  fireEvent.click(starIcon);

  expect(modifyAlertSpy).toHaveBeenCalled();
  expect(modifyAlertSpy.mock.results[0].value).toStrictEqual({
    data: {
      ...testAlertSummaries[0].alerts[0],
      ...{ starred: true },
    },
    failureStatus: null,
  });
  modifyAlertSpy.mockClear();
});

test('selecting all alerts and marking them as acknowledged updates all alerts', async () => {
  const { getByTestId, getByText, queryByText } = alertsViewControls();

  // select all alerts
  const summaryCheckbox = getByTestId('alert summary 20174 checkbox');
  const alertCheckbox1 = getByTestId('alert 69344 checkbox');
  const alertCheckbox2 = getByTestId('alert 69345 checkbox');

  fireEvent.click(summaryCheckbox);
  expect(summaryCheckbox).toHaveProperty('checked', true);
  expect(alertCheckbox1).toHaveProperty('checked', true);
  expect(alertCheckbox2).toHaveProperty('checked', true);
  let acknowledgeButton = await waitForElement(() => getByText('Acknowledge'));

  fireEvent.click(acknowledgeButton);

  // all alerts have been updated
  expect(modifyAlertSpy).toHaveBeenCalled();
  expect(modifyAlertSpy.mock.results[0].value).toStrictEqual({
    data: {
      ...testAlertSummaries[0].alerts[0],
      ...{ status: 4 },
    },
    failureStatus: null,
  });

  expect(modifyAlertSpy.mock.results[1].value).toStrictEqual({
    data: {
      ...testAlertSummaries[0].alerts[1],
      ...{ status: 4 },
    },
    failureStatus: null,
  });

  // action panel has closed and all checkboxes reset
  acknowledgeButton = await waitForElementToBeRemoved(() =>
    queryByText('Acknowledge'),
  );
  await wait(() => {
    expect(summaryCheckbox).toHaveProperty('checked', false);
    expect(alertCheckbox1).toHaveProperty('checked', false);
    expect(alertCheckbox2).toHaveProperty('checked', false);
  });

  modifyAlertSpy.mockClear();
});

test('selecting an alert and marking it as invalid only updates that alert', async () => {
  const { getByTestId, getByText, queryByText } = alertsViewControls();

  // select one alert
  const alertCheckbox1 = getByTestId('alert 69344 checkbox');
  const alertCheckbox2 = getByTestId('alert 69345 checkbox');

  fireEvent.click(alertCheckbox1);
  expect(alertCheckbox1).toHaveProperty('checked', true);
  expect(alertCheckbox2).toHaveProperty('checked', false);

  let invalidButton = await waitForElement(() => getByText('Mark invalid'));

  fireEvent.click(invalidButton);
  // alert has been updated
  expect(modifyAlertSpy).toHaveBeenCalled();
  expect(modifyAlertSpy.mock.results[0].value).toStrictEqual({
    data: {
      ...testAlertSummaries[0].alerts[1],
      ...{ status: 3 },
    },
    failureStatus: null,
  });

  // action panel has closed and checkbox has reset
  invalidButton = await waitForElementToBeRemoved(() =>
    queryByText('Mark invalid'),
  );

  await wait(() => {
    expect(alertCheckbox1).toHaveProperty('checked', false);
  });

  modifyAlertSpy.mockClear();
});

test('selecting the alert summary checkbox then deselecting one alert only updates the selected alerts', async () => {
  const { getByTestId, getByText, queryByText } = alertsViewControls();

  // select all alerts
  const summaryCheckbox = getByTestId('alert summary 20174 checkbox');
  const alertCheckbox1 = getByTestId('alert 69344 checkbox');
  const alertCheckbox2 = getByTestId('alert 69345 checkbox');

  fireEvent.click(summaryCheckbox);
  expect(summaryCheckbox).toHaveProperty('checked', true);
  expect(alertCheckbox1).toHaveProperty('checked', true);
  expect(alertCheckbox2).toHaveProperty('checked', true);

  // deselect one alert
  fireEvent.click(alertCheckbox1);
  expect(summaryCheckbox).toHaveProperty('checked', false);
  expect(alertCheckbox1).toHaveProperty('checked', false);
  expect(alertCheckbox2).toHaveProperty('checked', true);

  let acknowledgeButton = await waitForElement(() => getByText('Acknowledge'));
  fireEvent.click(acknowledgeButton);

  // only the selected alert has been updated
  expect(modifyAlertSpy).toHaveBeenCalled();
  expect(modifyAlertSpy.mock.results).toHaveLength(1);
  expect(modifyAlertSpy.mock.results[0].value.data.id).toEqual(69345);
  expect(modifyAlertSpy.mock.results[0].value).toStrictEqual({
    data: {
      ...testAlertSummaries[0].alerts[0],
      ...{ status: 4 },
    },
    failureStatus: null,
  });

  // action panel has closed and all checkboxes reset
  acknowledgeButton = await waitForElementToBeRemoved(() =>
    queryByText('Acknowledge'),
  );
  await wait(() => {
    expect(summaryCheckbox).toHaveProperty('checked', false);
    expect(alertCheckbox1).toHaveProperty('checked', false);
    expect(alertCheckbox2).toHaveProperty('checked', false);
  });

  modifyAlertSpy.mockClear();
});

test("display of alert summaries's assignee badge", async () => {
  const { getAllByTitle, getAllByText } = alertsViewControls();

  const ownershipBadges = getAllByTitle('Click to change assignee');
  const takeButtons = getAllByText('Take');

  // summary with no assignee defaults to "Unassigned" badge &
  // displays the 'Take' button
  expect(ownershipBadges[0]).toHaveTextContent('Unassigned');
  expect(takeButtons).toHaveLength(1);

  // summary with assignee displays username extracted from email &
  // hides the 'Take' button
  expect(ownershipBadges[1]).toHaveTextContent('test_user');
});

test("'Take' button hides when clicking on 'Unassigned' badge", async () => {
  const {
    getByText,
    queryByText,
    queryByPlaceholderText,
  } = alertsViewControls();

  const unassignedBadge = await waitForElement(() => getByText('Unassigned'));

  await fireEvent.click(unassignedBadge);
  expect(queryByText('Take')).not.toBeInTheDocument();
  // and the placeholder nicely shows up
  expect(queryByPlaceholderText('nobody@mozilla.org')).toBeInTheDocument();
});

test('setting an assignee on unassigned alert summary updates the badge accordingly', async () => {
  const { getByText, getByPlaceholderText } = alertsViewControls();

  const unassignedBadge = await waitForElement(() => getByText('Unassigned'));

  fireEvent.click(unassignedBadge);
  const inputField = await waitForElement(() =>
    getByPlaceholderText('nobody@mozilla.org'),
  );
  fireEvent.change(inputField, {
    target: { value: 'mozilla-ldap/test_assignee@mozilla.com' },
  });
  // pressing 'Enter' has some issues on react-testing-library;
  // found workaround on https://github.com/testing-library/react-testing-library/issues/269
  fireEvent.keyPress(inputField, { key: 'Enter', keyCode: 13 });

  // ensure this updated the assignee
  await waitForElement(() => getByText('test_assignee'));
});

test('setting an assignee on an already assigned summary is possible', async () => {
  const { getByText, getByDisplayValue } = alertsViewControls();

  const unassignedBadge = await waitForElement(() => getByText('test_user'));

  fireEvent.click(unassignedBadge);
  const inputField = await waitForElement(() =>
    getByDisplayValue('mozilla-ldap/test_user@mozilla.com'),
  );
  fireEvent.change(inputField, {
    target: { value: 'mozilla-ldap/test_another_user@mozilla.com' },
  });
  // pressing 'Enter' has some issues on react-testing-library;
  // found workaround on https://github.com/testing-library/react-testing-library/issues/269
  fireEvent.keyPress(inputField, { key: 'Enter', keyCode: 13 });

  // ensure this updated the assignee
  await waitForElement(() => getByText('test_another_user'));
});

test("'Escape' from partially editted assignee does not update original assignee", async () => {
  const { getByText, getByDisplayValue } = alertsViewControls();

  const unassignedBadge = await waitForElement(() => getByText('test_user'));

  fireEvent.click(unassignedBadge);
  const inputField = await waitForElement(() =>
    getByDisplayValue('mozilla-ldap/test_user@mozilla.com'),
  );
  fireEvent.change(inputField, {
    target: { value: 'mozilla-ldap/test_another_' },
  });
  fireEvent.keyDown(inputField, { key: 'Escape' });

  // ensure assignee wasn't updated
  await waitForElement(() => getByText('test_user'));
});

test("Clicking on 'Take' prefills with logged in user", async () => {
  const { getByText, getByDisplayValue } = alertsViewControls();

  const takeButton = getByText('Take');

  fireEvent.click(takeButton);

  // ensure it preffiled input field
  await waitForElement(() =>
    getByDisplayValue('mozilla-ldap/test_user@mozilla.com'),
  );
});

test('Alerts retriggered by the backfill bot have a title', async () => {
  const { queryAllByTitle } = alertsViewControls();

  const titles = await waitForElement(() =>
    queryAllByTitle(backfillRetriggeredTitle),
  );
  expect(titles).toHaveLength(1);
});

describe('"My alerts" checkbox\'s display behaviors', () => {
  // By default, user is logged in &
  // status & framework dropdowns are available

  test('Not displayed in Alerts view (detailed mode)', async () => {
    const { queryByText } = alertsViewControls({
      isListingAlertSummaries: false,
    }); // as Django detailed view mode

    expect(queryByText('My alerts')).not.toBeInTheDocument();
  });

  test('Not displayed in Alerts view (detailed mode), even when param is missing', async () => {
    const { queryByText } = alertsViewControls({ alertDropdowns: [] });

    expect(queryByText('My alerts')).not.toBeInTheDocument();
  });

  test('Displayed in Alerts view (list mode)', async () => {
    const { getByText } = alertsViewControls({ isListingAlertSummaries: true }); // as Django detailed view mode

    const myAlertsCheckbox = await waitForElement(() => getByText('My alerts'));
    expect(myAlertsCheckbox).toBeInTheDocument();
  });

  test('Not displayed if user is not logged in', async () => {
    const { queryByText } = alertsViewControls({
      isListingAlertSummaries: false,
      user: { isLoggedIn: false },
    });

    expect(queryByText('My alerts')).not.toBeInTheDocument();
  });
});

test('Framework name is displayed near alert summary', async () => {
  const { queryAllByText } = alertsViewControls();

  const frameworkName = await waitForElement(() =>
    queryAllByText(dummyFrameworkName),
  );
  // one summary from testAlertSummaries have one bad framework id
  expect(frameworkName).toHaveLength(testAlertSummaries.length - 1);
});

test('Correct message is displayed if the framework id is invalid', async () => {
  const { queryAllByText } = alertsViewControls();

  const frameworkName = await waitForElement(() =>
    queryAllByText(unknownFrameworkMessage),
  );
  expect(frameworkName).toHaveLength(1);
});

test('Selecting `all` from framework button does not filter by framework', async () => {
  const { queryAllByText, getByTestId } = alertsView();

  const allFromDropdown = await waitForElement(() => queryAllByText('all'));

  fireEvent.click(allFromDropdown[0]);
  fireEvent.click(allFromDropdown[1]);

  const alert1 = await waitForElement(() => getByTestId('69526'));
  const alert2 = await waitForElement(() => getByTestId('69530'));

  expect(alert1).toBeInTheDocument();
  expect(alert2).toBeInTheDocument();
});

// TODO should write tests for alert summary dropdown menu actions performed in StatusDropdown
// (adding notes or marking as 'fixed', etc)
