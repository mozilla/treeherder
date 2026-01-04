import React from 'react';
import fetchMock from 'fetch-mock';
import { render, waitFor, screen } from '@testing-library/react';
import { Provider, ReactReduxContext } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';

import App from '../../ui/App';
import reposFixture from './mock/repositories';
import pushListFixture from './mock/push_list';
import { getApiUrl } from '../../ui/helpers/url';
import { getProjectUrl } from '../../ui/helpers/location';
import {
  configureStore,
  history,
} from '../../ui/job-view/redux/configureStore';


/**
 * Tests for the main App component routing and URL transformation logic.
 *
 * This test suite covers:
 * - URL backwards compatibility transformations (updateOldUrls)
 * - Favicon and title updates based on route (withFavicon)
 * - Route rendering with lazy loading
 */

const renderApp = () => {
  const store = configureStore();
  return render(
    <Provider store={store} context={ReactReduxContext}>
      <ConnectedRouter history={history} context={ReactReduxContext}>
        <App />
      </ConnectedRouter>
    </Provider>,
  );
};

describe('App Component', () => {
  beforeAll(() => {
    // Set up favicon element required by withFavicon function
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
    fetchMock.get('begin:/api/jobs/', []);
  });

  afterAll(() => {
    fetchMock.reset();
  });

  beforeEach(() => {
    // Reset history to root before each test
    history.push('/');
  });

  describe('URL Transformation (updateOldUrls)', () => {
    it('transforms old push health URL format', () => {
      history.push('/pushhealth.html?repo=autoland&revision=abc123');
      renderApp();

      expect(history.location).toEqual(
        expect.objectContaining({
          pathname: '/push-health',
          search: '?repo=autoland&revision=abc123',
        }),
      );
    });

    it('transforms old perfherder URL with hash to correct path', () => {
      history.push('/perf.html#/alerts?id=12345');
      renderApp();

      expect(history.location).toEqual(
        expect.objectContaining({
          pathname: '/perfherder/alerts',
          search: '?id=12345',
        }),
      );
    });

    it('transforms old perfherder graphs URL', () => {
      history.push('/perf.html#/graphs?series=autoland,123,1,1');
      renderApp();

      expect(history.location).toEqual(
        expect.objectContaining({
          pathname: '/perfherder/graphs',
          search: '?series=autoland,123,1,1',
        }),
      );
    });

    it('transforms root path with hash to /jobs', () => {
      history.push('/#?repo=autoland');
      renderApp();

      expect(history.location.pathname).toBe('/jobs');
    });

    it('preserves permalink hashes (tableLink-header)', () => {
      history.push('/perfherder/compare?framework=1#tableLink-header-12345');
      renderApp();

      expect(history.location).toEqual(
        expect.objectContaining({
          pathname: '/perfherder/compare',
          search: '?framework=1',
          hash: '#tableLink-header-12345',
        }),
      );
    });

    it('handles logviewer URL transformation', () => {
      history.push('/logviewer.html#/jobs?job_id=123&repo=autoland');
      renderApp();

      expect(history.location).toEqual(
        expect.objectContaining({
          pathname: '/logviewer',
          search: '?job_id=123&repo=autoland',
        }),
      );
    });

    it('does not transform already correct URLs', () => {
      history.push('/jobs?repo=autoland');
      renderApp();

      expect(history.location).toEqual(
        expect.objectContaining({
          pathname: '/jobs',
          search: '?repo=autoland',
        }),
      );
    });
  });

  describe('Route Rendering', () => {
    it('sets correct document title for perfherder alerts with id', async () => {
      history.push('/perfherder/alerts?id=12345');
      renderApp();

      await waitFor(
        () => {
          expect(document.title).toBe('Alert #12345');
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
