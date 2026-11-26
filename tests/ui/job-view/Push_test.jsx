import fetchMock from 'fetch-mock';
import {
  render,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { gzip } from 'pako';

import { getProjectUrl, replaceLocation } from '../../../ui/helpers/location';
import FilterModel from '../../../ui/models/filter';
import pushListFixture from '../mock/push_list';
import jobListFixture from '../mock/job_list/job_2';
import Push, {
  transformTestPath,
  transformedPaths,
} from '../../../ui/job-view/pushes/Push';
import { getApiUrl } from '../../../ui/helpers/url';
import { findInstance } from '../../../ui/helpers/job';
import RunnableJobModel from '../../../ui/models/runnableJob';
import { usePushesStore } from '../../../ui/shared/stores/pushesStore';

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
  'test-linux1804-64-shippable-qr/opt-web-platform-tests-e10s-5': [
    '/IndexedDB',
    '/WebCryptoAPI/wrapKey_unwrapKey',
    '/_mozilla/fetch/api/redirect',
    '/mixed-content/gen/sharedworker-classic.http-rp',
    '/upgrade-insecure-requests/gen/sharedworker-module-data.meta',
  ],
};

describe('Transformations', () => {
  test('Manifest by task structure transformations', () => {
    const transformed = transformedPaths(manifestsByTask);
    expect(transformed).toEqual({
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
      'test-linux1804-64-shippable-qr/opt-web-platform-tests-e10s-5': [
        'testing/web-platform/tests/IndexedDB',
        'testing/web-platform/tests/WebCryptoAPI/wrapKey_unwrapKey',
        'testing/web-platform/mozilla/tests/fetch/api/redirect',
        'testing/web-platform/tests/mixed-content/gen/sharedworker-classic.http-rp',
        'testing/web-platform/tests/upgrade-insecure-requests/gen/sharedworker-module-data.meta',
      ],
    });
  });

  test('Path transformations (WPT)', () => {
    const tests = [
      {
        path: 'devtools/client/framework/browser-toolbox/test/browser.ini',
        expected: 'devtools/client/framework/browser-toolbox/test/browser.ini',
      },
      {
        path:
          'devtools/client/framework/browser-toolbox/test/browser_browser_toolbox.js',
        expected:
          'devtools/client/framework/browser-toolbox/test/browser_browser_toolbox.js',
      },
      {
        path: '/IndexedDB',
        expected: 'testing/web-platform/tests/IndexedDB',
      },
      {
        path: '/IndexedDB/abort-in-initial-upgradeneeded.html',
        expected:
          'testing/web-platform/tests/IndexedDB/abort-in-initial-upgradeneeded.html',
      },
      {
        path: '/_mozilla/xml',
        expected: 'testing/web-platform/mozilla/tests/xml',
      },
      {
        path: '/_mozilla/xml/parsedepth.html',
        expected: 'testing/web-platform/mozilla/tests/xml/parsedepth.html',
      },
      {
        path: '/IndexedDB/key-generators',
        expected: 'testing/web-platform/tests/IndexedDB/key-generators',
      },
    ];
    tests.forEach(({ path, expected }) => {
      expect(transformTestPath(path)).toEqual(expected);
    });
  });
});

