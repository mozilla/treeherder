
import fetchMock from 'fetch-mock';
import { render, waitFor, fireEvent, act } from '@testing-library/react';
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
import { myPushesDefaultMessage } from '../../../ui/push-health/helpers';

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

  const testMyPushes = (user = testUser) => {
    const store = configureStore(history);
    return (
      <Provider store={store}>
        <ConnectedRouter history={history}>
          <MyPushes
            user={user}
            location={history.location}
            notify={() => {}}
            clearNotification={() => {}}
            history={history}
          />
        </ConnectedRouter>
      </Provider>
    );
  };

  test('should show message if no author query param is provided and user is not logged in', async () => {
    const { queryByText } = render(testMyPushes({ isLoggedIn: false }));

    // verify no author query param exists
    expect(history.location.search).toBe('');

    await waitFor(() =>
      expect(queryByText(myPushesDefaultMessage)).toBeInTheDocument(),
    );
  });

  test('should fetch the push health data if user is logged in and update query param', async () => {
    const { getAllByText } = render(testMyPushes());

    const pushes = await waitFor(() => getAllByText(testUser.email));
    expect(pushes).toHaveLength(3);
    expect(history.location.search).toContain(`?author=${testUser.email}`);
    history.location.search = '';
  });

  test('should fetch the push health data by author query string if user is not logged in', async () => {
    history.location.search = `?author=${testUser.email}`;
    const { getAllByText } = render(
      testMyPushes({ email: '', isLoggedIn: false }),
    );

    const pushes = await waitFor(() => getAllByText(testUser.email));
    expect(pushes).toHaveLength(3);
    history.location.search = '';
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

    await act(async () => {
      fireEvent.click(dropdownButton);
    });

    fetchMock.get(
      getProjectUrl(`/push/health_summary/?${params}&all_repos=true`, repo),
      pushHealthSummaryData,
    );

    const allRepos = await waitFor(() => getByText('all'));

    await act(async () => {
      fireEvent.click(allRepos);
    });

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
