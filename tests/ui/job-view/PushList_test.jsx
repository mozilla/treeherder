import React from 'react';
import { fetchMock } from 'fetch-mock';
import { Provider } from 'react-redux';
import {
  render,
  cleanup,
  waitForElement,
  waitForElementToBeRemoved,
} from '@testing-library/react';

import {
  getProjectUrl,
  replaceLocation,
  setUrlParam,
} from '../../../ui/helpers/location';
import FilterModel from '../../../ui/models/filter';
import pushListFixture from '../mock/push_list';
import jobListFixtureOne from '../mock/job_list/job_1';
import jobListFixtureTwo from '../mock/job_list/job_2';
import configureStore from '../../../ui/job-view/redux/configureStore';
import PushList from '../../../ui/job-view/pushes/PushList';

describe('PushList', () => {
  const repoName = 'autoland';
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
  const testPushList = (store, filterModel) => (
    <Provider store={store}>
      <div id="th-global-content">
        <PushList
          user={{ isLoggedIn: false }}
          repoName={repoName}
          currentRepo={currentRepo}
          filterModel={filterModel}
          duplicateJobsVisible={false}
          groupCountsExpanded={false}
          pushHealthVisibility="None"
          getAllShownJobs={() => {}}
        />
      </div>
    </Provider>
  );

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
        '/push/?full=true&count=10&tochange=d5b037941b0ebabcc9b843f24d926e9d65961087',
        repoName,
      ),
      {
        ...pushListFixture,
        results: pushListFixture.results.slice(1, 2),
      },
    );
    fetchMock.get(
      getProjectUrl(
        '/jobs/?push_id=511138&count=2000&return_type=list',
        repoName,
      ),
      jobListFixtureOne,
    );

    fetchMock.mock(
      getProjectUrl(
        '/jobs/?push_id=511137&count=2000&return_type=list',
        repoName,
      ),
      jobListFixtureTwo,
    );
  });

  afterAll(() => {
    fetchMock.reset();
  });

  afterEach(() => {
    cleanup();
    replaceLocation({});
  });

  const push1Id = 'push-511138';
  const push2Id = 'push-511137';
  const push1Revision = 'ba9c692786e95143b8df3f4b3e9b504dfbc589a0';
  const push2Revision = 'd5b037941b0ebabcc9b843f24d926e9d65961087';

  test('should have 2 pushes', async () => {
    const { store } = configureStore();
    const { getAllByText } = render(testPushList(store, new FilterModel()));
    const pushes = await waitForElement(() => getAllByText('View Tests'));

    expect(pushes).toHaveLength(2);
  });

  test('should switch to single loaded revision and back to 2', async () => {
    const { store } = configureStore();
    const { getByTestId, getAllByText } = render(
      testPushList(store, new FilterModel()),
    );

    expect(await waitForElement(() => getAllByText('View Tests'))).toHaveLength(
      2,
    );

    // fireEvent.click(push) not clicking the link, so must set the url param
    setUrlParam('revision', push2Revision); // click push 2
    await waitForElementToBeRemoved(() => getByTestId('push-511138'));

    expect(await waitForElement(() => getAllByText('View Tests'))).toHaveLength(
      1,
    );

    setUrlParam('revision', null);
    await waitForElement(() => getByTestId(push1Id));
    expect(await waitForElement(() => getAllByText('View Tests'))).toHaveLength(
      2,
    );
  });

  test('should reload pushes when setting fromchange', async () => {
    const { store } = configureStore();
    const { getByTestId, getAllByText } = render(
      testPushList(store, new FilterModel()),
    );

    expect(await waitForElement(() => getAllByText('View Tests'))).toHaveLength(
      2,
    );

    setUrlParam('fromchange', push1Revision);
    await waitForElementToBeRemoved(() => getByTestId(push2Id));
    expect(await waitForElement(() => getAllByText('View Tests'))).toHaveLength(
      1,
    );
  });

  test('should reload pushes when setting tochange', async () => {
    const { store } = configureStore();
    const { getByTestId, getAllByText } = render(
      testPushList(store, new FilterModel()),
    );

    expect(await waitForElement(() => getAllByText('View Tests'))).toHaveLength(
      2,
    );

    setUrlParam('tochange', push2Revision);
    await waitForElementToBeRemoved(() => getByTestId(push1Id));
    expect(await waitForElement(() => getAllByText('View Tests'))).toHaveLength(
      1,
    );
  });
});