describe('Push', () => {
  const repoName = 'autoland';
  const currentRepo = {
    name: repoName,
    tc_root_url: 'https://firefox-ci-tc.services.mozilla.com',
    getRevisionHref: () => 'foo',
    getPushLogHref: () => 'foo',
  };
  const push = pushListFixture.results[1];
  const revision = 'd5b037941b0ebabcc9b843f24d926e9d65961087';
  const testPush = (filterModel) => (
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

  test.each(['response', 'worker'])(
    'Loads picker metadata, retries after a %s error, and caches success on the push',
    async (failure) => {
      const originalWorker = global.Worker;
      const originalDecisionTasks = usePushesStore.getState().decisionTaskMap;
      const decisionTask = { id: 'picker-decision-task', run: 2 };
      const main = 'test-linux64/opt-mochitest-media-1';
      const second = 'test-linux64/opt-mochitest-media-2';
      const excluded = 'toolchain-linux64-clang';
      const getList = jest
        .spyOn(RunnableJobModel, 'getList')
        .mockResolvedValue(
          [second, excluded, main].map((job_type_name) => ({ job_type_name })),
        );
      const graphRequests = jest.fn();
      const terminate = jest.fn();
      let requests = 0;
      global.Worker = class {
        constructor(url) {
          this.isMetadataWorker = String(url).includes(
            'runnableJobMetadata.worker.js',
          );
        }

        postMessage(url) {
          if (!this.isMetadataWorker) return;
          graphRequests(url);
          requests += 1;
          if (requests === 1) {
            if (failure === 'worker')
              this.onerror({ message: 'Worker failed' });
            else this.onmessage({ data: { error: 'Artifact missing' } });
          } else {
            this.onmessage({
              data: {
                metadata: Object.fromEntries(
                  [main, second].map((label) => [
                    label,
                    {
                      chunkPattern: 'test-linux64/opt-mochitest-media-*',
                      tier: 1,
                    },
                  ]),
                ),
              },
            });
          }
        }

        terminate() {
          if (this.isMetadataWorker) terminate();
        }
      };
      usePushesStore.setState({ decisionTaskMap: { [push.id]: decisionTask } });

      const openPicker = async () => {
        fireEvent.click(screen.getByTestId('push-action-menu-button'));
        fireEvent.click(screen.getByText('Add new jobs (Search)'));
        return screen.findByRole('dialog');
      };
      const closePicker = async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() =>
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        );
      };
      try {
        render(<MemoryRouter>{testPush(new FilterModel())}</MemoryRouter>);
        await openPicker();
        expect(graphRequests).not.toHaveBeenCalled();
        const loadMetadata = () =>
          fireEvent.click(
            screen.getByRole('button', {
              name: 'Load job filters and test paths',
            }),
          );
        loadMetadata();
        await waitFor(() => expect(graphRequests).toHaveBeenCalledTimes(1));
        expect(screen.getByRole('option', { name: main })).toBeInTheDocument();
        expect(
          screen.queryByRole('option', { name: excluded }),
        ).not.toBeInTheDocument();
        await closePicker();

        await openPicker();
        expect(graphRequests).toHaveBeenCalledTimes(1);
        loadMetadata();
        expect(
          await screen.findByRole('option', {
            name: 'test-linux64/opt-mochitest-media-*',
          }),
        ).toBeInTheDocument();
        fireEvent.click(
          screen.getByRole('checkbox', { name: 'Use full job list' }),
        );
        expect(
          screen.getByRole('option', { name: excluded }),
        ).toBeInTheDocument();
        await closePicker();

        await openPicker();
        expect(
          screen.getByRole('option', {
            name: 'test-linux64/opt-mochitest-media-*',
          }),
        ).toBeInTheDocument();
        expect(getList).toHaveBeenCalledTimes(3);
        expect(getList).toHaveBeenLastCalledWith(currentRepo, { decisionTask });
        expect(graphRequests).toHaveBeenCalledTimes(2);
        expect(graphRequests).toHaveBeenLastCalledWith(
          `${currentRepo.tc_root_url}/api/queue/v1/task/${decisionTask.id}/runs/2/artifacts/public/full-task-graph.json`,
        );
        expect(terminate).toHaveBeenCalledTimes(2);
      } finally {
        cleanup();
        global.Worker = originalWorker;
        getList.mockRestore();
        usePushesStore.setState({ decisionTaskMap: originalDecisionTasks });
      }
    },
  );

  test('Keeps the picker closed if runnable jobs cannot be loaded', async () => {
    const getList = jest
      .spyOn(RunnableJobModel, 'getList')
      .mockRejectedValue(new Error('Unavailable'));
    const originalDecisionTasks = usePushesStore.getState().decisionTaskMap;
    usePushesStore.setState({
      decisionTaskMap: { [push.id]: { id: 'picker-decision-task', run: 0 } },
    });
    try {
      render(<MemoryRouter>{testPush(new FilterModel())}</MemoryRouter>);
      fireEvent.click(screen.getByTestId('push-action-menu-button'));
      fireEvent.click(screen.getByText('Add new jobs (Search)'));
      await waitFor(() => expect(getList).toHaveBeenCalled());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally {
      cleanup();
      getList.mockRestore();
      usePushesStore.setState({ decisionTaskMap: originalDecisionTasks });
    }
  });

  // eslint-disable-next-line jest/no-disabled-tests
  test.skip('jobs should have test_path field to filter', async () => {
    const { getByText } = render(testPush(new FilterModel()));

    // Wait for initial render to complete and state updates to settle
    await waitFor(() => {
      expect(getByText('Jit8')).toBeInTheDocument();
    });

    const validateJob = async (name, testPaths) => {
      const jobEl = await waitFor(() => getByText(name));
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
