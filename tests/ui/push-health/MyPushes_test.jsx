import React from 'react';
import fetchMock from 'fetch-mock';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { createBrowserHistory } from 'history';
import { ConnectedRouter } from 'connected-react-router';
import { Provider } from 'react-redux';

import MyPushes from '../../../ui/push-health/MyPushes';
import pushHealthSummaryTryData from '../mock/push_health_summary_try';
import pushHealthSummaryData from '../mock/push_health_summary_all';
import reposFixture from '../mock/repositories';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import { configureStore } from '../../../ui/job-view/redux/configureStore';

const repo = 'try';
const history = createBrowserHistory();
const params = 'author=ccoroiu%40mozilla.com&count=5&with_history=true';
const testUser = { email: 'ccoroiu@mozilla.com', isLoggedIn: true };

describe('My Pushes', () => {
  beforeAll(() => {
    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(
      getProjectUrl(`/push/health_summary/?${params}`, repo),
      pushHealthSummaryTryData,
    );
  });

  afterAll(() => {
    fetchMock.reset();
  });

  const testMyPushes = () => {
    const store = configureStore(history);
    return (
      <Provider store={store}>
        <ConnectedRouter history={history}>
          <MyPushes
            user={testUser}
            location={history.location}
            notify={() => {}}
            clearNotification={() => {}}
          />
        </ConnectedRouter>
      </Provider>
    );
  };

  test('should fetch the push health data only for the logged in user', async () => {
    const { getAllByText } = render(testMyPushes(true));

    const pushes = await waitFor(() => getAllByText(testUser.email));
    expect(pushes).toHaveLength(3);
  });

  test('should filter pushes by repos', async () => {
    const { getByText, getAllByTestId, queryByText } = render(testMyPushes());

    const tryPushes = await waitFor(() => getAllByTestId('header-repo'));
    expect(tryPushes).toHaveLength(3);
    expect(tryPushes.map((node) => node.textContent)).toEqual([
      'try',
      'try',
      'try',
    ]);

    const dropdownButton = await waitFor(() => getByText('try pushes'));
    fireEvent.click(dropdownButton);

    fetchMock.get(
      getProjectUrl(`/push/health_summary/?${params}&all_repos=true`, repo),
      pushHealthSummaryData,
    );

    const allRepos = await waitFor(() => getByText('all'));
    fireEvent.click(allRepos);

    await waitFor(() =>
      expect(queryByText('loading page, please wait')).toBeNull(),
    );

    const allPushes = await waitFor(() => getAllByTestId('header-repo'));
    expect(allPushes).toHaveLength(3);
    expect(allPushes.map((node) => node.textContent)).toEqual([
      'autoland',
      'mozilla-central',
      'autoland',
    ]);
  });
});
