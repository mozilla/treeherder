/* eslint-disable jest/expect-expect */
import React from 'react';
import {
  render,
  fireEvent,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { createBrowserHistory } from 'history';
import fetchMock from 'fetch-mock';
import { ConnectedRouter } from 'connected-react-router';
import { Provider, ReactReduxContext } from 'react-redux';

import { configureStore } from '../../../../ui/job-view/redux/configureStore';
import {
  endpoints,
  filterText,
  unknownFrameworkMessage,
  backfillRetriggeredTitle,
  alertBackfillResultVisual,
  alertBackfillResultStatusMap,
  notSupportedAlertFiltersMessage,
} from '../../../../ui/perfherder/perf-helpers/constants';
import repos from '../../mock/repositories';
import { getApiUrl } from '../../../../ui/helpers/url';
import AlertsView from '../../../../ui/perfherder/alerts/AlertsView';
import AlertsViewControls from '../../../../ui/perfherder/alerts/AlertsViewControls';
import optionCollectionMap from '../../mock/optionCollectionMap';
import testAlertSummaries from '../../mock/alert_summaries';
import testPerformanceTags from '../../mock/performance_tags';
import TagsList from '../../../../ui/perfherder/alerts/TagsList';

const history = createBrowserHistory();

const testUser = {
  username: 'mozilla-ldap/test_user@mozilla.com',
  isLoggedIn: true,
  isStaff: true,
  email: 'test_user@mozilla.com',
};

const ignoreFrameworkOption = { id: -1, name: 'all' };
const frameworks = [
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
  { id: 15, name: 'mozperftest' },
  { id: 16, name: 'fxrecord' },
];

const dummyFrameworkName = 'someTestFramework';
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

const testActiveTags = ['first-tag', 'second-tag'];

afterEach(() => history.push('/alerts'));

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

const alertsView = () => {
  const store = configureStore(history);

  return render(
    <Provider store={store} context={ReactReduxContext}>
      <ConnectedRouter history={history} context={ReactReduxContext}>
        <AlertsView
          user={testUser}
          projects={repos}
          location={history.location}
          frameworks={frameworks}
          performanceTags={testPerformanceTags}
          history={history}
        />
      </ConnectedRouter>
    </Provider>,
    { legacyRoot: true },
  );
};

const alertsViewControls = ({
  isListMode = true,
  user: userMock = null,
} = {}) => {
  const user = userMock !== null ? userMock : testUser;
  const store = configureStore(history);

  return render(
    <Provider store={store} context={ReactReduxContext}>
      <ConnectedRouter history={history} context={ReactReduxContext}>
        <AlertsViewControls
          validated={{
            hideDwnToInv: undefined,
            filter: undefined,
            updateParams: () => {},
          }}
          isListMode={isListMode}
          alertSummaries={testAlertSummaries}
          issueTrackers={testIssueTrackers}
          optionCollectionMap={optionCollectionMap}
          fetchAlertSummaries={() => {}}
          updateViewState={() => {}}
          user={user}
          modifyAlert={(alert, params) => mockModifyAlert.update(alert, params)}
          updateAlertSummary={() =>
            Promise.resolve({
              failureStatus: false,
              data: 'alert summary data',
            })
          }
          projects={repos}
          location={history.location}
          filters={{
            filterText: '',
            hideDownstream: false,
            hideAssignedToOthers: false,
            framework: { name: 'talos', id: 1 },
            status: 'untriaged',
          }}
          frameworks={[{ id: 1, name: dummyFrameworkName }]}
          frameworkOptions={[ignoreFrameworkOption, ...frameworks]}
          setFiltersState={() => {}}
          performanceTags={testPerformanceTags}
          history={history}
        />
      </ConnectedRouter>
    </Provider>,
    { legacyRoot: true },
  );
};

const tagsList = (tags = []) => {
  return render(<TagsList tags={tags} />, { legacyRoot: true });
};

const modifyAlertSpy = jest.spyOn(mockModifyAlert, 'update');

beforeAll(() => {
  fetchMock.mock(getApiUrl(endpoints.issueTrackers), testIssueTrackers);

  fetchMock.mock(`begin:${getApiUrl(endpoints.alertSummary)}`, {
    count: 3,
    next: null,
    previous: null,
    results: testAlertSummaries,
  });

  fetchMock.mock(getApiUrl('/optioncollectionhash/'), [
    {
      option_collection_hash: '102210fe594ee9b33d82058545b1ed14f4c8206e',
      options: [
        {
          name: testAlertSummaries[0].alerts[0].series_signature.options[0],
        },
      ],
    },
  ]);

  fetchMock.mock(getApiUrl(endpoints.performanceTags), testPerformanceTags);
});

test('toggle buttons should filter alert summary and alerts by selected filter', async () => {
  const { getByText, getByTestId } = alertsView();
  const hideDownstream = getByText('Hide downstream / reassigned to / invalid');

  const alertSummary1 = await waitFor(() =>
    getByTestId(`alert summary ${testAlertSummaries[0].id.toString()} title`),
  );
  const alertSummary2 = await waitFor(() =>
    getByTestId(`alert summary ${testAlertSummaries[1].id.toString()} title`),
  );

  // alertSummary2's alerts
  const alert1 = await waitFor(() => getByTestId('69526'));
  const alert2 = await waitFor(() => getByTestId('69530'));

  // no filters selected
  expect(alertSummary1).toBeInTheDocument();
  expect(alertSummary2).toBeInTheDocument();
  expect(alert1).toBeInTheDocument();
  expect(alert2).toBeInTheDocument();

  expect(hideDownstream).not.toHaveClass('active');

  // filter selected
  fireEvent.click(hideDownstream);

  expect(alertSummary1).toBeInTheDocument();
  expect(alertSummary2).toBeInTheDocument();
  expect(alert1).toBeInTheDocument();
  expect(alert2).not.toBeInTheDocument();
});

describe('alert filtering ignores repository and/or options', () => {
  const testCases = [
    [
      repos[0].name,
      testAlertSummaries[0].alerts[0].series_signature.options[0],
    ],
    [repos[0].name],
    [testAlertSummaries[0].alerts[0].series_signature.options[0]],
  ];
  testCases.forEach((testCase) => {
    it(`testcase: ${testCase.toString()}`, async () => {
      const { getByPlaceholderText, getByText } = alertsView();
      const alertsFilterInput = await waitFor(() =>
        getByPlaceholderText(filterText.inputPlaceholder),
      );

      fireEvent.change(alertsFilterInput, {
        target: {
          value: `${testCase.join(' ')} 
                  ${
                    testAlertSummaries[0].alerts[0].series_signature
                      .machine_platform
                  }`,
        },
      });
      fireEvent.keyDown(alertsFilterInput, { key: 'Enter', keyCode: 13 });

      const warningMessage = await getByText(
        notSupportedAlertFiltersMessage(testCase),
      );
      expect(warningMessage).toBeInTheDocument();
    });
  });
});

test('Debug Tools heading not displayed for non-browsertime summaries', async () => {
  const alertSummary1 = testAlertSummaries[0];

  const { queryByTestId } = alertsViewControls();

  expect(
    queryByTestId(`${alertSummary1.id.toString()} Debug Tools`),
  ).not.toBeInTheDocument();
});

test('Debug Tools heading displayed for browsertime summaries', async () => {
  const alertSummary1 = testAlertSummaries[2];

  const { getByTestId } = alertsViewControls();

  const heading = await waitFor(() =>
    getByTestId(`${alertSummary1.id.toString()} Debug Tools`),
  );

  expect(heading).toBeInTheDocument();
});

test('clicking the star icon for an alert updates that alert', async () => {
  const { getByTestId } = alertsViewControls();

  const starIcon = await waitFor(() => getByTestId('alert 69345 star'));
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
  let acknowledgeButton = await waitFor(() => getByText('Acknowledge'));

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
  await waitFor(() => {
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

  let invalidButton = await waitFor(() => getByText('Mark invalid'));

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

  await waitFor(() => {
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
  const alertCheckbox3 = getByTestId('alert 69346 checkbox');
  const alertCheckbox4 = getByTestId('alert 69347 checkbox');

  fireEvent.click(summaryCheckbox);
  expect(summaryCheckbox).toHaveProperty('checked', true);
  expect(alertCheckbox1).toHaveProperty('checked', true);
  expect(alertCheckbox2).toHaveProperty('checked', true);
  expect(alertCheckbox3).toHaveProperty('checked', true);
  expect(alertCheckbox4).toHaveProperty('checked', true);

  // deselect one alert
  fireEvent.click(alertCheckbox1);
  expect(summaryCheckbox).toHaveProperty('checked', false);
  expect(alertCheckbox1).toHaveProperty('checked', false);
  expect(alertCheckbox2).toHaveProperty('checked', true);
  expect(alertCheckbox3).toHaveProperty('checked', true);
  expect(alertCheckbox4).toHaveProperty('checked', true);

  let acknowledgeButton = await waitFor(() => getByText('Acknowledge'));
  fireEvent.click(acknowledgeButton);

  // only the selected alert has been updated
  expect(modifyAlertSpy).toHaveBeenCalled();
  expect(modifyAlertSpy.mock.results).toHaveLength(3);
  expect(modifyAlertSpy.mock.results[0].value.data.id).toBe(69345);
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
  await waitFor(() => {
    expect(summaryCheckbox).toHaveProperty('checked', false);
    expect(alertCheckbox1).toHaveProperty('checked', false);
    expect(alertCheckbox2).toHaveProperty('checked', false);
    expect(alertCheckbox3).toHaveProperty('checked', false);
    expect(alertCheckbox4).toHaveProperty('checked', false);
  });

  modifyAlertSpy.mockClear();
});

test('selecting the alert summary checkbox then clicking on the reassign button opens the alert modal', async () => {
  const { getByTestId, getByText } = alertsViewControls();

  // select summary
  const summaryCheckbox = getByTestId('alert summary 20174 checkbox');
  fireEvent.click(summaryCheckbox);

  const reassignButton = await waitFor(() => getByText('Reassign'));
  fireEvent.click(reassignButton);

  const alertModal = await waitFor(() => getByText('Reassign Alerts'));
  expect(alertModal).toBeInTheDocument();
});

test("display of alert summaries's assignee badge", async () => {
  const alertSummary = testAlertSummaries[2];
  alertSummary.assignee_email = 'test_user@mozilla.com';
  alertSummary.assignee_username = 'mozilla-ldap/test_user@mozilla.com';

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
  const alertSummary = testAlertSummaries[2];
  alertSummary.assignee_email = 'test_user@mozilla.com';
  alertSummary.assignee_username = 'mozilla-ldap/test_user@mozilla.com';

  const { getByText, queryByText, queryByPlaceholderText } =
    alertsViewControls();

  const unassignedBadge = await waitFor(() => getByText('Unassigned'));

  await fireEvent.click(unassignedBadge);
  expect(queryByText('Take')).not.toBeInTheDocument();
  // and the placeholder nicely shows up
  expect(queryByPlaceholderText('nobody@mozilla.org')).toBeInTheDocument();
});

test('setting an assignee on unassigned alert summary updates the badge accordingly', async () => {
  const alertSummary = testAlertSummaries[2];
  alertSummary.assignee_email = 'test_user@mozilla.com';
  alertSummary.assignee_username = 'mozilla-ldap/test_user@mozilla.com';

  const { getByText, getByPlaceholderText } = alertsViewControls();

  const unassignedBadge = await waitFor(() => getByText('Unassigned'));

  fireEvent.click(unassignedBadge);
  const inputField = await waitFor(() =>
    getByPlaceholderText('nobody@mozilla.org'),
  );
  fireEvent.change(inputField, {
    target: { value: 'mozilla-ldap/test_assignee@mozilla.com' },
  });
  // pressing 'Enter' has some issues on react-testing-library;
  // found workaround on https://github.com/testing-library/react-testing-library/issues/269
  fireEvent.keyPress(inputField, { key: 'Enter', keyCode: 13 });

  // ensure this updated the assignee
  await waitFor(() => getByText('test_assignee'));
});

test('setting an assignee on an already assigned summary is possible', async () => {
  const alertSummary = testAlertSummaries[2];
  alertSummary.assignee_email = null;
  alertSummary.assignee_username = null;

  const { getByText, getByDisplayValue } = alertsViewControls();

  const unassignedBadge = await waitFor(() => getByText('test_user'));

  fireEvent.click(unassignedBadge);
  const inputField = await waitFor(() =>
    getByDisplayValue('test_user@mozilla.com'),
  );
  fireEvent.change(inputField, {
    target: { value: 'test_another_user@mozilla.com' },
  });
  // pressing 'Enter' has some issues on react-testing-library;
  // found workaround on https://github.com/testing-library/react-testing-library/issues/269
  fireEvent.keyPress(inputField, { key: 'Enter', keyCode: 13 });

  // ensure this updated the assignee
  await waitFor(() => getByText('test_another_user'));
});

test("'Escape' from partially editted assignee does not update original assignee", async () => {
  const { getByText, getByDisplayValue } = alertsViewControls();

  const unassignedBadge = await waitFor(() => getByText('test_user'));

  fireEvent.click(unassignedBadge);
  const inputField = await waitFor(() =>
    getByDisplayValue('test_user@mozilla.com'),
  );
  fireEvent.change(inputField, {
    target: { value: 'mozilla-ldap/test_another_' },
  });
  fireEvent.keyDown(inputField, { key: 'Escape' });

  // ensure assignee wasn't updated
  await waitFor(() => getByText('test_user'));
});

test("Clicking on 'Take' prefills with logged in user", async () => {
  const alertSummary = testAlertSummaries[2];
  alertSummary.assignee_email = 'test_user@mozilla.com';
  alertSummary.assignee_username = 'mozilla-ldap/test_user@mozilla.com';

  const { getByText, getByDisplayValue } = alertsViewControls();

  const takeButton = getByText('Take');

  fireEvent.click(takeButton);

  // ensure it preffiled input field
  await waitFor(() => getByDisplayValue('test_user@mozilla.com'));
});

test('Alerts retriggered by the backfill bot have a title', async () => {
  const { queryAllByTitle } = alertsViewControls();

  const titles = await waitFor(() => queryAllByTitle(backfillRetriggeredTitle));
  expect(titles).toHaveLength(3);
});

describe('"My alerts" checkbox\'s display behaviors', () => {
  // By default, user is logged in &
  // status & framework dropdowns are available

  test('Not displayed in Alerts view (detailed mode)', async () => {
    const { queryByText } = alertsViewControls({
      isListMode: false,
    }); // as Django detailed view mode

    expect(queryByText('My alerts')).not.toBeInTheDocument();
  });

  test('Displayed in Alerts view (list mode)', async () => {
    const { getByText } = alertsViewControls({ isListMode: true }); // as Django detailed view mode

    const myAlertsCheckbox = await waitFor(() => getByText('My alerts'));
    expect(myAlertsCheckbox).toBeInTheDocument();
  });

  test('Not displayed if user is not logged in', async () => {
    const { queryByText } = alertsViewControls({
      user: { isLoggedIn: false },
    });

    expect(queryByText('My alerts')).not.toBeInTheDocument();
  });
});

test('Framework name is displayed near alert summary', async () => {
  const { queryAllByText } = alertsViewControls();

  const frameworkName = await waitFor(() => queryAllByText(dummyFrameworkName));
  // one summary from testAlertSummaries have one bad framework id
  expect(frameworkName).toHaveLength(1);
});

test('Correct message is displayed if the framework id is invalid', async () => {
  const { queryAllByText } = alertsViewControls();

  const frameworkName = await waitFor(() =>
    queryAllByText(unknownFrameworkMessage),
  );

  // We expect 2 invalid frameworks because one is the alert with different framework id in the first item,
  // and the second one is the browsertime alert whose framework_id is not present in frameworks param
  // when the AlertsViewControls is mocked
  expect(frameworkName).toHaveLength(2);
});

test('Selecting `all` from (frameworks|projects) dropdown shows all (frameworks|projects)', async () => {
  const { queryAllByText, getByTestId } = alertsView();

  const allFromDropdown = await waitFor(() => queryAllByText(/all/));
  fireEvent.click(allFromDropdown[0]);
  fireEvent.click(allFromDropdown[1]);

  const alert1 = await waitFor(() => getByTestId('69526'));
  const alert2 = await waitFor(() => getByTestId('69530'));

  expect(alert1).toBeInTheDocument();
  expect(alert2).toBeInTheDocument();
});

test('A list of two tags is displayed when there are two active tags', async () => {
  const { queryAllByTestId } = tagsList(testActiveTags);

  const tags = await waitFor(() => queryAllByTestId(/performance-tag/));

  expect(tags).toHaveLength(2);
});

test('No tags are displayed if there is no active tag', async () => {
  const { queryAllByTestId } = tagsList([]);

  const tags = await waitFor(() => queryAllByTestId(/performance-tag/));

  expect(tags).toHaveLength(0);
});

// TODO should write tests for alert summary dropdown menu actions performed in StatusDropdown
// (adding notes or marking as 'fixed', etc)

// assert that alertTableRows contains the alerts in the indicated order
const assertAlertsAreInOrder = async (alertsInOrder, alertTableRows) => {
  for (let index = 0; index < alertsInOrder.length; index++) {
    expect(alertTableRows[index]).toContainElement(alertsInOrder[index]);
  }
};

test(`table data can be sorted in descending order by 'Test'`, async () => {
  const { getAllByLabelText, getByTestId, getAllByTitle } =
    alertsViewControls();

  let alertTableRows = await waitFor(() =>
    getAllByLabelText('Alert table row'),
  );

  const alert1 = await waitFor(() => getByTestId('69344'));
  const alert2 = await waitFor(() => getByTestId('69345'));
  const alert3 = await waitFor(() => getByTestId('69346'));
  const alert4 = await waitFor(() => getByTestId('69347'));

  // alerts are sorted in a default manner without clicking on sort buttons
  await assertAlertsAreInOrder(
    [alert4, alert3, alert1, alert2],
    alertTableRows,
  );

  const sortByTest = await waitFor(() =>
    getAllByTitle('Sorted in default order by test'),
  );

  // firing the sort button once triggers ascending sort
  fireEvent.click(sortByTest[0]);
  // firing the sort button twice triggers descending sort
  fireEvent.click(sortByTest[0]);

  alertTableRows = await waitFor(() => getAllByLabelText('Alert table row'));

  await assertAlertsAreInOrder(
    [alert2, alert1, alert3, alert4],
    alertTableRows,
  );
});

test(`table data can be sorted in ascending order by 'Platform'`, async () => {
  const { getByTestId, getAllByLabelText, getAllByTitle } =
    alertsViewControls();

  let alertTableRows = await waitFor(() =>
    getAllByLabelText('Alert table row'),
  );

  const alert1 = await waitFor(() => getByTestId('69344'));
  const alert2 = await waitFor(() => getByTestId('69345'));
  const alert3 = await waitFor(() => getByTestId('69346'));
  const alert4 = await waitFor(() => getByTestId('69347'));

  // alerts are sorted in a default manner without clicking on sort buttons
  await assertAlertsAreInOrder(
    [alert4, alert3, alert1, alert2],
    alertTableRows,
  );

  const sortByPlatform = await waitFor(() =>
    getAllByTitle('Sorted in default order by platform'),
  );

  // firing the sort button once triggers ascending sort
  fireEvent.click(sortByPlatform[0]);

  alertTableRows = await waitFor(() => getAllByLabelText('Alert table row'));
  await assertAlertsAreInOrder(
    [alert1, alert3, alert4, alert2],
    alertTableRows,
  );
});

test(`table data cannot be sorted by 'Tags & Options'`, async () => {
  const { getAllByTitle } = alertsViewControls();

  const sortByTags = await waitFor(() =>
    getAllByTitle('Sorted by tags & options disabled'),
  );

  expect(sortByTags[0]).toHaveClass('disabled-button');
});

test(`table data can be sorted in ascending order by 'Confidence'`, async () => {
  const { getAllByLabelText, getByTestId, getAllByTitle } =
    alertsViewControls();

  let alertTableRows = await waitFor(() =>
    getAllByLabelText('Alert table row'),
  );

  const alert1 = await waitFor(() => getByTestId('69344'));
  const alert2 = await waitFor(() => getByTestId('69345'));
  const alert3 = await waitFor(() => getByTestId('69346'));
  const alert4 = await waitFor(() => getByTestId('69347'));

  // alerts are sorted in a default manner without clicking on sort buttons
  await assertAlertsAreInOrder(
    [alert4, alert3, alert1, alert2],
    alertTableRows,
  );

  const sortByConfidence = await waitFor(() =>
    getAllByTitle('Sorted in default order by confidence'),
  );

  // firing the sort button once triggers ascending sort
  fireEvent.click(sortByConfidence[0]);

  alertTableRows = await waitFor(() => getAllByLabelText('Alert table row'));
  await assertAlertsAreInOrder(
    [alert2, alert1, alert3, alert4],
    alertTableRows,
  );
});

test(`table data can be sorted in ascending order by 'Magnitude of Change'`, async () => {
  const { getAllByLabelText, getByTestId, getAllByTitle } =
    alertsViewControls();

  let alertTableRows = await waitFor(() =>
    getAllByLabelText('Alert table row'),
  );

  const alert1 = await waitFor(() => getByTestId('69344'));
  const alert2 = await waitFor(() => getByTestId('69345'));
  const alert3 = await waitFor(() => getByTestId('69346'));
  const alert4 = await waitFor(() => getByTestId('69347'));

  // alerts are sorted in a default manner without clicking on sort buttons
  await assertAlertsAreInOrder(
    [alert4, alert3, alert1, alert2],
    alertTableRows,
  );

  const sortByMagnitude = await waitFor(() =>
    getAllByTitle('Sorted in default order by magnitude of change'),
  );

  // firing the sort button once triggers ascending sort
  fireEvent.click(sortByMagnitude[0]);

  alertTableRows = await waitFor(() => getAllByLabelText('Alert table row'));

  await assertAlertsAreInOrder(
    [alert1, alert3, alert4, alert2],
    alertTableRows,
  );
});

test('Data can be sorted only by one column', async () => {
  const { getAllByLabelText, getByTestId, getAllByTitle } =
    alertsViewControls();

  let alertTableRows = await waitFor(() =>
    getAllByLabelText('Alert table row'),
  );

  const alert1 = await waitFor(() => getByTestId('69344'));
  const alert2 = await waitFor(() => getByTestId('69345'));
  const alert3 = await waitFor(() => getByTestId('69346'));
  const alert4 = await waitFor(() => getByTestId('69347'));

  // alerts are sorted in a default manner without clicking on sort buttons
  await assertAlertsAreInOrder(
    [alert4, alert3, alert1, alert2],
    alertTableRows,
  );

  const sortByPlatform = await waitFor(() =>
    getAllByTitle('Sorted in default order by platform'),
  );
  // firing the sort button once triggers ascending sort
  fireEvent.click(sortByPlatform[0]);
  expect(sortByPlatform[0].title).toBe('Sorted in ascending order by platform');

  const sortByConfidence = await waitFor(() =>
    getAllByTitle('Sorted in default order by confidence'),
  );
  fireEvent.click(sortByConfidence[0]);
  expect(sortByConfidence[0].title).toBe(
    'Sorted in ascending order by confidence',
  );
  expect(sortByPlatform[0].title).toBe('Sorted in default order by platform');

  alertTableRows = await waitFor(() => getAllByLabelText('Alert table row'));

  await assertAlertsAreInOrder(
    [alert2, alert1, alert3, alert4],
    alertTableRows,
  );
});

test('Previous alert button should be disable at first', async () => {
  const { getByTestId } = alertsViewControls();

  const prevScrollButton = await waitFor(() =>
    getByTestId('scroll-prev-alert'),
  );

  expect(prevScrollButton).toBeDisabled();
});

test('Next alert button should be disable when reaching the last alert', async () => {
  const { getByTestId } = alertsViewControls();
  Element.prototype.scrollIntoView = jest.fn();

  let nextScrollButton = await waitFor(() => getByTestId('scroll-next-alert'));

  expect(nextScrollButton).not.toBeDisabled();

  fireEvent.click(nextScrollButton);
  fireEvent.click(nextScrollButton);
  fireEvent.click(nextScrollButton);

  nextScrollButton = await waitFor(() => getByTestId('scroll-next-alert'));

  expect(nextScrollButton).toBeDisabled();
});

test('Sherlock backfill status icons are displayed correctly', async () => {
  const { getByTestId } = alertsViewControls();

  const alert = testAlertSummaries[0].alerts[3];
  expect(alert.id).toBe(69347);

  const alertIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} sherlock icon`),
  );

  expect(alertIcon).toBeInTheDocument();
});

test('Sherlock status 0 in tooltip on alerts', async () => {
  const alert = testAlertSummaries[0].alerts[3];
  alert.backfill_record.status = alertBackfillResultStatusMap.preliminary;
  expect(alert.id).toBe(69347);

  const { getByTestId, getByText } = alertsViewControls();
  // hovering over the Sherlock icon should display the tooltip
  const alertIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} sherlock icon`),
  );
  fireEvent.mouseOver(alertIcon);
  await waitFor(() => getByText(alertBackfillResultVisual.preliminary.message));
});

test(`Side-by-side icon is not displayed in Debug Tools column when Sherlock status is 0 (Not backfilled) in tooltip alerts`, async () => {
  const alert = testAlertSummaries[2].alerts[0];
  alert.backfill_record.status = alertBackfillResultStatusMap.preliminary;
  expect(alert.id).toBe(177726);

  const { getByTestId, getByText, queryByTestId } = alertsViewControls();
  // hovering over the Sherlock icon should display the tooltip
  const sherlockIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} sherlock icon`),
  );
  fireEvent.mouseOver(sherlockIcon);
  await waitFor(() => getByText(alertBackfillResultVisual.preliminary.message));
  expect(
    queryByTestId(`alert ${alert.id.toString()} side-by-side icon`),
  ).not.toBeInTheDocument();
});

test('Sherlock status 1 in tooltip on alerts', async () => {
  const alert = testAlertSummaries[0].alerts[3];
  alert.backfill_record.status =
    alertBackfillResultStatusMap.readyForProcessing;
  expect(alert.id).toBe(69347);

  const { getByTestId, getByText } = alertsViewControls();
  // hovering over the Sherlock icon should display the tooltip
  const alertIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} sherlock icon`),
  );
  fireEvent.mouseOver(alertIcon);
  await waitFor(() =>
    getByText(alertBackfillResultVisual.readyForProcessing.message),
  );
});

