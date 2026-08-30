import fetchMock from 'fetch-mock';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';

import { AppRoutes } from '../../../ui/App';
import reposFixture from '../mock/repositories';
import pushListFixture from '../mock/push_list';
import jobListFixtureOne from '../mock/job_list/job_1.json';
import fullJob from '../mock/full_job.json';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import {
  usePushesStore,
  initialState,
} from '../../../ui/shared/stores/pushesStore';
import { useSelectedJobStore } from '../../../ui/shared/stores/selectedJobStore';
import { clearJobButtonRegistry } from '../../../ui/hooks/useJobButtonRegistry';

const repoName = 'autoland';
// The Gecko Decision Task from the job_1.json fixture, so that the job button
// renders once its push's jobs load.
const taskId = 'VaQoWKTbSdGSwBJn6UZV9g';
const jobId = 259537193;
const pushId = pushListFixture.results[0].id;
const pushRevision = pushListFixture.results[0].revision;

const resolvedJob = {
  id: jobId,
  task_id: taskId,
  retry_id: 0,
  push_id: pushId,
  push_revision: pushRevision,
  state: 'completed',
  result: 'success',
  failure_classification_id: 1,
  job_type_name: 'Gecko Decision Task',
  job_type_symbol: 'D',
  job_group_name: 'unknown',
  job_group_symbol: '?',
  platform: 'gecko-decision',
  platform_option: 'opt',
  tier: 1,
  duration: 5,
  signature: '2aa083621bb989d6acf1151667288d5fe9616178',
  last_modified: '2019-08-05T20:19:51.818175',
};

const testApp = () => (
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
);

describe('Selected job first load', () => {
  beforeAll(() => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute('href', 'data:image/png;base64,');
    document.querySelector('head').appendChild(link);

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
    fetchMock.head(
      'begin:https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/',
      404,
    );
    fetchMock.get(
      `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${taskId}/runs/0/artifacts`,
      [],
    );
    fetchMock.get('begin:https://bugzilla.mozilla.org/rest/bug', { bugs: [] });

    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(getApiUrl('/performance/framework/'), {});
    fetchMock.get(getApiUrl('/user/'), []);
    fetchMock.get('/revision.txt', []);
    fetchMock.get(getApiUrl('/failureclassification/'), []);
    fetchMock.get(`begin:${getProjectUrl('/note/?job_id=', repoName)}`, []);
    fetchMock.get(
      `begin:${getProjectUrl('/bug-job-map/?job_id=', repoName)}`,
      [],
    );
    fetchMock.get(
      `begin:${getProjectUrl('/job-log-url/?job_id=', repoName)}`,
      [],
    );
    fetchMock.get(
      `begin:${getProjectUrl('/performance/job-data/?job_id=', repoName)}`,
      [],
    );

    // The eager resolution of the deep-linked task.
    fetchMock.get(`${getApiUrl('/jobs/')}?task_id=${taskId}&retry_id=0`, {
      count: 1,
      results: [resolvedJob],
    });
    // The single push named by the resolved job's revision.
    fetchMock.get(
      `begin:${getProjectUrl('/push/?full=true&count=10&revision=', repoName)}`,
      { results: [pushListFixture.results[0]] },
    );
    // That push's job list.
    fetchMock.get(`begin:${getApiUrl('/jobs/?push_id=')}`, jobListFixtureOne);

    // Details panel fetches for the selected job.
    fetchMock.get(getProjectUrl(`/jobs/${jobId}/`, repoName), {
      ...fullJob,
      id: jobId,
      task_id: taskId,
      push_id: pushId,
    });
    fetchMock.get(
      getProjectUrl(`/jobs/${jobId}/bug_suggestions/`, repoName),
      [],
    );
  });

  afterAll(() => {
    fetchMock.reset();
  });

  beforeEach(() => {
    window.history.replaceState(
      null,
      null,
      `/jobs?repo=${repoName}&selectedTaskRun=${taskId}.0`,
    );
    usePushesStore.setState({ ...initialState });
    useSelectedJobStore.setState({ selectedJob: null });
    clearJobButtonRegistry();
    Element.prototype.scrollIntoView = jest.fn();
    // jsdom reports all-zero rects, which makes isOnScreen() wrongly return
    // true and skip scrolling; report an off-screen rect instead.
    jest
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(() => ({
        top: 500,
        bottom: 520,
        left: 0,
        right: 100,
        width: 100,
        height: 20,
        x: 0,
        y: 500,
      }));
    fetchMock.resetHistory();
  });

  test('deep link resolves the job first and loads only its push', async () => {
    const { findByTestId, findByText } = render(testApp());

    // The details panel opens with the deep-linked job.
    expect(
      await findByTestId('summary-panel', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(await findByText(taskId)).toBeInTheDocument();

    // Exactly one push fetch, limited to the job's revision.
    await waitFor(() => {
      const pushCalls = fetchMock
        .calls()
        .map((call) => call[0])
        .filter((url) => url.includes('/push/'));
      expect(pushCalls).toHaveLength(1);
      expect(pushCalls[0]).toContain(`revision=${pushRevision}`);
    });

    // The job was resolved before any push was fetched.
    const urls = fetchMock.calls().map((call) => call[0]);
    const resolveIndex = urls.findIndex((url) => url.includes('task_id='));
    const pushIndex = urls.findIndex((url) => url.includes('/push/'));
    expect(resolveIndex).toBeGreaterThanOrEqual(0);
    expect(resolveIndex).toBeLessThan(pushIndex);

    // The URL now names the push's revision, alongside the task run.
    expect(window.location.search).toContain(`revision=${pushRevision}`);
    expect(window.location.search).toContain(`selectedTaskRun=${taskId}.0`);

    // The job button renders selected and was scrolled into view.
    await waitFor(() => {
      const button = document.querySelector(`button[data-job-id='${jobId}']`);
      expect(button).toHaveClass('selected-job');
    });
    // The scroll happens inside requestAnimationFrame once the button mounts.
    await waitFor(() =>
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled(),
    );
  });
});
