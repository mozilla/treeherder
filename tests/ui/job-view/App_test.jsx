import React from 'react';
import fetchMock from 'fetch-mock';
import { render, waitFor, fireEvent } from '@testing-library/react';
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
        <App />
      </ConnectedRouter>
    </Provider>
  );
};

describe('App', () => {
  const repoName = 'autoland';

  beforeAll(() => {
    // tests will pass without this, but a lot of console warnings/errors
    fetchMock.get('begin:https://treestatus.mozilla-releng.net/trees/', {
      result: {
        message_of_the_day: '',
        reason: '',
        status: 'open',
        tree: repoName,
      },
    });

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

    fetchMock.get(getProjectUrl('/jobs/259539665/', repoName), {
      ...fullJob,
      task_id: 'MirsMc8UQPeSBC3yKMSlPw',
    });
    fetchMock.get(getProjectUrl('/jobs/259539664/', repoName), {
      ...fullJob,
      task_id: 'Fe4GqwoZQSStNUbe4EeSPQ',
    });
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

    const appMenu = await waitFor(() => getByAltText('Treeherder'));

    expect(appMenu).toBeInTheDocument();
    fireEvent.click(appMenu);

    const phMenu = await waitFor(() => getByText('Perfherder'));
    expect(phMenu.getAttribute('href')).toBe('/perfherder');

    const ifvMenu = await waitFor(() =>
      getByText('Intermittent Failures View'),
    );
    expect(ifvMenu.getAttribute('href')).toBe('/intermittent-failures');
  });

  const testChangingSelectedJob = async (
    keyDown,
    firstJobSymbol,
    firstJobTaskId,
    secondJobSymbol,
    secondJobTaskId,
  ) => {
    const { getByText, findByText, findByTestId } = render(testApp());
    const firstJob = await findByText(firstJobSymbol);

    fireEvent.mouseDown(firstJob);

    expect(await findByTestId('summary-panel')).toBeInTheDocument();
    await findByText(firstJobTaskId);
    expect(firstJob).toHaveClass('selected-job');

    fireEvent.keyDown(document.body, keyDown);

    const secondJob = getByText(secondJobSymbol);
    const secondTaskId = await findByText(secondJobTaskId);
    expect(secondJob).toHaveClass('selected-job');
    expect(secondTaskId).toBeInTheDocument();

    return true;
  };

  test('right arrow key should select next job', async () => {
    expect(
      await testChangingSelectedJob(
        { key: 'ArrowRight', keyCode: 39 },
        'yaml',
        'O5YBAWwxRfuZ_UlRJS5Rqg',
        'B',
        'secondTaskId',
      ),
    ).toBe(true);
  });

  test('left arrow key should select previous job', async () => {
    expect(
      await testChangingSelectedJob(
        { key: 'ArrowLeft', keyCode: 37 },
        'Meh',
        'MirsMc8UQPeSBC3yKMSlPw',
        'Cpp',
        'Fe4GqwoZQSStNUbe4EeSPQ',
      ),
    ).toBe(true);
  });

  test('n key should select next unclassified job', async () => {
    expect(
      await testChangingSelectedJob(
        { key: 'n', keyCode: 78 },
        'yaml',
        'O5YBAWwxRfuZ_UlRJS5Rqg',
        'B',
        'secondTaskId',
      ),
    ).toBe(true);
  });

  test('p key should select previous unclassified job', async () => {
    expect(
      await testChangingSelectedJob(
        { key: 'p', keyCode: 80 },
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
    fireEvent.click(reposButton);

    const tryRepo = await waitFor(() => getByText('try'));
    fireEvent.click(tryRepo);

    await waitFor(() => getByText('333333333333'));

    expect(autolandRevision).not.toBeInTheDocument();
    expect(document.querySelector('.revision a').getAttribute('href')).toBe(
      'https://hg.mozilla.org/try/rev/3333333333335143b8df3f4b3e9b504dfbc589a0',
    );
  });
});
