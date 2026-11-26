import {
  act,
  render,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { cloneElement } from 'react';

import fuzzyJobList from '../mock/job_list/fuzzy_jobs/fuzzyJobList.json';
import initialJobList from '../mock/job_list/fuzzy_jobs/initial_job_list.json';
import searchLinuxResults from '../mock/job_list/fuzzy_jobs/search_linux_results.json';
import searchDebugResults from '../mock/job_list/fuzzy_jobs/search_debug_results.json';
import FuzzyJobFinder from '../../../ui/job-view/pushes/FuzzyJobFinder';
import PushModel from '../../../ui/models/push';
import TaskclusterModel from '../../../ui/models/taskcluster';
import { getPickerMetadata } from '../../../ui/job-view/pushes/runnableJobMetadata.worker';
import {
  normalizeTestPaths,
  planPathJobs,
} from '../../../ui/job-view/pushes/runnableJobPaths';
import { createSearchHandler } from '../../../ui/job-view/pushes/runnableJobSearch.worker';

class SearchWorker {
  handleMessage = createSearchHandler((data) => this.onmessage({ data }));

  postMessage(data) {
    setTimeout(() => this.handleMessage?.({ data }), 0);
  }

  terminate() {
    this.handleMessage = null;
  }
}

describe('FuzzyJobFinder', () => {
  const originalWorker = global.Worker;
  beforeEach(() => {
    global.Worker = SearchWorker;
  });
  afterEach(() => {
    global.Worker = originalWorker;
  });

  const isOpen = true;
  const decisionTaskId = 'YHKMjYZeSSmEZTrAPdRIag';
  const id = 705037;
  const currentRepo = {
    id: 77,
    repository_group: {
      name: 'development',
      description:
        'Collection of repositories where code initially lands in the development process',
    },
    name: 'autoland',
    dvcs_type: 'hg',
    url: 'https://hg.mozilla.org/integration/autoland',
    branch: null,
    codebase: 'gecko',
    description: 'The destination for automatically landed Firefox commits.',
    active_status: 'active',
    performance_alerts_enabled: true,
    expire_performance_data: false,
    is_try_repo: false,
    tc_root_url: 'https://firefox-ci-tc.services.mozilla.com',
    pushLogUrl: 'https://hg.mozilla.org/integration/autoland/pushloghtml',
    revisionHrefPrefix: 'https://hg.mozilla.org/integration/autoland/rev/',
  };
  const testFuzzyJobFinder = (
    <FuzzyJobFinder
      isOpen={isOpen}
      toggle={() => {}}
      jobList={fuzzyJobList}
      filteredJobList={fuzzyJobList}
      className="fuzzy-modal"
      pushId={id}
      decisionTaskId={decisionTaskId}
      currentRepo={currentRepo}
      notify={() => {}}
    />
  );

  test.each([
    ['test-linux2404-64/opt-mochitest-media-2', { total: 3 }, false],
    ['test-linux2404-64/opt-mochitest-browser-media', undefined, false],
    ['test-linux2404-64/opt-mochitest-browser-a11y', undefined, false],
    ['test-linux2404-64/opt-mochitest-media-nogpu-2', { total: 3 }, true],
    [
      'test-linux2404-64/opt-mochitest-browser-chrome-swr-2',
      { total: 3 },
      true,
    ],
    [
      'test-linux2404-64/opt-mochitest-browser-chrome-swr-uipc-2',
      { total: 3 },
      true,
    ],
    ['test-windows11-64/opt-xpcshell-msix', undefined, true],
    [
      'test-linux2404-64/opt-mochitest-browser-chrome-a11y-checks',
      undefined,
      true,
    ],
    ['test-linux2404-64/opt-mochitest-browser-chrome-2-cf', { total: 3 }, true],
    ['test-linux2404-64/opt-mochitest-plain-swr-extra', undefined, false],
    ['test-linux2404-64-asan/opt-mochitest-media', undefined, true],
  ])('classifies the suffix of %s', (label, chunks, specialized) => {
    const metadata = getPickerMetadata({
      [label]: {
        attributes: { run_on_projects: ['trunk'] },
        task: { extra: { treeherder: { tier: 1 }, chunks } },
      },
    });
    expect(metadata[label].specialized).toBe(specialized);
  });

  test('Shows an empty list while runnable jobs are unavailable', () => {
    const { getByText, getByRole } = render(
      cloneElement(testFuzzyJobFinder, {
        jobList: undefined,
        filteredJobList: undefined,
      }),
    );
    expect(getByText('Runnable Jobs [0]')).toBeInTheDocument();
    fireEvent.click(getByRole('checkbox', { name: 'Use full job list' }));
    expect(getByText('Runnable Jobs [0]')).toBeInTheDocument();
  });

  test('Groups CLI chunk patterns and keeps tier 2 and 3 hidden when showing the full list', () => {
    const jobs = [
      { name: 'mochitest-media-1', tier: 1, chunkPattern: 'mochitest-media-*' },
      { name: 'mochitest-media-2', tier: 1, chunkPattern: 'mochitest-media-*' },
      { name: 'tier-2-job', tier: 2 },
      { name: 'tier-3-job', tier: 3 },
      { name: 'specialized-job', tier: 1, specialized: true },
    ];
    const { getByRole, queryAllByTestId } = render(
      cloneElement(testFuzzyJobFinder, {
        jobList: jobs,
        filteredJobList: jobs,
      }),
    );
    const labels = () =>
      queryAllByTestId('fuzzyList').map((row) => row.textContent);
    expect(labels()).toEqual(['mochitest-media-*']);
    fireEvent.click(getByRole('checkbox', { name: 'Use full job list' }));
    expect(labels()).toEqual(['mochitest-media-*']);
    fireEvent.click(getByRole('button', { name: 'Add all' }));
    expect(
      getByRole('button', { name: 'Trigger (2) Selected Jobs' }),
    ).toBeEnabled();
    fireEvent.click(getByRole('checkbox', { name: 'Show chunk numbers' }));
    expect(labels()).toEqual(['mochitest-media-1', 'mochitest-media-2']);
    fireEvent.click(getByRole('checkbox', { name: 'Show specialized jobs' }));
    expect(new Set(labels())).toEqual(
      new Set([
        'mochitest-media-1',
        'mochitest-media-2',
        'specialized-job',
        'tier-2-job',
        'tier-3-job',
      ]),
    );
  });

  test('Only tests with existing builds matches the exact dependency on this push', async () => {
    const trigger = jest
      .spyOn(PushModel, 'triggerNewJobs')
      .mockResolvedValue('Requested');
    const jobs = [
      { name: 'test-opt', buildDependency: 'build-linux64/opt' },
      { name: 'test-debug', buildDependency: 'build-linux64/debug' },
    ];
    try {
      const { getByRole, queryAllByTestId } = render(
        cloneElement(testFuzzyJobFinder, {
          jobList: jobs,
          filteredJobList: jobs,
          pushJobs: [{ job_type_name: 'build-linux64/opt', result: 'success' }],
        }),
      );
      fireEvent.click(getByRole('button', { name: 'Add all' }));
      fireEvent.click(
        getByRole('checkbox', { name: 'Only tests with existing builds' }),
      );
      expect(
        queryAllByTestId('fuzzyList').map((row) => row.textContent),
      ).toEqual(['test-opt']);
      await act(async () =>
        fireEvent.click(
          getByRole('button', { name: 'Trigger (1) Selected Jobs' }),
        ),
      );
      expect(trigger).toHaveBeenCalledWith(
        ['test-opt'],
        decisionTaskId,
        currentRepo,
      );
    } finally {
      trigger.mockRestore();
    }
  });

  test('Filters by existing builds and submits only the chunks matching test paths', async () => {
    const trigger = jest
      .spyOn(PushModel, 'triggerJobsForPaths')
      .mockResolvedValue({
        submitted: [{ label: 'test-a', taskId: 'task-id' }],
        failed: [],
      });
    const suite = 'mochitest-browser-chrome';
    const revision = 'the-revision';
    const jobs = [
      {
        name: 'test-a',
        symbol: 'bc',
        buildDependency: 'build-a',
        pathScope: {
          suite,
          manifests: ['browser/components/one/browser.toml'],
        },
      },
      {
        name: 'test-unused-chunk',
        symbol: 'bc2',
        buildDependency: 'build-a',
        pathScope: {
          suite,
          manifests: ['browser/components/unrelated/browser.toml'],
        },
      },
      {
        name: 'test-b',
        symbol: 'bc',
        buildDependency: 'build-b',
        pathScope: {
          suite,
          manifests: ['browser/components/two/browser.toml'],
        },
      },
    ];
    try {
      const { getByRole, getByLabelText, findByText, queryAllByTestId } =
        render(
          cloneElement(testFuzzyJobFinder, {
            revision,
            jobList: jobs,
            filteredJobList: jobs,
            pushJobs: [{ job_type_name: 'build-a', result: 'success' }],
          }),
        );
      fireEvent.click(
        getByRole('checkbox', { name: 'Only tests with existing builds' }),
      );
      expect(
        queryAllByTestId('fuzzyList').map((row) => row.textContent),
      ).toEqual(['test-a', 'test-unused-chunk']);
      fireEvent.click(getByRole('button', { name: 'Add all' }));
      const input = getByLabelText('Test paths');
      fireEvent.change(input, { target: { value: 'browser/components/one' } });
      await findByText('1 task matches the test paths');

      fireEvent.change(input, { target: { value: 'browser/components/two' } });
      expect(
        getByRole('button', { name: 'Trigger (0) Selected Jobs' }),
      ).toBeDisabled();
      expect(getByRole('alert')).toHaveTextContent(
        'No selected test groups match',
      );

      fireEvent.change(input, { target: { value: 'browser/components/one' } });
      const triggerButton = getByRole('button', {
        name: 'Trigger (1) Selected Jobs',
      });
      await act(async () => fireEvent.click(triggerButton));
      expect(trigger).toHaveBeenCalledWith(
        [
          {
            label: 'test-a',
            suite,
            symbol: 'bc',
            paths: ['browser/components/one/browser.toml'],
            requestedPaths: ['browser/components/one'],
          },
        ],
        decisionTaskId,
        currentRepo,
        revision,
      );
    } finally {
      trigger.mockRestore();
    }
  });

  test('Retries only failed path jobs with their original paths after partial submission', async () => {
    const load = jest.spyOn(TaskclusterModel, 'load').mockResolvedValue({
      actions: [{ name: 'backfill-task' }],
      staticActionVariables: {},
    });
    const submit = jest
      .spyOn(TaskclusterModel, 'submit')
      .mockResolvedValueOnce('first-action')
      .mockRejectedValueOnce(new Error('Could not request second action'))
      .mockResolvedValueOnce('retried-action');
    const jobs = ['first', 'second'].map((name) => ({
      name,
      symbol: 'X',
      pathScope: {
        suite: 'xpcshell',
        manifests: [`dom/${name}/xpcshell.toml`],
      },
    }));
    const toggle = jest.fn();
    try {
      const { getByRole, getByLabelText } = render(
        cloneElement(testFuzzyJobFinder, {
          revision: 'the-revision',
          jobList: jobs,
          filteredJobList: jobs,
          toggle,
        }),
      );
      fireEvent.click(getByRole('button', { name: 'Add all' }));
      const input = getByLabelText('Test paths');
      fireEvent.change(input, { target: { value: '../invalid' } });
      expect(getByRole('alert')).toHaveTextContent(
        'Expected a repository-relative test path',
      );
      fireEvent.change(input, { target: { value: 'dom/first\ndom/second' } });

      await act(async () =>
        fireEvent.click(
          getByRole('button', { name: 'Trigger (2) Selected Jobs' }),
        ),
      );
      expect(toggle).not.toHaveBeenCalled();
      expect(input).toHaveValue('dom/second');
      const selectedJobs = within(document.getElementById('removeJobsGroup'));
      const selectedOption = selectedJobs.getByRole('option', {
        name: 'second',
      });
      selectedOption.selected = true;
      fireEvent.change(selectedJobs.getByRole('listbox'));
      expect(getByRole('button', { name: 'Remove selected' })).toBeEnabled();

      await act(async () =>
        fireEvent.click(
          getByRole('button', { name: 'Trigger (1) Selected Jobs' }),
        ),
      );
      expect(submit.mock.calls.map(([request]) => request.input.label)).toEqual(
        ['first', 'second', 'second'],
      );
      expect(submit.mock.calls.at(-1)[0].input.test_manifests).toEqual({
        xpcshell: ['dom/second/xpcshell.toml'],
      });
      expect(toggle).toHaveBeenCalledTimes(1);
    } finally {
      submit.mockRestore();
      load.mockRestore();
    }
  });

  test('Allows retry when submitting selected jobs fails', async () => {
    const trigger = jest
      .spyOn(PushModel, 'triggerNewJobs')
      .mockRejectedValueOnce(new Error('Taskcluster unavailable'));
    const toggle = jest.fn();
    const jobs = [{ name: 'one-job' }];
    try {
      const { getByRole } = render(
        cloneElement(testFuzzyJobFinder, {
          jobList: jobs,
          filteredJobList: jobs,
          toggle,
        }),
      );
      fireEvent.click(getByRole('button', { name: 'Add all' }));
      const submit = getByRole('button', { name: 'Trigger (1) Selected Jobs' });
      await act(async () => fireEvent.click(submit));
      expect(trigger).toHaveBeenCalledTimes(1);
      expect(submit).toBeEnabled();
      expect(toggle).not.toHaveBeenCalled();
    } finally {
      trigger.mockRestore();
    }
  });

  test('Uses the push backfill action with the existing manifest payload contract', async () => {
    const action = { name: 'backfill-task' };
    const load = jest.spyOn(TaskclusterModel, 'load').mockResolvedValue({
      actions: [action],
      staticActionVariables: {},
    });
    const submit = jest
      .spyOn(TaskclusterModel, 'submit')
      .mockResolvedValue('action-task-id');
    const plan = [
      {
        label: 'test-label',
        suite: 'xpcshell',
        symbol: 'X1',
        paths: ['dom/test/xpcshell.toml'],
      },
    ];
    try {
      await expect(
        PushModel.triggerJobsForPaths(
          plan,
          decisionTaskId,
          currentRepo,
          'revision',
        ),
      ).resolves.toEqual({
        failed: [],
        submitted: [{ label: 'test-label', taskId: 'action-task-id' }],
      });
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({
          action,
          decisionTaskId,
          input: {
            label: 'test-label',
            revision: 'revision',
            symbol: 'X1',
            test_manifests: { xpcshell: ['dom/test/xpcshell.toml'] },
            times: 1,
            retrigger: true,
          },
        }),
      );
    } finally {
      submit.mockRestore();
      load.mockRestore();
    }
  });

  test('Reads picker metadata from the published full task graph', () => {
    const label = 'test-linux2404-64/opt-mochitest-browser-chrome-swr-1';
    const manifests = ['browser/components/one/browser.toml'];
    expect(
      getPickerMetadata({
        [label]: {
          attributes: {
            unittest_suite: 'mochitest-browser-chrome',
            unittest_variant: 'webrender-sw',
            test_platform: 'linux2404-64/opt',
            test_manifests: manifests,
          },
          dependencies: { build: 'build-linux64/opt' },
          task: {
            extra: {
              treeherder: { tier: 2 },
              chunks: { current: 1, total: 2 },
            },
            payload: { env: { MOZHARNESS_TEST_PATHS: '{}' } },
          },
        },
      })[label],
    ).toEqual({
      tier: 2,
      chunkPattern: 'test-linux2404-64/opt-mochitest-browser-chrome-swr-*',
      specialized: true,
      buildDependency: 'build-linux64/opt',
      pathScope: { suite: 'mochitest-browser-chrome', manifests },
    });
  });

  test('Matches paths at directory boundaries and narrows WPT groups', () => {
    expect(normalizeTestPaths('../outside').error).toBeTruthy();
    expect(normalizeTestPaths('./browser/components/one/')).toEqual({
      paths: ['browser/components/one'],
    });
    const paths = [
      'testing/web-platform/tests/css/subdir',
      'browser/components/one',
    ];
    const { plan, unmatched } = planPathJobs(
      [
        {
          name: 'wpt',
          symbol: 'w',
          pathScope: { suite: 'web-platform-tests', manifests: ['/css'] },
        },
        {
          name: 'mochitest',
          symbol: 'm',
          pathScope: {
            suite: 'mochitest-browser-chrome',
            manifests: ['browser/components/one-more/browser.toml'],
          },
        },
      ],
      paths,
    );
    expect(plan).toEqual([
      {
        label: 'wpt',
        symbol: 'w',
        suite: 'web-platform-tests',
        paths: [paths[0]],
        requestedPaths: [paths[0]],
      },
    ]);
    expect(unmatched).toEqual([paths[1]]);
  });

  test('Matches Mozilla-specific WPT paths against the published test group', () => {
    const path = 'testing/web-platform/mozilla/tests/fetch';
    const job = {
      name: 'test-wpt-mozilla-1',
      symbol: 'W1',
      pathScope: {
        suite: 'web-platform-tests',
        manifests: ['/_mozilla/fetch/api'],
      },
    };
    expect(planPathJobs([job], [path])).toEqual({
      plan: [
        {
          label: job.name,
          suite: 'web-platform-tests',
          symbol: 'W1',
          paths: ['/_mozilla/fetch/api'],
          requestedPaths: [path],
        },
      ],
      unmatched: [],
    });
  });

  test('Fuzzy search gives expected results', async () => {
    const { getByTitle, queryAllByTestId } = await render(testFuzzyJobFinder);
    const inputElement = getByTitle('Filter the list of runnable jobs');

    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList')).toHaveLength(60);
      const fuzzySearchArray = queryAllByTestId('fuzzyList').map(
        (job) => job.innerHTML,
      );
      expect(fuzzySearchArray).toStrictEqual(
        expect.arrayContaining(initialJobList),
      );
    });

    await fireEvent.change(inputElement, { target: { value: 'linux' } });
    expect(inputElement.value).toBe('linux');
    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList')).toHaveLength(26);
      const fuzzySearchArray = queryAllByTestId('fuzzyList').map(
        (job) => job.innerHTML,
      );
      expect(fuzzySearchArray).toStrictEqual(
        expect.arrayContaining(searchLinuxResults),
      );
      expect(fuzzySearchArray[0]).toBe('build-linux/opt');
    });
  });

  test('Fuzzy search gives expected results for extended operators', async () => {
    const { getByTitle, queryAllByTestId } = await render(testFuzzyJobFinder);
    const inputElement = getByTitle('Filter the list of runnable jobs');

    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList')).toHaveLength(60);
      const fuzzySearchArray = queryAllByTestId('fuzzyList').map(
        (job) => job.innerHTML,
      );
      expect(fuzzySearchArray).toStrictEqual(
        expect.arrayContaining(initialJobList),
      );
    });

    await fireEvent.change(inputElement, { target: { value: 'debug$' } });
    expect(inputElement.value).toBe('debug$');
    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList')).toHaveLength(16);
      const fuzzySearchArray = queryAllByTestId('fuzzyList').map(
        (job) => job.innerHTML,
      );
      expect(fuzzySearchArray).toStrictEqual(
        expect.arrayContaining(searchDebugResults),
      );
    });

    fireEvent.change(inputElement, {
      target: { value: "^build- 'linux | 'android debug$ !asan !pgo" },
    });

    await waitFor(() => {
      const names = queryAllByTestId('fuzzyList').map((job) => job.textContent);
      expect(names).toEqual(
        expect.arrayContaining([
          'build-linux/debug',
          'build-android-aarch64/debug',
        ]),
      );
      expect(
        names.every((name) => /^build-.*(?:linux|android).*debug$/.test(name)),
      ).toBe(true);
      expect(names.every((name) => !/asan|pgo/.test(name))).toBe(true);
    });
  });

  test('Toggling "Use full job list" switches the source list and keeps the search applied', async () => {
    // Distinct trimmed vs. full lists so the toggle produces an observable
    // difference (the shared mock uses the same array for both).
    const filteredList = [
      { name: 'test-linux64/opt', symbol: 'l', groupsymbol: '' },
      { name: 'test-macosx64/opt', symbol: 'm', groupsymbol: '' },
    ];
    const fullList = [
      ...filteredList,
      { name: 'test-linux64/debug', symbol: 'l', groupsymbol: '' },
      { name: 'test-linux1804-64/opt', symbol: 'l', groupsymbol: '' },
    ];

    const { getByTitle, getByRole, queryAllByTestId } = await render(
      <FuzzyJobFinder
        isOpen={isOpen}
        toggle={() => {}}
        jobList={fullList}
        filteredJobList={filteredList}
        className="fuzzy-modal"
        pushId={id}
        decisionTaskId={decisionTaskId}
        currentRepo={currentRepo}
      />,
    );

    // The trimmed (filtered) list is shown by default.
    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList')).toHaveLength(filteredList.length);
    });

    // Apply a search term; only the linux job in the filtered list matches.
    const inputElement = getByTitle('Filter the list of runnable jobs');
    await fireEvent.change(inputElement, { target: { value: 'linux' } });
    await waitFor(() => {
      const names = queryAllByTestId('fuzzyList').map((job) => job.innerHTML);
      expect(names).toEqual(['test-linux64/opt']);
    });

    // Toggle to the full list: the source switches AND the search term stays
    // applied, so we should now see every linux job from the full list.
    const checkbox = getByRole('checkbox', { name: 'Use full job list' });
    await fireEvent.click(checkbox);

    await waitFor(() => {
      const names = queryAllByTestId('fuzzyList')
        .map((job) => job.innerHTML)
        .sort();
      expect(names).toEqual(
        [
          'test-linux1804-64/opt',
          'test-linux64/debug',
          'test-linux64/opt',
        ].sort(),
      );
    });
  });

  test('Fast typing only makes the latest results available to add', async () => {
    const { getByTitle, getByRole, queryAllByTestId } =
      render(testFuzzyJobFinder);
    const input = getByTitle('Filter the list of runnable jobs');
    const addAll = getByRole('button', { name: 'Add all' });

    fireEvent.change(input, { target: { value: 'linux' } });
    fireEvent.change(input, { target: { value: '^addon-tps-xpi$' } });
    expect(addAll).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(addAll);
    expect(
      getByRole('button', { name: 'Trigger (0) Selected Jobs' }),
    ).toBeDisabled();

    await waitFor(() => expect(addAll).not.toHaveAttribute('aria-disabled'));
    expect(queryAllByTestId('fuzzyList').map((job) => job.textContent)).toEqual(
      ['addon-tps-xpi'],
    );

    fireEvent.click(addAll);
    expect(
      getByRole('button', { name: 'Trigger (1) Selected Jobs' }),
    ).toBeEnabled();
  });

  test('Terminates the search worker on list changes, close, and unmount', () => {
    const terminate = jest.spyOn(SearchWorker.prototype, 'terminate');
    try {
      const finder = cloneElement(testFuzzyJobFinder, {
        jobList: [...fuzzyJobList],
      });
      const { getByRole, getByTitle, rerender, unmount } = render(finder);
      fireEvent.change(getByTitle('Filter the list of runnable jobs'), {
        target: { value: 'linux' },
      });

      fireEvent.click(getByRole('checkbox', { name: 'Use full job list' }));
      expect(terminate).toHaveBeenCalledTimes(1);

      rerender(cloneElement(finder, { isOpen: false }));
      expect(terminate).toHaveBeenCalledTimes(2);

      rerender(finder);
      unmount();
      expect(terminate).toHaveBeenCalledTimes(3);
    } finally {
      terminate.mockRestore();
    }
  });

  test('Clears the search and selection when the modal closes', async () => {
    const { getByRole, getByTitle, queryByRole, rerender } =
      render(testFuzzyJobFinder);
    const input = getByTitle('Filter the list of runnable jobs');
    fireEvent.change(input, { target: { value: '^addon-tps-xpi$' } });

    const job = getByRole('option', { name: 'addon-tps-xpi' });
    job.selected = true;
    fireEvent.change(job.closest('select'));
    const addSelected = getByRole('button', { name: 'Add selected' });
    await waitFor(() =>
      expect(addSelected).not.toHaveAttribute('aria-disabled'),
    );
    expect(addSelected).toBeEnabled();

    rerender(cloneElement(testFuzzyJobFinder, { isOpen: false }));
    await waitFor(() => expect(queryByRole('dialog')).not.toBeInTheDocument());
    rerender(testFuzzyJobFinder);

    expect(getByTitle('Filter the list of runnable jobs')).toHaveValue('');
    expect(getByRole('option', { name: 'addon-tps-xpi' }).selected).toBe(false);
    expect(getByRole('button', { name: 'Add selected' })).toBeDisabled();
  });

  test.each(['initialization', 'execution'])(
    'Shows an error when the search worker fails during %s',
    (phase) => {
      let worker;
      global.Worker = class extends SearchWorker {
        constructor() {
          if (phase === 'initialization') throw new Error('Worker unavailable');
          super();
          worker = this;
        }
      };
      const { getByRole, getByTitle, queryByRole } = render(testFuzzyJobFinder);
      expect(queryByRole('alert')).not.toBeInTheDocument();

      fireEvent.change(getByTitle('Filter the list of runnable jobs'), {
        target: { value: 'linux' },
      });
      if (worker) {
        act(() => worker.onerror(new ErrorEvent('error')));
      }

      expect(getByRole('alert')).toHaveTextContent(
        'Unable to search runnable jobs.',
      );
      expect(document.getElementById('addJobsGroup')).toHaveAttribute(
        'aria-busy',
        'false',
      );
      expect(getByRole('button', { name: 'Add all' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    },
  );

  test('Keeps the results list enabled and retains selections that still match', async () => {
    const { getByTitle, getByRole } = render(testFuzzyJobFinder);
    const input = getByTitle('Filter the list of runnable jobs');
    const list = document.querySelector('#addJobsGroup select');
    const addSelected = getByRole('button', { name: 'Add selected' });

    const job = getByRole('option', { name: 'addon-tps-xpi' });
    job.selected = true;
    fireEvent.change(list);

    fireEvent.change(input, { target: { value: '^addon-tps-xpi$' } });
    expect(list).toBeEnabled();
    expect(job.selected).toBe(true);
    expect(addSelected).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(addSelected);
    expect(
      getByRole('button', { name: 'Trigger (0) Selected Jobs' }),
    ).toBeDisabled();

    await waitFor(() => expect(list.options).toHaveLength(1));
    expect(job.selected).toBe(true);
    expect(addSelected).not.toHaveAttribute('aria-disabled');

    fireEvent.change(input, { target: { value: 'linux' } });
    await waitFor(() => expect(list.options).toHaveLength(26));
    expect(addSelected).toBeDisabled();

    fireEvent.change(input, { target: { value: '' } });
    expect(getByRole('option', { name: 'addon-tps-xpi' }).selected).toBe(false);
  });

  test('Selecting a job marks it and moves it to the Selected Jobs list', async () => {
    const { getByText, queryAllByTestId } = await render(testFuzzyJobFinder);

    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList').length).toBeGreaterThan(0);
    });

    const targetName = 'addon-tps-xpi';
    const addSelect = document.querySelector('#addJobsGroup select');
    const targetOption = queryAllByTestId('fuzzyList').find(
      (option) => option.textContent === targetName,
    );
    targetOption.selected = true;
    await fireEvent.change(addSelect);

    await fireEvent.click(getByText('Add selected'));

    await waitFor(() => {
      // The job is marked as selected in the runnable list...
      const marked = queryAllByTestId('fuzzyList').find(
        (option) => option.textContent === targetName,
      );
      expect(marked.className).toContain('selected');

      // ...and shows up in the Selected Jobs box.
      const removeSelect = document.querySelector('#removeJobsGroup select');
      const selectedNames = Array.from(removeSelect.options).map(
        (option) => option.textContent,
      );
      expect(selectedNames).toContain(targetName);
    });
  });

  test('Caps the number of rendered jobs and shows how many are hidden', async () => {
    // More jobs than the render cap (MAX_RENDERED_JOBS = 500) so we can assert
    // only a slice is mounted while the true total is still reported.
    const bigList = Array.from({ length: 600 }, (_unused, i) => ({
      name: `test-job-${String(i).padStart(4, '0')}`,
      symbol: `j${i}`,
      groupsymbol: '',
    }));

    const { getByText, queryAllByTestId } = await render(
      <FuzzyJobFinder
        isOpen={isOpen}
        toggle={() => {}}
        jobList={bigList}
        filteredJobList={bigList}
        className="fuzzy-modal"
        pushId={id}
        decisionTaskId={decisionTaskId}
        currentRepo={currentRepo}
      />,
    );

    await waitFor(() => {
      // Only the first 500 are turned into <option> nodes...
      expect(queryAllByTestId('fuzzyList')).toHaveLength(500);
      // ...but the notice reflects the full match count.
      expect(
        getByText(/Showing the first 500 of 600 jobs/),
      ).toBeInTheDocument();
    });
  });
});