test(`Side-by-side icon is not displayed in Debug Tools column when Sherlock status is 1 (Soon to be backfilled) in tooltip on alerts`, async () => {
  const alert = testAlertSummaries[2].alerts[0];
  alert.backfill_record.status =
    alertBackfillResultStatusMap.readyForProcessing;
  expect(alert.id).toBe(177726);

  const { getByTestId, getByText, queryByTestId } = alertsViewControls();
  // hovering over the Sherlock icon should display the tooltip
  const sherlockIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} sherlock icon`),
  );
  fireEvent.mouseOver(sherlockIcon);
  await waitFor(() =>
    getByText(alertBackfillResultVisual.readyForProcessing.message),
  );
  expect(
    queryByTestId(`alert ${alert.id.toString()} side-by-side icon`),
  ).not.toBeInTheDocument();
});

test('Sherlock status 2 in tooltip on alerts', async () => {
  const alert = testAlertSummaries[0].alerts[3];
  alert.backfill_record.status = alertBackfillResultStatusMap.backfilled;
  expect(alert.id).toBe(69347);

  const { getByTestId, getByText } = alertsViewControls();
  // hovering over the Sherlock icon should display the tooltip
  const alertIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} sherlock icon`),
  );
  fireEvent.mouseOver(alertIcon);
  await waitFor(() => getByText(alertBackfillResultVisual.backfilled.message));
});

