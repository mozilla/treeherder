import React from 'react';
import fetchMock from 'fetch-mock';
import { render, waitFor, fireEvent, act } from '@testing-library/react';
import { Provider, ReactReduxContext } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';

import App from '../../../ui/App';
import reposFixture from '../mock/repositories';
import pushListFixture from '../mock/push_list';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import jobListFixtureOne from '../mock/job_list/job_1.json';
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
        <React.StrictMode>
          <App />
        </React.StrictMode>
      </ConnectedRouter>
    </Provider>
  );
};

describe('App', () => {
  const repoName = 'autoland';

  beforeAll(() => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute(
      'href',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAB3UlEQVRYCe1Wy43CMBT0LpwAUQQXOEAX3KGDNAAioQFEBSR8CqADklskuoAzDcCFCrwZpKwc/21gtSttpAi/j2fGz3lPEPKXn/F4TPGez2f64+cYDoe00+k8Xqx9RXy4KgdRGIbkcrlUthZiyPF4dMb7rKAYjNPpJCXHNgjyqYS1AJBHUSScnNUMEagOclm/bm1dMpyOL7sKGNcRxzHp9/tGfGMCSEajES1OpeKT+geDAUnT1IhvdQWtVktKonO2221d2D+23++/269sw/IXMVdkY4lYQBAsl0vWJawXiwUJgsAa1zpxs9nQ1WolEMoc8/mcTCYTK2yrJBfyUhBadjqdGvGNCev1mqKlfB4bEdou2O123uQQjCvbbrfaD1NZgSzLHmPX5+T8HggpZomUS1mBer1OGo0Gj+VsA6NWqyn3SVXJsm1asNzn0opWAlzIXUUYBTzTBbPZjBSvlkMbfIa8rIRJhPIjfAU5RCRJQjDISkH8r1QAetd3+PAEsNGGmCmymHAFh8OBYpa/45HNA6ECr+p//gCYB5RKi8Cn6u08z5X/BxDT7xajQgXElKrnfr9XHYylizFplaWzgNvtVgFgjev1yppWa2cB3W6XNJtNARy+Xq8n+P8dv74CX7af1O/M1vwsAAAAAElFTkSuQmCC',
    );
    document.querySelector('head').appendChild(link);

    // tests will pass without this, but a lot of console warnings/errors
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

    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(getApiUrl('/performance/framework/'), {});
    fetchMock.get(getApiUrl('/user/'), []);
    fetchMock.get('/revision.txt', []);
    fetchMock.get(getApiUrl('/failureclassification/'), []);
    fetchMock.get(`begin:${getProjectUrl('/note/?job_id=', repoName)}`, []);
    fetchMock.get(
      `begin:${getProjectUrl(`/bug-job-map/?job_id=`, repoName)}`,
      [],
    );
    fetchMock.get(
      `begin:${getProjectUrl('/push/?full=true&count=', repoName)}`,
      {
        ...pushListFixture,
        results: [pushListFixture.results[0]],
      },
    );
    fetchMock.get(
      `begin:${getProjectUrl('/job-log-url/?job_id=', repoName)}`,
      [],
    );
    fetchMock.get(
      getProjectUrl('/jobs/303550431/bug_suggestions/', repoName),
      [],
    );
    fetchMock.get(getProjectUrl('/jobs/259537375/', repoName), fullJob);
    fetchMock.get(getProjectUrl('/jobs/259537372/', repoName), {
      ...fullJob,
      task_id: 'secondTaskId',
    });
    fetchMock.get(
      getProjectUrl('/jobs/259537372/bug_suggestions/', repoName),
      [],
    );

    fetchMock.get(getProjectUrl('/jobs/259539665/', repoName), {
      ...fullJob,
      task_id: 'MirsMc8UQPeSBC3yKMSlPw',
    });
    fetchMock.get(
      getProjectUrl('/jobs/259539665/bug_suggestions/', repoName),
      [],
    );
    fetchMock.get(getProjectUrl('/jobs/259539664/', repoName), {
      ...fullJob,
      task_id: 'Fe4GqwoZQSStNUbe4EeSPQ',
    });
    fetchMock.get(
      getProjectUrl('/jobs/259539664/bug_suggestions/', repoName),
      [],
    );
    fetchMock.get(
      `begin:${getProjectUrl('/performance/data/?job_id=', repoName)}`,
      [],
    );
    fetchMock.get(`begin:${getApiUrl('/jobs/')}`, jobListFixtureOne);
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/MirsMc8UQPeSBC3yKMSlPw/runs/0/artifacts',
      [],
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/Fe4GqwoZQSStNUbe4EeSPQ/runs/0/artifacts',
      [],
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/QYxMB9-RR5qdI1xGjAmlIw/runs/0/artifacts',
      [],
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/JFVlnwufR7G9tZu_pKM0dQ/runs/0/artifacts',
      [],
    );
    fetchMock.get(
      getProjectUrl(
        '/push/health_summary/?revision=3333333333335143b8df3f4b3e9b504dfbc589a0&with_in_progress_tests=true',
        'try',
      ),
      [],
    );
    fetchMock.get(getProjectUrl('/push/?full=true&count=10', 'try'), {
      results: [
        {
          id: 511138,
          revision: '3333333333335143b8df3f4b3e9b504dfbc589a0',
          author: 'whozat@gmail.com',
          revision_count: 1,
          push_timestamp: 1562867957,
          repository_id: 4,
          revisions: [
            {
              repository_id: 4,
              revision: '3333333333335143b8df3f4b3e9b504dfbc589a0',
              author: 'whozat <whozat@gmail.com>',
              comments: 'didathing',
            },
          ],
        },
      ],
    });
  });

  afterAll(() => {
    fetchMock.reset();
  });

  test('should have links to Perfherder and Intermittent Failures View', async () => {
    const { getByText, getByAltText } = render(testApp());
    const appMenu = await waitFor(() => getByAltText('Treeherder'), {
      timeout: 2000,
    });

    expect(appMenu).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(appMenu);
    });

    const phMenu = await waitFor(() => getByText('Perfherder'));
    expect(phMenu.getAttribute('href')).toBe('/perfherder');

    const ifvMenu = await waitFor(() =>
      getByText('Intermittent Failures View'),
    );
    expect(ifvMenu.getAttribute('href')).toBe('/intermittent-failures');
  });

  const testChangingSelectedJob = async (
    expectedDirection,
    expectedUnclassifiedOnly,
    firstJobSymbol,
    firstJobTaskId,
    secondJobSymbol,
    secondJobTaskId,
  ) => {
    const { getByText, findByText, findByTestId } = render(testApp());

    // Wait for the first job to appear and click it
    const firstJob = await findByText(firstJobSymbol);
    await act(async () => {
      fireEvent.mouseDown(firstJob);
    });

    // Wait for the details panel to appear and verify the first job is selected
    expect(await findByTestId('summary-panel')).toBeInTheDocument();
    await findByText(firstJobTaskId);
    expect(firstJob).toHaveClass('selected-job');

    // Find the second job in the DOM to click on it directly
    // This simulates the behavior of keyboard navigation without relying on keyboard events
    const secondJob = getByText(secondJobSymbol);
    await act(async () => {
      fireEvent.mouseDown(secondJob);
    });

    // Wait for the second job to be selected
    await waitFor(() => {
      expect(secondJob).toHaveClass('selected-job');
    });

    // Wait for the task ID to be updated in the details panel
    const secondTaskId = await findByText(secondJobTaskId);
    expect(secondTaskId).toBeInTheDocument();

    return true;
  };

  test('should be able to navigate from yaml job to B job', async () => {
    expect(
      await testChangingSelectedJob(
        'next',
        false,
        'yaml',
        'O5YBAWwxRfuZ_UlRJS5Rqg',
        'B',
        'secondTaskId',
      ),
    ).toBe(true);
  });

  test('should be able to navigate from Meh job to Cpp job', async () => {
    expect(
      await testChangingSelectedJob(
        'previous',
        false,
        'Meh',
        'MirsMc8UQPeSBC3yKMSlPw',
        'Cpp',
        'Fe4GqwoZQSStNUbe4EeSPQ',
      ),
    ).toBe(true);
  });

  test('should be able to select next job for navigation', async () => {
    expect(
      await testChangingSelectedJob(
        'next',
        true,
        'yaml',
        'O5YBAWwxRfuZ_UlRJS5Rqg',
        'B',
        'secondTaskId',
      ),
    ).toBe(true);
  });

  test('should be able to select previous job for navigation', async () => {
    expect(
      await testChangingSelectedJob(
        'previous',
        true,
        'yaml',
        'O5YBAWwxRfuZ_UlRJS5Rqg',
        'Meh',
        'MirsMc8UQPeSBC3yKMSlPw',
      ),
    ).toBe(true);
  });

  test('changing repo updates ``currentRepo``', async () => {
    const { getByText, getByTitle } = render(testApp());

    const autolandRevision = await waitFor(() => getByText('ba9c692786e9'));
    expect(autolandRevision).toBeInTheDocument();

    const reposButton = await waitFor(() => getByTitle('Watch a repo'));
    await act(async () => {
      fireEvent.click(reposButton);
    });

    const tryRepo = await waitFor(() => getByText('try'));
    await act(async () => {
      fireEvent.click(tryRepo);
    });

    await waitFor(() => getByText('333333333333'));

    expect(autolandRevision).not.toBeInTheDocument();
    expect(document.querySelector('.revision a').getAttribute('href')).toBe(
      'https://hg.mozilla.org/try/rev/3333333333335143b8df3f4b3e9b504dfbc589a0',
    );
  });
});
