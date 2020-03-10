import React from 'react';
import fetchMock from 'fetch-mock';
import { Provider } from 'react-redux';
import { render, cleanup, waitForElement } from '@testing-library/react';

import { getProjectUrl, replaceLocation } from '../../../ui/helpers/location';
import FilterModel from '../../../ui/models/filter';
import pushListFixture from '../mock/push_list';
import jobListFixture from '../mock/job_list/job_2';
import configureStore from '../../../ui/job-view/redux/configureStore';
import Push from '../../../ui/job-view/pushes/Push';
import { getApiUrl } from '../../../ui/helpers/url';
import { findInstance } from '../../../ui/helpers/job';

describe('Push', () => {
  const repoName = 'autoland';
  const currentRepo = {
    name: repoName,
    getRevisionHref: () => 'foo',
    getPushLogHref: () => 'foo',
  };
  const push = pushListFixture.results[1];
  const revision = 'd5b037941b0ebabcc9b843f24d926e9d65961087';
  const testPush = (store, filterModel) => (
    <Provider store={store}>
      <div id="th-global-content">
        <Push
          push={push}
          isLoggedIn={false}
          currentRepo={currentRepo}
          filterModel={filterModel}
          notificationSupported={false}
          duplicateJobsVisible={false}
          groupCountsExpanded={false}
          isOnlyRevision={push.revision === revision}
          pushHealthVisibility="None"
          getAllShownJobs={() => {}}
        />
      </div>
    </Provider>
  );

  beforeAll(() => {
    fetchMock.get(getProjectUrl('/push/?full=true&count=10', repoName), {
      ...pushListFixture,
      results: pushListFixture.results[1],
    });
    fetchMock.mock(
      getApiUrl('/jobs/?push_id=511137', repoName),
      jobListFixture,
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/index/v1/task/gecko.v2.autoland.revision.d5b037941b0ebabcc9b843f24d926e9d65961087.taskgraph.decision/artifacts/public/manifests-by-task.json.gz',
      404,
    );
    fetchMock.get(
      'https://firefox-ci-tc.services.mozilla.com/api/index/v1/task/gecko.v2.autoland.revision.d5b037941b0ebabcc9b843f24d926e9d65961087.taskgraph.decision/artifacts/public/manifests-by-task.json',
      {
        'test-linux1804-64/debug-mochitest-devtools-chrome-e10s-5': [
          'devtools/client/inspector/compatibility/test/browser/browser.ini',
          'devtools/client/inspector/grids/test/browser.ini',
          'devtools/client/inspector/rules/test/browser.ini',
          'devtools/client/jsonview/test/browser.ini',
        ],
      },
    );
  });

  afterAll(() => {
    fetchMock.reset();
  });

  afterEach(() => {
    cleanup();
    replaceLocation({});
  });

  test('jobs should have test_path field to filter', async () => {
    const { store } = configureStore();
    const { getByText } = render(testPush(store, new FilterModel()));

    const validateJob = async (name, testPaths) => {
      const jobEl = await waitForElement(() => getByText(name));
      // Fetch the React instance of an object from a DOM element.
      const { props } = findInstance(jobEl);
      const { job } = props;
      expect(job.test_paths).toStrictEqual(testPaths);
    };

    await validateJob('Jit8', []);
    await validateJob('dt5', [
      'devtools/client/inspector/compatibility/test/browser/browser.ini',
      'devtools/client/inspector/grids/test/browser.ini',
      'devtools/client/inspector/rules/test/browser.ini',
      'devtools/client/jsonview/test/browser.ini',
    ]);
  });
});