test(`Side-by-side icon is not displayed in Debug Tools column when Sherlock status is 2 (Backfilling in progress) in tooltip on alerts`, async () => {
  const alert = testAlertSummaries[2].alerts[0];
  alert.backfill_record.status = alertBackfillResultStatusMap.backfilled;
  expect(alert.id).toBe(177726);

  const { getByTestId, getByText } = alertsViewControls();
  // hovering over the Sherlock icon should display the tooltip
  const sherlockIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} sherlock icon`),
  );
  fireEvent.mouseOver(sherlockIcon);
  await waitFor(() => getByText(alertBackfillResultVisual.backfilled.message));
  const sxsIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} side-by-side icon`),
  );
  expect(sxsIcon).toBeInTheDocument();
});

test('Sherlock status 3 in tooltip on alerts', async () => {
  const alert = testAlertSummaries[0].alerts[3];
  alert.backfill_record.status = alertBackfillResultStatusMap.successful;
  expect(alert.id).toBe(69347);

  const { getByTestId, getByText } = alertsViewControls();
  // hovering over the Sherlock icon should display the tooltip
  const alertIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} sherlock icon`),
  );
  fireEvent.mouseOver(alertIcon);
  await waitFor(() => getByText(alertBackfillResultVisual.successful.message));
});

test(`Side-by-side icon is displayed in Debug Tools column when Sherlock status is 3 (Backfilled successfully some jobs) in tooltip on alerts`, async () => {
  const alert = testAlertSummaries[2].alerts[0];
  alert.backfill_record.status = alertBackfillResultStatusMap.successful;
  expect(alert.id).toBe(177726);

  const { getByTestId, getByText } = alertsViewControls();
  // hovering over the Sherlock icon should display the tooltip
  const sherlockIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} sherlock icon`),
  );
  fireEvent.mouseOver(sherlockIcon);
  await waitFor(() => getByText(alertBackfillResultVisual.successful.message));
  const sxsIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} side-by-side icon`),
  );
  expect(sxsIcon).toBeInTheDocument();
});

test('Sherlock status 4 in tooltip on alerts', async () => {
  const alert = testAlertSummaries[0].alerts[3];
  alert.backfill_record.status = alertBackfillResultStatusMap.failed;
  expect(alert.id).toBe(69347);

  const { getByTestId, getByText } = alertsViewControls();
  // hovering over the Sherlock icon should display the tooltip
  const alertIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} sherlock icon`),
  );
  fireEvent.mouseOver(alertIcon);
  await waitFor(() => getByText(alertBackfillResultVisual.failed.message));
});

