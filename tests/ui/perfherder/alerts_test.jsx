import React from 'react';
import {
  render,
  cleanup,
  fireEvent,
  waitForElement,
  waitForElementToBeRemoved,
  wait,
} from '@testing-library/react';

import AlertsViewControls from '../../../ui/perfherder/alerts/AlertsViewControls';
import optionCollectionMap from '../mock/optionCollectionMap';
import { summaryStatusMap } from '../../../ui/perfherder/constants';

const testUser = {
  username: 'test user',
  is_superuser: false,
  is_staff: true,
  email: 'test_user@mozilla.com',
};

const testAlertSummaries = [
  {
    id: 20174,
    push_id: 477720,
    prev_push_id: 477665,
    created: '2019-05-20T11:41:31.419156',
    repository: 'mozilla-inbound',
    framework: 1,
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
          framework_id: 1,
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
    options: ['talos', 'build metrics'],
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

const alertsViewControls = () =>
  render(
    <AlertsViewControls
      validated={{
        hideDwnToInv: undefined,
        hideImprovements: undefined,
        filter: undefined,
        projects: [
          { id: 1, name: 'mozilla-central' },
          { id: 2, name: 'mozilla-inbound' },
        ],
        updateParams: () => {},
      }}
      dropdownOptions={testAlertDropdowns}
      alertSummaries={testAlertSummaries}
      issueTrackers={testIssueTrackers}
      optionCollectionMap={optionCollectionMap}
      fetchAlertSummaries={() => {}}
      updateViewState={() => {}}
      user={testUser}
      modifyAlert={(alert, params) => mockModifyAlert.update(alert, params)}
    />,
  );

const modifyAlertSpy = jest.spyOn(mockModifyAlert, 'update');

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

  let confirmingButton = await waitForElement(() => getByText('Confirming'));
  fireEvent.click(confirmingButton);

  // only the selected alert has been updated
  expect(modifyAlertSpy).toHaveBeenCalled();
  expect(modifyAlertSpy.mock.results).toHaveLength(1);
  expect(modifyAlertSpy.mock.results[0].value.data.id).toEqual(69345);
  expect(modifyAlertSpy.mock.results[0].value).toStrictEqual({
    data: {
      ...testAlertSummaries[0].alerts[0],
      ...{ status: 5 },
    },
    failureStatus: null,
  });

  // action panel has closed and all checkboxes reset
  confirmingButton = await waitForElementToBeRemoved(() =>
    queryByText('Confirming'),
  );
  await wait(() => {
    expect(summaryCheckbox).toHaveProperty('checked', false);
    expect(alertCheckbox1).toHaveProperty('checked', false);
    expect(alertCheckbox2).toHaveProperty('checked', false);
  });

  modifyAlertSpy.mockClear();
});

// TODO should write tests for alert summary dropdown menu actions performed in StatusDropdown
// (adding notes or marking as 'fixed', etc)
