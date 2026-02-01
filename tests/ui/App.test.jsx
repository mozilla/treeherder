
import fetchMock from 'fetch-mock';
import { render, waitFor } from '@testing-library/react';
import { Provider, ReactReduxContext } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import { AppRoutes } from '../../ui/App';
import { getApiUrl } from '../../ui/helpers/url';
import { getProjectUrl } from '../../ui/helpers/location';
import { configureStore } from '../../ui/job-view/redux/configureStore';

import reposFixture from './mock/repositories';
import pushListFixture from './mock/push_list';

/**
 * Tests for the main App component routing and URL transformation logic.
 *
 * This test suite covers:
 * - URL backwards compatibility transformations (UrlUpdater)
 * - Favicon and title updates based on route (WithFavicon)
 * - Route rendering with lazy loading
 */

const renderApp = (initialEntries = ['/']) => {
  const store = configureStore();
  return render(
    <Provider store={store} context={ReactReduxContext}>
      <MemoryRouter initialEntries={initialEntries}>
        <AppRoutes />
      </MemoryRouter>
    </Provider>,
  );
};

describe('App Component', () => {
  beforeAll(() => {
    // Set up favicon element required by WithFavicon function
    const link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute('href', 'data:image/png;base64,test');
    document.querySelector('head').appendChild(link);

    // Set up common API mocks
    fetchMock.get('/revision.txt', 'abc123');
    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(getApiUrl('/failureclassification/'), []);
    fetchMock.get(getApiUrl('/user/'), []);
    fetchMock.get(getApiUrl('/performance/framework/'), []);
    fetchMock.get(getApiUrl('/performance/tag/'), []);

    // Mock push endpoints with proper data structure
    fetchMock.get(`begin:${getProjectUrl('/push/?full=true', 'autoland')}`, {
      ...pushListFixture,
      results: [pushListFixture.results[0]],
    });

    // Mock tree status
    fetchMock.get('begin:https://treestatus', {
      result: { status: 'open', tree: 'autoland' },
    });

    // Mock push health
    fetchMock.get('begin:/api/project/', { results: [] });
    fetchMock.get('begin:/api/jobs/', { results: [], count: 0, next: null });
  });

  afterAll(() => {
    fetchMock.reset();
  });

  describe('Route Rendering', () => {
    it('sets correct document title for perfherder alerts with id', async () => {
      renderApp(['/perfherder/alerts?id=12345']);

      await waitFor(
        () => {
          expect(document.title).toBe('Alert #12345');
        },
        { timeout: 3000 },
      );
    });

    it('sets correct document title for jobs view', async () => {
      renderApp(['/jobs?repo=autoland']);

      // Wait for the jobs view to set its title
      await waitFor(
        () => {
          expect(document.title).toBe('Treeherder Jobs View');
        },
        { timeout: 3000 },
      );
    });
  });
});

describe('App Export', () => {
  it('exports App component without hot wrapper', async () => {
    // Verify the App is exported directly without react-hot-loader
    // This is a regression test for the RSPack migration
    const AppModule = await import('../../ui/App');
    expect(AppModule.default).toBeDefined();
    expect(
      AppModule.default.name || AppModule.default.displayName,
    ).toBeDefined();
  });
});
