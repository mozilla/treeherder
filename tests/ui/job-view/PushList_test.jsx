import React from 'react';
import fetchMock from 'fetch-mock';
import { Provider, ReactReduxContext } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';
import {
  render,
  waitFor,
  fireEvent,
  getAllByTestId,
} from '@testing-library/react';
import { createBrowserHistory } from 'history';

import { getProjectUrl } from '../../../ui/helpers/location';
import FilterModel from '../../../ui/models/filter';
import pushListFixture from '../mock/push_list';
import jobListFixtureOne from '../mock/job_list/job_1';
import jobListFixtureTwo from '../mock/job_list/job_2';
import { configureStore } from '../../../ui/job-view/redux/configureStore';
import PushList from '../../../ui/job-view/pushes/PushList';
import { getApiUrl } from '../../../ui/helpers/url';
import { findJobInstance } from '../../../ui/helpers/job';

// solution to createRange is not a function error for popper (used by reactstrap)
// https://github.com/mui-org/material-ui/issues/15726#issuecomment-493124813
global.document.createRange = () => ({
  setStart: () => {},
  setEnd: () => {},
  commonAncestorContainer: {
    nodeName: 'BODY',
    ownerDocument: document,
  },
});

describe('PushList', () => {
  const repoName = 'autoland';
  const history = createBrowserHistory();

  const currentRepo = {
    id: 4,
    repository_group: {
      name: 'development',
      description: 'meh',
    },
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

  const pushCount = () =>
    waitFor(() => getAllByTestId(document.body, 'push-header'));

  beforeAll(() => {
    fetchMock.get(getProjectUrl('/push/?full=true&count=10', repoName), {
      ...pushListFixture,
      results: pushListFixture.results.slice(0, 2),
    });
    fetchMock.get(
      getProjectUrl(
        '/push/?full=true&count=100&fromchange=ba9c692786e95143b8df3f4b3e9b504dfbc589a0',
        repoName,
      ),
      {
        ...pushListFixture,
        results: pushListFixture.results.slice(0, 1),
      },
    );
    fetchMock.get(
      getProjectUrl(
        '/push/?full=true&count=10&tochange=ba9c692786e95143b8df3f4b3e9b504dfbc589a0',
        repoName,
      ),
      {
        ...pushListFixture,
        results: pushListFixture.results.slice(0, 1),
      },
    );
    fetchMock.get(
      getProjectUrl(
        '/push/?full=true&count=100&fromchange=d5b037941b0ebabcc9b843f24d926e9d65961087',
        repoName,
      ),
      {
        ...pushListFixture,
        results: pushListFixture.results.slice(1, 2),
      },
    );
    fetchMock.get(
      getProjectUrl(
        '/push/?full=true&count=10&tochange=d5b037941b0ebabcc9b843f24d926e9d65961087',
        repoName,
      ),
      {
        ...pushListFixture,
        results: pushListFixture.results.slice(1, 2),
      },
    );
    fetchMock.get(
      getApiUrl('/jobs/?push_id=511138', repoName),
      jobListFixtureOne,
    );

    fetchMock.mock(
      getApiUrl('/jobs/?push_id=511137', repoName),
      jobListFixtureTwo,
    );
    fetchMock.get(
      'begin:https://firefox-ci-tc.services.mozilla.com/api/index/v1/task/gecko.v2',
      404,
    );
  });

  afterEach(() => history.push('/'));

  afterAll(() => {
    fetchMock.reset();
  });

  const testPushList = () => {
    const store = configureStore(history);
    return (
      <Provider store={store} context={ReactReduxContext}>
        <ConnectedRouter history={history} context={ReactReduxContext}>
          <div id="th-global-content">
            <PushList
              user={{ isLoggedIn: false }}
              repoName={repoName}
              currentRepo={currentRepo}
              filterModel={
                new FilterModel({
                  push: history.push,
                  router: { location: history.location },
                })
              }
              duplicateJobsVisible={false}
              groupCountsExpanded={false}
              pushHealthVisibility="None"
              getAllShownJobs={() => {}}
            />
          </div>
        </ConnectedRouter>
      </Provider>
    );
  };
  // push1Revision is'ba9c692786e95143b8df3f4b3e9b504dfbc589a0';
  const push1Id = 'push-511138';
  // push2Revision is 'd5b037941b0ebabcc9b843f24d926e9d65961087';
  const push2Id = 'push-511137';

  test('should have 2 pushes', async () => {
    render(testPushList());

    expect(await pushCount()).toHaveLength(2);
  });

  test('should switch to single loaded revision', async () => {
    const { getAllByTitle } = render(testPushList());

    expect(await pushCount()).toHaveLength(2);
    const pushLinks = await getAllByTitle('View only this push');

    fireEvent.click(pushLinks[1]);
    expect(pushLinks[0]).not.toBeInTheDocument();
    expect(await pushCount()).toHaveLength(1);
  });

  test('should reload pushes when setting fromchange', async () => {
    const { queryAllByTestId, queryByTestId } = render(testPushList());

    expect(await pushCount()).toHaveLength(2);

    await waitFor(() => queryAllByTestId('push-header'));

    const push2 = await waitFor(() => queryByTestId(push2Id));
    const actionMenuButton = push2.querySelector(
      '[data-testid="push-action-menu-button"]',
    );

    fireEvent.click(actionMenuButton);

    const setFromRange = await waitFor(() =>
      push2.querySelector('[data-testid="bottom-of-range-menu-item"]'),
    );

    fireEvent.click(setFromRange);

    expect(history.location.search).toContain(
      '?fromchange=d5b037941b0ebabcc9b843f24d926e9d65961087',
    );
  });

  test('should reload pushes when setting tochange', async () => {
    const { getByTestId } = render(testPushList());

    expect(await pushCount()).toHaveLength(2);

    const push1 = getByTestId(push1Id);
    const actionMenuButton = push1.querySelector(
      '[data-testid="push-action-menu-button"]',
    );

    fireEvent.click(actionMenuButton);

    const setTopRange = await waitFor(() =>
      push1.querySelector('[data-testid="top-of-range-menu-item"]'),
    );

    fireEvent.click(setTopRange);

    expect(history.location.search).toContain(
      '?tochange=ba9c692786e95143b8df3f4b3e9b504dfbc589a0',
    );
  });

  test('should load N more pushes when click next N', async () => {
    const { getByTestId, getAllByTestId } = render(testPushList());
    const nextNUrl = (count) =>
      getProjectUrl(`/push/?full=true&count=${count + 1}&push_timestamp__lte=`);
    const clickNext = (count) =>
      fireEvent.click(getByTestId(`get-next-${count}`));

    fetchMock.get(`begin:${nextNUrl(10)}`, {
      ...pushListFixture,
      results: pushListFixture.results.slice(3, 5),
    });
    fetchMock.get(`begin:${nextNUrl(20)}`, {
      ...pushListFixture,
      results: pushListFixture.results.slice(5, 6),
    });
    fetchMock.get(`begin:${nextNUrl(50)}`, {
      ...pushListFixture,
      results: pushListFixture.results.slice(6, 7),
    });
    fetchMock.get(
      `begin:${getApiUrl('/jobs/?push_id=', repoName)}`,
      jobListFixtureOne,
    );
    fetchMock.get(`begin:https://bugzilla.mozilla.org/rest/bug`, {
      bugs: [],
    });

    expect(await pushCount()).toHaveLength(2);

    clickNext(10);
    await waitFor(() => getByTestId('push-511135'));
    expect(fetchMock.called(`begin:${nextNUrl(10)}`)).toBe(true);
    // It matters less that an actual count of 10 was returned
    // than it does that the url for 10/20/50 was called and we added
    // the pushes that were returned.  In this case, we're just
    // using a shorter return set for simplicity.
    expect(await pushCount()).toHaveLength(4);

    clickNext(20);
    await waitFor(() => getAllByTestId('push-511133'));
    expect(fetchMock.called(`begin:${nextNUrl(20)}`)).toBe(true);
    expect(await pushCount()).toHaveLength(5);

    clickNext(50);
    await waitFor(() => getAllByTestId('push-511132'));
    expect(fetchMock.called(`begin:${nextNUrl(50)}`)).toBe(true);
    expect(await pushCount()).toHaveLength(6);
  });

  test('jobs should have fields required for retriggers', async () => {
    const { getByText } = render(testPushList());
    const jobEl = await waitFor(() => getByText('yaml'));
    const jobInstance = findJobInstance(jobEl.getAttribute('data-job-id'));
    const { job } = jobInstance.props;

    fetchMock.get(
      `begin:https://bugzilla.mozilla.org/rest/bug`,
      {
        bugs: [],
      },
      { overwriteRoutes: false },
    );

    expect(job.signature).toBe('306fd1e8d922922cd171fa31f0d914300ff52228');
    expect(job.job_type_name).toBe('source-test-mozlint-yaml');
  });
});
