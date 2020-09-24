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
  backfillRetriggeredTitle,
  unknownFrameworkMessage,
  endpoints,
  filterText,
  notSupportedAlertFiltersMessage,
} from '../../../../ui/perfherder/constants';
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
            hideImprovements: undefined,
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
            hideImprovements: false,
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
  );
};

const tagsList = (tags = []) => {
  return render(<TagsList tags={tags} />);
};

const modifyAlertSpy = jest.spyOn(mockModifyAlert, 'update');

beforeAll(() => {
  fetchMock.mock(getApiUrl(endpoints.issueTrackers), testIssueTrackers);

  fetchMock.mock(`begin:${getApiUrl(endpoints.alertSummary)}`, {
    count: 2,
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
  const hideImprovements = getByText('Hide improvements');
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
    it(testCase.toString(), async () => {
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

  fireEvent.click(summaryCheckbox);
  expect(summaryCheckbox).toHaveProperty('checked', true);
  expect(alertCheckbox1).toHaveProperty('checked', true);
  expect(alertCheckbox2).toHaveProperty('checked', true);

  // deselect one alert
  fireEvent.click(alertCheckbox1);
  expect(summaryCheckbox).toHaveProperty('checked', false);
  expect(alertCheckbox1).toHaveProperty('checked', false);
  expect(alertCheckbox2).toHaveProperty('checked', true);

  let acknowledgeButton = await waitFor(() => getByText('Acknowledge'));
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
  await waitFor(() => {
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

  const unassignedBadge = await waitFor(() => getByText('Unassigned'));

  await fireEvent.click(unassignedBadge);
  expect(queryByText('Take')).not.toBeInTheDocument();
  // and the placeholder nicely shows up
  expect(queryByPlaceholderText('nobody@mozilla.org')).toBeInTheDocument();
});

test('setting an assignee on unassigned alert summary updates the badge accordingly', async () => {
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
  const { getByText, getByDisplayValue } = alertsViewControls();

  const unassignedBadge = await waitFor(() => getByText('test_user'));

  fireEvent.click(unassignedBadge);
  const inputField = await waitFor(() =>
    getByDisplayValue('mozilla-ldap/test_user@mozilla.com'),
  );
  fireEvent.change(inputField, {
    target: { value: 'mozilla-ldap/test_another_user@mozilla.com' },
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
    getByDisplayValue('mozilla-ldap/test_user@mozilla.com'),
  );
  fireEvent.change(inputField, {
    target: { value: 'mozilla-ldap/test_another_' },
  });
  fireEvent.keyDown(inputField, { key: 'Escape' });

  // ensure assignee wasn't updated
  await waitFor(() => getByText('test_user'));
});

test("Clicking on 'Take' prefills with logged in user", async () => {
  const { getByText, getByDisplayValue } = alertsViewControls();

  const takeButton = getByText('Take');

  fireEvent.click(takeButton);

  // ensure it preffiled input field
  await waitFor(() => getByDisplayValue('mozilla-ldap/test_user@mozilla.com'));
});

test('Alerts retriggered by the backfill bot have a title', async () => {
  const { queryAllByTitle } = alertsViewControls();

  const titles = await waitFor(() => queryAllByTitle(backfillRetriggeredTitle));
  expect(titles).toHaveLength(1);
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
  expect(frameworkName).toHaveLength(testAlertSummaries.length - 1);
});

test('Correct message is displayed if the framework id is invalid', async () => {
  const { queryAllByText } = alertsViewControls();

  const frameworkName = await waitFor(() =>
    queryAllByText(unknownFrameworkMessage),
  );
  expect(frameworkName).toHaveLength(1);
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
