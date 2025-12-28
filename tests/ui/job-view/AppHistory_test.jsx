
import fetchMock from 'fetch-mock';
import { render, act } from '@testing-library/react';
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
    const link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute(
      'href',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAB3UlEQVRYCe1Wy43CMBT0LpwAUQQXOEAX3KGDNAAioQFEBSR8CqADklskuoAzDcCFCrwZpKwc/21gtSttpAi/j2fGz3lPEPKXn/F4TPGez2f64+cYDoe00+k8Xqx9RXy4KgdRGIbkcrlUthZiyPF4dMb7rKAYjNPpJCXHNgjyqYS1AJBHUSScnNUMEagOclm/bm1dMpyOL7sKGNcRxzHp9/tGfGMCSEajES1OpeKT+geDAUnT1IhvdQWtVktKonO2221d2D+23++/269sw/IXMVdkY4lYQBAsl0vWJawXiwUJgsAa1zpxs9nQ1WolEMoc8/mcTCYTK2yrJBfyUhBadjqdGvGNCev1mqKlfB4bEdou2O123uQQjCvbbrfaD1NZgSzLHmPX5+T8HggpZomUS1mBer1OGo0Gj+VsA6NWqyn3SVXJsm1asNzn0opWAlzIXUUYBTzTBbPZjBSvlkMbfIa8rIRJhPIjfAU5RCRJQjDISkH8r1QAetd3+PAEsNGGmCmymHAFh8OBYpa/45HNA6ECr+p//gCYB5RKi8Cn6u08z5X/BxDT7xajQgXElKrnfr9XHYylizFplaWzgNvtVgFgjev1yppWa2cB3W6XNJtNARy+Xq8n+P8dv74CX7af1O/M1vwsAAAAAElFTkSuQmCC',
    );
    document.querySelector('head').appendChild(link);

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
      `begin:${getProjectUrl('/push/?full=true&count=10&revision=', 'try')}`,
      { results: [] },
    );
    fetchMock.get(
      `begin:${getProjectUrl('/push/?full=true&count=10', repoName)}`,
      {
        ...pushListFixture,
        results: [pushListFixture.results[0]],
      },
    );
  });

  afterEach(() => {
    act(() => {
      history.push('/');
    });
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
