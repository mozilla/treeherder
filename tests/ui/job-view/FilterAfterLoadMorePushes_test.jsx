import fetchMock from 'fetch-mock';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router';

import App from '../../../ui/job-view/App';
import pushListFixture from '../mock/push_list';
import reposFixture from '../mock/repositories';
import jobListFixtureOne from '../mock/job_list/job_1';
import { getApiUrl, bzBaseUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';

// Bug 2058000: changing filters (e.g. shown tiers or result statuses) after
// loading more pushes ("get next N") had no effect until the page was
// reloaded.  These tests use BrowserRouter (not MemoryRouter) on purpose:
// the pushes store writes ``fromchange`` to the real URL with a raw
// pushState, and the bug only manifests when window.location and the router
// location refer to the same URL.

const repoName = 'autoland';
const treeStatusResponse = {
  result: {
    message_of_the_day: '',
    reason: '',
    status: 'open',
    tree: repoName,
  },
};

// An older push returned when clicking "get next 10".  Its timestamp is
// older than the oldest push in pushListFixture (511129 / 1562867109).
const olderPushPage = {
  results: [
    {
      id: 511128,
      revision: 'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee',
      author: 'someone@mozilla.org',
      revision_count: 1,
      push_timestamp: 1562867000,
      repository_id: 4,
      revisions: [
        {
          result_set_id: 511128,
          repository_id: 4,
          revision: 'aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee',
          author: 'someone@mozilla.org',
          comments: 'sample commit message',
        },
      ],
    },
  ],
};

const testApp = () => (
  <BrowserRouter>
    <App user={{ email: 'reviewbot' }} />
  </BrowserRouter>
);

describe('Filtering after loading more pushes (bug 2058000)', () => {
  beforeAll(() => {
    fetchMock.reset();
    fetchMock.get('/revision.txt', []);
    fetchMock.get(getApiUrl('/performance/framework/'), {});
    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(getApiUrl('/user/'), []);
    fetchMock.get(getApiUrl('/failureclassification/'), []);
    fetchMock.get(`begin:${bzBaseUrl}rest/bug`, { bugs: [] });
    fetchMock.get(
      'begin:https://treestatus.prod.lando.prod.cloudops.mozgcp.net/trees/',
      treeStatusResponse,
    );
    fetchMock.get(
      'begin:https://firefox-ci-tc.services.mozilla.com/api/index/v1/task/gecko.v2',
      404,
    );
    fetchMock.get(`begin:${getApiUrl('/jobs/')}`, jobListFixtureOne);
    fetchMock.get(
      getProjectUrl('/push/?full=true&count=10', repoName),
      pushListFixture,
    );
    // "get next 10" fetch: count is incremented by 1 when using
    // push_timestamp__lte (see PushModel.getList).
    fetchMock.get(
      `begin:${getProjectUrl(
        '/push/?full=true&count=11&push_timestamp__lte=',
        repoName,
      )}`,
      olderPushPage,
    );
  });

  beforeEach(() => {
    window.history.replaceState(null, '', `/jobs?repo=${repoName}`);
  });

  afterEach(async () => {
    cleanup();
    window.history.replaceState(null, '', '/');
    // Wait for any pending async operations to complete
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });

  afterAll(() => {
    fetchMock.reset();
  });

  test('toggling a filter still updates shown jobs', async () => {
    const {
      getAllByTestId,
      getByTestId,
      findAllByText,
      queryAllByText,
    } = render(testApp());

    // Initial load: 10 pushes, each showing the successful Decision task (D).
    await waitFor(() => expect(getAllByTestId('push-header')).toHaveLength(10));
    await findAllByText('D');

    // Load 10 more pushes.
    fireEvent.click(getByTestId('get-next-10'));
    await waitFor(() => expect(getAllByTestId('push-header')).toHaveLength(11));
    // The pushes store has now written ``fromchange`` to the URL and
    // dispatched thEvents.filtersUpdated.
    await waitFor(() =>
      expect(window.location.search).toContain('fromchange'),
    );

    // Toggle off "success" via the result status chicklet.
    fireEvent.click(document.querySelector('[data-status="success"]'));

    // The filter navigation happened...
    await waitFor(() =>
      expect(window.location.search).toContain('resultStatus'),
    );
    // ...and the successful (D) jobs must disappear from the job view.
    await waitFor(() => {
      expect(queryAllByText('D')).toHaveLength(0);
    });
  });
});
