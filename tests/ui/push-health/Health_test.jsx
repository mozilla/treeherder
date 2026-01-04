
import fetchMock from 'fetch-mock';
import {
  render,
  cleanup,
  waitFor,
  getAllByTestId,
  queryAllByTestId,
  act,
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { Provider } from 'react-redux';

import Health from '../../../ui/push-health/Health';
import pushHealth from '../mock/push_health';
import reposFixture from '../mock/repositories';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import { configureStore } from '../../../ui/job-view/redux/configureStore';

// Wrapper component that provides location to Health
function HealthWithLocation(props) {
  const location = useLocation();
  return <Health {...props} location={location} />;
}

const revision = 'cd02b96bdce57d9ae53b632ca4740c871d3ecc32';
const repo = 'autoland';

describe('Health', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  beforeAll(() => {
    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(getApiUrl('/user/'), []);
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/ZmoRedHAS56x-v4x8ZCARA/runs/0/artifacts',
      {
        artifacts: [
          {
            storageType: 'reference',
            name: 'public/logs/live.log',
            expires: '2021-01-20T22:31:56.770Z',
            contentType: 'text/plain; charset=utf-8',
          },
        ],
      },
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/R6PG57o6SvaubJl7IMUy3A/runs/0/artifacts',
      {
        artifacts: [
          {
            storageType: 's3',
            name: 'public/logs/live_backing.log',
            expires: '2021-01-20T22:31:56.770Z',
            contentType: 'text/plain; charset=utf-8',
          },
        ],
      },
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/ZcxHIe_pQweTuRjFA-849w/runs/0/artifacts',
      {
        artifacts: [
          {
            storageType: 's3',
            name: 'public/logs/localconfig.json',
            expires: '2021-01-20T22:31:56.770Z',
            contentType: 'application/octet-stream',
          },
        ],
      },
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/AksxU4n9Q1aPituH1GSCKw/runs/0/artifacts',
      {
        artifacts: [
          {
            storageType: 's3',
            name: 'public/test_info/report.html',
            expires: '2021-01-20T22:31:56.770Z',
            contentType: 'text/html; charset=utf-8',
          },
          {
            storageType: 's3',
            name: 'public/test_info/report.xml',
            expires: '2021-01-20T22:31:56.770Z',
            contentType: 'text/xml; charset=utf-8',
          },
        ],
      },
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/GSWobW08RayRuWsYtz9awA/runs/0/artifacts',
      {
        artifacts: [
          {
            storageType: 's3',
            name: 'public/test_info/resource-usage.json',
            expires: '2021-01-20T22:31:56.770Z',
            contentType: 'application/octet-stream',
          },
        ],
      },
    );
    fetchMock.get(getApiUrl('/failureclassification/'), []);
    fetchMock.get(
      getProjectUrl(
        '/push/health/?revision=cd02b96bdce57d9ae53b632ca4740c871d3ecc32',
        repo,
      ),
      pushHealth,
    );
    fetchMock.get(
      getProjectUrl(
        '/push/health_summary/?revision=eeb6fd68c0223a72d8714734a34d3e6da69995e1&with_in_progress_tests=true',
        repo,
      ),
      [],
    );
  });

  afterAll(() => {
    fetchMock.reset();
    cleanup();
  });

  const testHealth = (
    initialEntries = [`/push-health?repo=${repo}&revision=${revision}`],
  ) => {
    const store = configureStore();
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={initialEntries}>
          <HealthWithLocation notify={() => {}} clearNotification={() => {}} />
        </MemoryRouter>
      </Provider>
    );
  };

  test('should show some grouped tests', async () => {
    const health = render(testHealth());
    const classificationGroups = await waitFor(() =>
      health.getAllByTestId('classification-group'),
    );
    const needInvestigationGroups = getAllByTestId(
      classificationGroups[0],
      'test-grouping',
    );

    // Only showing needInvestigation, not intermittents
    expect(classificationGroups).toHaveLength(1);
    expect(needInvestigationGroups).toHaveLength(3);
  });

  test('should filter groups by test path string', async () => {
    const health = render(
      testHealth([
        `/push-health?repo=${repo}&revision=${revision}&searchStr=browser/extensions/`,
      ]),
    );
>>>>>>> 9ccb12fc1 (Migrate from ESLint to Biome)
    const classificationGroups = await waitFor(() =>
      health.getAllByTestId('classification-group'),
    );

    // Only showing needInvestigation, not intermittents
    // No tests match "browser/extensions/" in the mock data
    expect(classificationGroups).toHaveLength(1);
    expect(
      queryAllByTestId(classificationGroups[0], 'test-grouping'),
    ).toHaveLength(0);
  });

  test('should go to the correct tab if query param exists', async () => {
<<<<<<< HEAD
    const { getByText } = render(
      testHealth([`/push-health?repo=${repo}&revision=${revision}&tab=builds`]),
    );
=======
    act(() => {
      history.push(`/push-health?repo=${repo}&revision=${revision}&tab=builds`);
    });
    const { getByText } = render(testHealth());
>>>>>>> 9ccb12fc1 (Migrate from ESLint to Biome)

    const buildsTab = await waitFor(() => getByText('Builds'));
    expect(buildsTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should show dismissible intermittent alert by default', async () => {
<<<<<<< HEAD
=======
    act(() => {
      history.push(`/push-health?repo=${repo}&revision=${revision}`);
    });
>>>>>>> 9ccb12fc1 (Migrate from ESLint to Biome)
    const { getByText } = render(testHealth());

    const alertText = await waitFor(() =>
      getByText('Displaying only issues not known to be intermittents'),
    );
    expect(alertText).toBeInTheDocument();
  });

  test('should hide intermittent alert when dismissed', async () => {
<<<<<<< HEAD
=======
    act(() => {
      history.push(`/push-health?repo=${repo}&revision=${revision}`);
    });
>>>>>>> 9ccb12fc1 (Migrate from ESLint to Biome)
    const { getByText, queryByText, getByRole } = render(testHealth());

    // Wait for alert to appear
    await waitFor(() =>
      getByText('Displaying only issues not known to be intermittents'),
    );

    // Click the dismiss button
    const dismissButton = getByRole('button', { name: /close/i });
    await act(async () => {
      dismissButton.click();
    });

    // Alert should be hidden
    await waitFor(() => {
      expect(
        queryByText('Displaying only issues not known to be intermittents'),
      ).not.toBeInTheDocument();
    });

    // LocalStorage should be set
    expect(localStorage.getItem('dismissedIntermittentAlert')).toBe('true');
  });

  test('should not show intermittent alert if previously dismissed', async () => {
    localStorage.setItem('dismissedIntermittentAlert', 'true');
<<<<<<< HEAD
=======
    act(() => {
      history.push(`/push-health?repo=${repo}&revision=${revision}`);
    });
>>>>>>> 9ccb12fc1 (Migrate from ESLint to Biome)
    const { queryByText } = render(testHealth());

    // Wait for page to load
    await waitFor(() => queryByText('Possible Regressions'));

    // Alert should not be shown
    expect(
      queryByText('Displaying only issues not known to be intermittents'),
    ).not.toBeInTheDocument();
  });
});
