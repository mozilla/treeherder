import fetchMock from 'fetch-mock';
import { BrowserRouter, useLocation } from 'react-router';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';

import { getProjectUrl } from '../../../ui/helpers/location';
import FilterModel from '../../../ui/models/filter';
import pushListFixture from '../mock/push_list';
import jobListFixtureOne from '../mock/job_list/job_1';
import PushList from '../../../ui/job-view/pushes/PushList';
import {
  usePushesStore,
  fetchPushes,
  initialState as pushesInitialState,
} from '../../../ui/shared/stores/pushesStore';
import { getApiUrl } from '../../../ui/helpers/url';

// These tests use BrowserRouter (not MemoryRouter) on purpose: the bug under
// test is an interleaving of raw window.history.pushState calls (which React
// Router does NOT see) with popstate-dispatching URL updates (which it does).
// MemoryRouter can't reproduce that drift.

const repoName = 'autoland';
const push1Revision = 'ba9c692786e95143b8df3f4b3e9b504dfbc589a0'; // id 511138

// Router-visible search string, captured via a probe component.
let routerSearch;
function LocationProbe() {
  routerSearch = useLocation().search;
  return null;
}

describe('PushList URL drift between window.location and React Router', () => {
  const currentRepo = {
    id: 4,
    repository_group: { name: 'development', description: 'meh' },
    name: repoName,
    dvcs_type: 'hg',
    url: 'https://hg.mozilla.org/autoland',
    branch: null,
    codebase: 'gecko',
    description: '',
    active_status: 'active',
    performance_alerts_enabled: false,
    expire_performance_data: true,
    is_try_repo: false,
    pushLogUrl: 'https://hg.mozilla.org/autoland/pushloghtml',
    revisionHrefPrefix: 'https://hg.mozilla.org/autoland/rev/',
    getRevisionHref: () => 'foo',
    getPushLogHref: () => 'foo',
  };

  // The URL fetchPushes builds when it falls back to a "reset" fetch after
  // updateRange clears the store (fromchange/tochange present -> count=100).
  const resetFetchUrl = `begin:${getProjectUrl(
    '/push/?full=true&count=100',
    repoName,
  )}`;

  beforeAll(() => {
    // Initial load of a single-revision view.
    fetchMock.get(
      getProjectUrl(
        `/push/?full=true&count=10&revision=${push1Revision}`,
        repoName,
      ),
      { ...pushListFixture, results: pushListFixture.results.slice(0, 1) },
    );
    // "get next 10" fetch (count is incremented to 11 with push_timestamp__lte).
    fetchMock.get(
      `begin:${getProjectUrl(
        '/push/?full=true&count=11&push_timestamp__lte=',
        repoName,
      )}`,
      { ...pushListFixture, results: pushListFixture.results.slice(1, 3) },
    );
    // The buggy full-range refetch after the phantom range change.
    fetchMock.get(resetFetchUrl, {
      ...pushListFixture,
      results: pushListFixture.results.slice(0, 3),
    });
    fetchMock.get(`begin:${getApiUrl('/jobs/?push_id=', repoName)}`, {
      ...jobListFixtureOne,
    });
    fetchMock.get(
      'begin:https://firefox-ci-tc.services.mozilla.com/api/index/v1/task/gecko.v2',
      404,
    );
    fetchMock.get('begin:https://bugzilla.mozilla.org/rest/bug', { bugs: [] });
  });

  beforeEach(() => {
    window.history.replaceState(
      null,
      '',
      `/jobs?repo=${repoName}&revision=${push1Revision}`,
    );
  });

  afterEach(() => {
    cleanup();
    usePushesStore.setState({ ...pushesInitialState });
  });

  afterAll(() => {
    fetchMock.reset();
  });

  const renderPushList = () => {
    // Manually trigger fetchPushes since outside testing the App does it.
    fetchPushes();

    return render(
      <BrowserRouter>
        <LocationProbe />
        <div id="th-global-content">
          <PushList
            user={{ isLoggedIn: false }}
            repoName={repoName}
            currentRepo={currentRepo}
            filterModel={new FilterModel(jest.fn(), window.location)}
            duplicateJobsVisible={false}
            groupCountsExpanded={false}
            pushHealthVisibility="None"
            getAllShownJobs={() => {}}
          />
        </div>
      </BrowserRouter>,
    );
  };

  const pushCount = () =>
    document.querySelectorAll('[data-testid="push-header"]').length;

  test('"get next" keeps React Router location in sync with window.location', async () => {
    const { getByTestId } = renderPushList();

    await waitFor(() => expect(pushCount()).toBe(1));

    fireEvent.click(getByTestId('get-next-10'));
    await waitFor(() => expect(pushCount()).toBe(3));

    // fetchNextPushes rewrites revision -> tochange and addPushes appends
    // fromchange.  React Router must see the same URL, otherwise its next
    // navigation is computed from a stale search string.
    await waitFor(() => expect(routerSearch).toBe(window.location.search));
  });

  test('clicking empty push-list space after "get next" must not clear and refetch the push range', async () => {
    const { getByTestId } = renderPushList();

    await waitFor(() => expect(pushCount()).toBe(1));

    fireEvent.click(getByTestId('get-next-10'));
    await waitFor(() => expect(pushCount()).toBe(3));

    // Sanity: the raw pushState calls rewrote the URL from revision=X to
    // tochange=X&fromchange=Y.
    expect(window.location.search).toContain('tochange=');
    expect(window.location.search).not.toContain('revision=');

    // A mousedown on empty push-list space triggers clearJobViaUrl ->
    // updateUrlSearch -> popstate.  React Router wakes up, sees `revision`
    // "disappear" relative to its stale location, and PushList treats that as
    // a range change: clearPushes() + fetchPushes() -- wiping the pushes the
    // user just loaded.
    fireEvent.mouseDown(document.getElementById('push-list'));

    // Let the popstate-driven effects and any (buggy) refetch settle.
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    // The user's effective push range did not change, so nothing should have
    // been cleared or refetched.
    expect(fetchMock.called(resetFetchUrl)).toBe(false);
    expect(usePushesStore.getState().pushList).toHaveLength(3);
  });

  test('clicking a push timestamp after "get next" narrows the view to that push', async () => {
    const { getByTestId, getAllByTitle } = renderPushList();

    await waitFor(() => expect(pushCount()).toBe(1));

    fireEvent.click(getByTestId('get-next-10'));
    await waitFor(() => expect(pushCount()).toBe(3));
    expect(window.location.search).not.toContain('revision=');

    // The timestamp is a router <Link> to `revision=<push1>`.  React Router
    // navigates, and PushList compares the new search against the one it last
    // saw.  With the drift, its stale search still contains `revision=<push1>`
    // so the range looks unchanged and updateRange never runs: the URL says
    // "one push" while the view keeps showing all three.
    fireEvent.click(getAllByTitle('View only this push')[0]);

    await waitFor(() =>
      expect(window.location.search).toContain(`revision=${push1Revision}`),
    );
    await waitFor(() => expect(pushCount()).toBe(1));
    expect(usePushesStore.getState().pushList[0].revision).toBe(push1Revision);
  });
});
