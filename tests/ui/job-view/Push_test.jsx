import React from 'react';
import fetchMock from 'fetch-mock';
import { Provider } from 'react-redux';
import { render, cleanup, waitForElement } from '@testing-library/react';
import { gzip } from 'pako';

import { getProjectUrl, replaceLocation } from '../../../ui/helpers/location';
import FilterModel from '../../../ui/models/filter';
import pushListFixture from '../mock/push_list';
import jobListFixture from '../mock/job_list/job_2';
import configureStore from '../../../ui/job-view/redux/configureStore';
import Push, { joinArtifacts } from '../../../ui/job-view/pushes/Push';
import { getApiUrl } from '../../../ui/helpers/url';
import { findInstance } from '../../../ui/helpers/job';

const testsByManifest = {
  'devtools/client/framework/browser-toolbox/test/browser.ini': [
    'browser_browser_toolbox.js',
    'browser_browser_toolbox_debugger.js',
    'browser_browser_toolbox_fission_contentframe_inspector.js',
    'browser_browser_toolbox_fission_inspector.js',
    'browser_browser_toolbox_rtl.js',
  ],
  'devtools/client/framework/test/browser.ini': ['foo.js'],
};
const manifestsByTask = {
  'test-linux1804-64/debug-mochitest-devtools-chrome-e10s-1': [
    'devtools/client/framework/browser-toolbox/test/browser.ini',
    'devtools/client/framework/test/browser.ini',
    'devtools/client/framework/test/metrics/browser_metrics_inspector.ini',
    'devtools/client/inspector/changes/test/browser.ini',
    'devtools/client/inspector/extensions/test/browser.ini',
    'devtools/client/inspector/markup/test/browser.ini',
    'devtools/client/jsonview/test/browser.ini',
    'devtools/client/shared/test/browser.ini',
    'devtools/client/styleeditor/test/browser.ini',
    'devtools/client/webconsole/test/node/fixtures/stubs/stubs.ini',
  ],
};

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

  beforeAll(async () => {
    fetchMock.get(getProjectUrl('/push/?full=true&count=10', repoName), {
      ...pushListFixture,
      results: pushListFixture.results[1],
    });
    fetchMock.mock(
      getApiUrl('/jobs/?push_id=511137', repoName),
      jobListFixture,
    );
    const tcUrl =
      'https://firefox-ci-tc.services.mozilla.com/api/index/v1/task/gecko.v2.autoland.revision.d5b037941b0ebabcc9b843f24d926e9d65961087.taskgraph.decision/artifacts/public';
    // XXX: Fix this to re-enable test
    // I need to figure out the right options to get a gzip blob
    fetchMock.get(`${tcUrl}/tests-by-manifest.json.gz`, {
      body: new Blob(await gzip(JSON.stringify(testsByManifest)), {
        type: 'application/gzip',
      }),
      sendAsJson: false,
    });
    fetchMock.get(`${tcUrl}/manifests-by-task.json.gz`, {
      body: new Blob(await gzip(JSON.stringify(manifestsByTask)), {
        type: 'application/gzip',
      }),
      sendAsJson: false,
    });
  });

  afterAll(() => {
    fetchMock.reset();
  });

  afterEach(() => {
    cleanup();
    replaceLocation({});
  });

  // eslint-disable-next-line jest/no-disabled-tests
  test.skip('jobs should have test_path field to filter', async () => {
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
    // XXX: It should be returning test paths instead of manifest paths
    await validateJob('dt1', [
      'devtools/client/framework/browser-toolbox/test/browser.ini',
      'devtools/client/framework/test/browser.ini',
      'devtools/client/framework/test/metrics/browser_metrics_inspector.ini',
      'devtools/client/inspector/changes/test/browser.ini',
      'devtools/client/inspector/extensions/test/browser.ini',
      'devtools/client/inspector/markup/test/browser.ini',
      'devtools/client/jsonview/test/browser.ini',
      'devtools/client/shared/test/browser.ini',
      'devtools/client/styleeditor/test/browser.ini',
      'devtools/client/webconsole/test/node/fixtures/stubs/stubs.ini',
    ]);
  });
});

describe('Artifact transformations', () => {
  test('Merge artifacts', () => {
    const taskNameToTestPaths = joinArtifacts(manifestsByTask, testsByManifest);
    expect(taskNameToTestPaths).toMatchObject({
      'test-linux1804-64/debug-mochitest-devtools-chrome-e10s-1': [
        'devtools/client/framework/browser-toolbox/test/browser_browser_toolbox.js',
        'devtools/client/framework/browser-toolbox/test/browser_browser_toolbox_debugger.js',
        'devtools/client/framework/browser-toolbox/test/browser_browser_toolbox_fission_contentframe_inspector.js',
        'devtools/client/framework/browser-toolbox/test/browser_browser_toolbox_fission_inspector.js',
        'devtools/client/framework/browser-toolbox/test/browser_browser_toolbox_rtl.js',
        'devtools/client/framework/test/foo.js',
      ],
    });
  });
});
