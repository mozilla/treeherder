import React from 'react';
import fetchMock from 'fetch-mock';
import { render, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { Provider } from 'react-redux';

import MyPushes from '../../../ui/push-health/MyPushes';
import pushHealthSummaryTryData from '../mock/push_health_summary_try';
import pushHealthSummaryData from '../mock/push_health_summary_all';
import reposFixture from '../mock/repositories';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import { configureStore } from '../../../ui/job-view/redux/configureStore';
import { myPushesDefaultMessage } from '../../../ui/push-health/helpers';

// Wrapper component that provides location and navigate to MyPushes
function MyPushesWithLocation(props) {
  const location = useLocation();
  const navigate = useNavigate();
  return <MyPushes {...props} location={location} navigate={navigate} />;
}

const repo = 'try';
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

  const testMyPushes = (user = testUser, initialEntries = ['/']) => {
    const store = configureStore();
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={initialEntries}>
          <MyPushesWithLocation
            user={user}
            notify={() => {}}
            clearNotification={() => {}}
          />
        </MemoryRouter>
      </Provider>
    );
  };

  test('should show message if no author query param is provided and user is not logged in', async () => {
    const { queryByText } = render(testMyPushes({ isLoggedIn: false }));

    await waitFor(() =>
      expect(queryByText(myPushesDefaultMessage)).toBeInTheDocument(),
    );
  });

  test('should fetch the push health data if user is logged in', async () => {
    const { getAllByText } = render(testMyPushes());

    const pushes = await waitFor(() => getAllByText(testUser.email));
    expect(pushes).toHaveLength(3);
  });

  test('should fetch the push health data by author query string if user is not logged in', async () => {
    const { getAllByText } = render(
      testMyPushes({ email: '', isLoggedIn: false }, [
        `/?author=${testUser.email}`,
      ]),
    );

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
