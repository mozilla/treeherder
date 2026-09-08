import fetchMock from 'fetch-mock';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import App from '../../../ui/logviewer/App';
import reposFixture from '../mock/repositories';
import pushListFixture from '../mock/push_list';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import fullJob from '../mock/full_job.json';

// A summary.jsonl record only knows its line among the lines mozharness wrote
// to the console; the log viewer must translate it against the anchor message
// once the log is loaded, then leave a plain ?lineNumber= URL behind.
describe('Logviewer console line resolution', () => {
  const repoName = 'autoland';
  const jobId = '259537375';
  const taskId = 'O5YBAWwxRfuZ_UlRJS5Rqg';
  const logUrl = `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${taskId}/runs/0/artifacts/public/logs/live_backing.log`;
  const errorsUrl = getProjectUrl(
    `/jobs/${jobId}/text_log_errors/`,
    repoName,
  );
  const anchor = 'ConsoleLogger online at 20260907 09:17:05Z in /builds/worker';
  const logContent = [
    '[taskcluster 2026-09-07T09:16:00.000Z] Task ID: abc',
    '[fetches 2026-09-07T09:16:10.000Z] downloading',
    `[task 2026-09-07T09:17:05.000+00:00] 09:17:05     INFO - ${anchor}`,
    '[task 2026-09-07T09:17:06.000+00:00] 09:17:06     INFO - Using env: {}',
    '[taskcluster 2026-09-07T09:17:07.000Z] [taskcluster-proxy] refreshed',
    '[task 2026-09-07T09:17:08.000+00:00] 09:17:08     INFO - TEST-START | a.html',
    '[task 2026-09-07T09:17:09.000+00:00] 09:17:09  WARNING - TEST-UNEXPECTED-FAIL | a.html | boom',
  ].join('\n');

  const openLogviewer = (anchorMessage) => {
    const params = new URLSearchParams({
      job_id: jobId,
      repo: repoName,
      task: `${taskId}.0`,
      // Console line 3 is TEST-START: anchor (1), env (2), then the worker
      // line in between must not be counted.
      consoleLine: 3,
      consoleAnchorLine: 1,
      consoleAnchor: anchorMessage,
    });
    window.history.replaceState(null, '', `/logviewer?${params}`);
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
  };

  beforeEach(() => {
    fetchMock.get(getApiUrl('/repository/'), reposFixture);
    fetchMock.get(logUrl, logContent);
    fetchMock.get(getProjectUrl(`/jobs/${jobId}/`, repoName), fullJob);
    fetchMock.get(`begin:${getProjectUrl('/push/717491/', repoName)}`, {
      ...pushListFixture,
      results: [pushListFixture.results[0]],
    });
    fetchMock.get(
      `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${taskId}`,
      404,
    );
    fetchMock.get(
      `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${taskId}/runs/0/artifacts`,
      {
        body: { artifacts: [] },
        headers: { 'Content-Type': ['application/json; charset=UTF-8'] },
      },
    );
    fetchMock.get(errorsUrl, [
      { line: 'TEST-UNEXPECTED-FAIL | a.html | boom', line_number: 6 },
    ]);
  });

  afterEach(() => {
    fetchMock.reset();
  });

  test('rewrites the console line params into the resolved ?lineNumber=', async () => {
    openLogviewer(anchor);

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('lineNumber')).toBe('6');
    });
    const params = new URLSearchParams(window.location.search);
    expect(params.get('consoleLine')).toBeNull();
    expect(params.get('consoleAnchorLine')).toBeNull();
    expect(params.get('consoleAnchor')).toBeNull();
    expect(params.get('job_id')).toBe(jobId);
    expect(params.get('task')).toBe(`${taskId}.0`);
  });

  test('falls back to the first error line when the anchor is not in the log', async () => {
    openLogviewer('some other task');

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('lineNumber')).toBe('7');
    });
    expect(new URLSearchParams(window.location.search).get('consoleLine')).toBeNull();
  });
});
