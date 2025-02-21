import React from 'react';
import fetchMock from 'fetch-mock';
import { render, fireEvent } from '@testing-library/react';
import { Provider, ReactReduxContext } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';

import App from '../../../ui/App';
import reposFixture from '../mock/repositories';
import pushListFixture from '../mock/push_list';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import fullJob from '../mock/full_job.json';
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

describe('Logviewer App', () => {
  const repoName = 'autoland';

  beforeAll(() => {
    history.push('/logviewer?job_id=259537375&repo=autoland');

    const link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute(
      'href',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAB3UlEQVRYCe1Wy43CMBT0LpwAUQQXOEAX3KGDNAAioQFEBSR8CqADklskuoAzDcCFCrwZpKwc/21gtSttpAi/j2fGz3lPEPKXn/F4TPGez2f64+cYDoe00+k8Xqx9RXy4KgdRGIbkcrlUthZiyPF4dMb7rKAYjNPpJCXHNgjyqYS1AJBHUSScnNUMEagOclm/bm1dMpyOL7sKGNcRxzHp9/tGfGMCSEajES1OpeKT+geDAUnT1IhvdQWtVktKonO2221d2D+23++/269sw/IXMVdkY4lYQBAsl0vWJawXiwUJgsAa1zpxs9nQ1WolEMoc8/mcTCYTK2yrJBfyUhBadjqdGvGNCev1mqKlfB4bEdou2O123uQQjCvbbrfaD1NZgSzLHmPX5+T8HggpZomUS1mBer1OGo0Gj+VsA6NWqyn3SVXJsm1asNzn0opWAlzIXUUYBTzTBbPZjBSvlkMbfIa8rIRJhPIjfAU5RCRJQjDISkH8r1QAetd3+PAEsNGGmCmymHAFh8OBYpa/45HNA6ECr+p//gCYB5RKi8Cn6u08z5X/BxDT7xajQgXElKrnfr9XHYylizFplaWzgNvtVgFgjev1yppWa2cB3W6XNJtNARy+Xq8n+P8dv74CX7af1O/M1vwsAAAAAElFTkSuQmCC',
    );
    document.querySelector('head').appendChild(link);

    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/O5YBAWwxRfuZ_UlRJS5Rqg/runs/0/artifacts/public/logs/live_backing.log',
      '',
    );
    fetchMock.get(getProjectUrl('/jobs/259537375/', repoName), fullJob);
    fetchMock.get(`begin:${getProjectUrl('/push/717491/', repoName)}`, {
      ...pushListFixture,
      results: [pushListFixture.results[0]],
    });
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/O5YBAWwxRfuZ_UlRJS5Rqg',
      404,
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/O5YBAWwxRfuZ_UlRJS5Rqg/runs/0/artifacts',
      {
        body: { artifacts: [] },
        headers: { 'Content-Type': ['application/json; charset=UTF-8'] },
      },
    );
    fetchMock.get(
      getProjectUrl('/jobs/259537375/text_log_errors/', repoName),
      [],
    );
  });

  afterEach(() => {});

  afterAll(() => {
    fetchMock.reset();
  });

  test('should have links to Perfherder and Intermittent Failures View', async () => {
    const { findByText } = render(testApp());
    const appMenu = await findByText('Logviewer');

    expect(appMenu).toBeInTheDocument();
    fireEvent.click(appMenu);
    //
    const thMenu = await findByText('Treeherder');
    expect(thMenu.getAttribute('href')).toBe('/jobs');

    const phMenu = await findByText('Perfherder');
    expect(phMenu.getAttribute('href')).toBe('/perfherder');

    const ifvMenu = await findByText('Intermittent Failures View');
    expect(ifvMenu.getAttribute('href')).toBe('/intermittent-failures');
  });

  test('should have a show job info button', async () => {
    const { findByText } = render(testApp());

    const showButton = await findByText('Show Job Info');

    expect(showButton).toBeInTheDocument();
  });
});