test(`Side-by-side icon is displayed in Debug Tools column when Sherlock status is 4 (Backfilling failed for some jobs) in tooltip on alerts`, async () => {
  const alert = testAlertSummaries[2].alerts[0];
  alert.backfill_record.status = alertBackfillResultStatusMap.failed;
  expect(alert.id).toBe(177726);

  const { getByTestId, getByText } = alertsViewControls();
  // hovering over the Sherlock icon should display the tooltip
  const sherlockIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} sherlock icon`),
  );
  fireEvent.mouseOver(sherlockIcon);
  await waitFor(() => getByText(alertBackfillResultVisual.failed.message));
  const sxsIcon = await waitFor(() =>
    getByTestId(`alert ${alert.id.toString()} side-by-side icon`),
  );
  expect(sxsIcon).toBeInTheDocument();
});

test("Alert's ID can be copied to clipboard", async () => {
  const { queryAllByTitle } = alertsViewControls();
  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn(),
    },
  });

  const alertID = testAlertSummaries[0].id;
  const copyIdButtons = await waitFor(() => queryAllByTitle('Copy Alert ID'));

  fireEvent.click(copyIdButtons[0]);

  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${alertID}`);
});

test('Copy to clipboard button changes from clipboard icon to check icon on click', async () => {
  const { queryAllByTitle } = alertsViewControls();
  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn(),
    },
  });

  const copyIdButtons = await waitFor(() => queryAllByTitle('Copy Alert ID'));

  expect(copyIdButtons[0].innerHTML).toContain('svg-inline--fa fa-clipboard ');

  fireEvent.click(copyIdButtons[0]);

  expect(copyIdButtons[0].innerHTML).toContain(
    'svg-inline--fa fa-circle-check ',
  );

  await waitFor(() =>
    expect(copyIdButtons[0].innerHTML).toContain(
      'svg-inline--fa fa-clipboard ',
    ),
  );
});

test('Prev push revision is displayed in dropdown', async () => {
  const { getAllByTestId } = alertsViewControls();
  const prevPushRevision = testAlertSummaries[0].prev_push_revision.slice(
    0,
    12,
  );

  const pushDropdown = await waitFor(() => getAllByTestId('push-dropdown'));

  fireEvent.click(pushDropdown[0]);

  const prevPush = await waitFor(() => getAllByTestId('prev-push-revision'));

  expect(prevPush[0]).toHaveTextContent(prevPushRevision);
});

test('Current push revision is displayed in dropdown', async () => {
  const { getAllByTestId } = alertsViewControls();
  const pushRevision = testAlertSummaries[0].revision.slice(0, 12);

  const pushDropdown = await waitFor(() => getAllByTestId('push-dropdown'));

  fireEvent.click(pushDropdown[0]);

  const toPush = await waitFor(() => getAllByTestId('to-push-revision'));

  expect(toPush[0]).toHaveTextContent(pushRevision);
});
