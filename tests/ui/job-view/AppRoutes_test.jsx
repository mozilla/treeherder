import React from 'react';
import fetchMock from 'fetch-mock';
import { render } from '@testing-library/react';
import { Provider, ReactReduxContext } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';

import App from '../../../ui/App';
import reposFixture from '../mock/repositories';
import { getApiUrl } from '../../../ui/helpers/url';
import {
  configureStore,
  history,
} from '../../../ui/job-view/redux/configureStore';

const testApp = () => {
  const store = configureStore();
  return (
    <Provider store={store} context={ReactReduxContext}>
      <ConnectedRouter history={history} context={ReactReduxContext}>
        <App />
      </ConnectedRouter>
    </Provider>
  );
};

describe('Test for backwards-compatible routes for other apps', () => {
  beforeAll(() => {
    fetchMock.get('/revision.txt', []);
    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(getApiUrl('/failureclassification/'), []);
  });

  test('old push health url should redirect to correct url', () => {
    fetchMock.get(
      '/api/project/autoland/push/health/?revision=3c8e093335315c42a87eebf0531effe9cd6fdb95',
      [],
    );

    history.push(
      '/pushhealth.html?repo=autoland&revision=3c8e093335315c42a87eebf0531effe9cd6fdb95',
    );
    render(testApp(), { legacyRoot: true });

    expect(history.location).toEqual(
      expect.objectContaining({
        pathname: '/push-health',
        search:
          '?repo=autoland&revision=3c8e093335315c42a87eebf0531effe9cd6fdb95',
        hash: '',
      }),
    );
  });

  test('old perfherder route should redirect to correct url', () => {
    fetchMock.get('/api/performance/framework/', []);
    fetchMock.get('/api/performance/tag/', []);

    history.push('/perf.html#/alerts?id=27285&hideDwnToInv=0');
    render(testApp(), { legacyRoot: true });

    expect(history.location).toEqual(
      expect.objectContaining({
        pathname: '/perfherder/alerts',
        search: '?id=27285&hideDwnToInv=0',
        hash: '',
      }),
    );
  });

  test('old logviewer route should redirect to correct url', () => {
    history.push(
      '/logviewer.html#/jobs?job_id=319893964&repo=autoland&lineNumber=2728',
    );
    render(testApp(), { legacyRoot: true });

    expect(history.location).toEqual(
      expect.objectContaining({
        pathname: '/logviewer',
        search: '?job_id=319893964&repo=autoland&lineNumber=2728',
        hash: '',
      }),
    );
  });

  test('url is not broken when it contains a table permalink hash', async () => {
    fetchMock.get(getApiUrl('/user/'), []);

    history.push(
      '/perfherder/compare?originalProject=mozilla-central&originalRevision=54e7fb66ad44b8dcb8caab587f929dad60932d71&newProject=mozilla-central&newRevision=54e7fb66ad44b8dcb8caab587f929dad60932d71&framework=1&page=1#tableLink-header-134266337',
    );
    render(testApp(), { legacyRoot: true });

    expect(history.location).toEqual(
      expect.objectContaining({
        pathname: '/perfherder/compare',
        search:
          '?originalProject=mozilla-central&originalRevision=54e7fb66ad44b8dcb8caab587f929dad60932d71&newProject=mozilla-central&newRevision=54e7fb66ad44b8dcb8caab587f929dad60932d71&framework=1&page=1',
        hash: '#tableLink-header-134266337',
      }),
    );
  });
});
