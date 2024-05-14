import React from 'react';
import fetchMock from 'fetch-mock';
import { render } from '@testing-library/react';
import { Provider, ReactReduxContext } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';

import App from '../../../ui/App';
import pushListFixture from '../mock/push_list';
import reposFixture from '../mock/repositories';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
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

describe('history', () => {
  const repoName = 'autoland';

  beforeAll(() => {
    fetchMock.get('/revision.txt', []);
    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(getApiUrl('/performance/framework/'), {});
    fetchMock.get(getApiUrl('/user/'), []);
    fetchMock.get(getApiUrl('/failureclassification/'), []);
    fetchMock.get(
      'begin:https://treestatus.prod.lando.prod.cloudops.mozgcp.net/trees/',
      {
        result: {
          message_of_the_day: '',
          reason: '',
          status: 'open',
          tree: repoName,
        },
      },
    );
    fetchMock.get(
      `begin:${getProjectUrl('/push/?full=true&count=', repoName)}`,
      {
        ...pushListFixture,
        results: [pushListFixture.results[0]],
      },
    );
  });

  afterEach(() => {
    history.push('/');
  });

  afterAll(() => {
    fetchMock.reset();
  });

  test('old job-view url should redirect to correct url', async () => {
    history.push(
      '/#/jobs?repo=try&revision=07615c30668c70692d01a58a00e7e271e69ff6f1',
    );
    render(testApp());

    expect(history.location).toEqual(
      expect.objectContaining({
        pathname: '/jobs',
        search: '?repo=try&revision=07615c30668c70692d01a58a00e7e271e69ff6f1',
        hash: '',
      }),
    );
  });

  test('lack of a specified route should redirect to jobs view with a default repo', () => {
    render(testApp());

    expect(history.location).toEqual(
      expect.objectContaining({
        pathname: '/jobs',
        search: '?repo=autoland',
        hash: '',
      }),
    );
  });
});
