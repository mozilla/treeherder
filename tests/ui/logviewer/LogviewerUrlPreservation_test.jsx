import fetchMock from 'fetch-mock';
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import App from '../../../ui/logviewer/App';
import reposFixture from '../mock/repositories';
import pushListFixture from '../mock/push_list';
import { getApiUrl } from '../../../ui/helpers/url';
import { getProjectUrl } from '../../../ui/helpers/location';
import fullJob from '../mock/full_job.json';

describe('Logviewer URL highlight preservation', () => {
  const repoName = 'autoland';
  const jobId = '259537375';
  const taskId = 'O5YBAWwxRfuZ_UlRJS5Rqg';
  const logUrl = `https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/${taskId}/runs/0/artifacts/public/logs/live_backing.log`;
  const errorsUrl = getProjectUrl(
    `/jobs/${jobId}/text_log_errors/`,
    repoName,
  );

  beforeEach(() => {
    // Pin the URL with a multi-line highlight range using jsdom's real history.
    window.history.replaceState(
      null,
      '',
      `/logviewer?job_id=${jobId}&repo=${repoName}&task=${taskId}.0&lineNumber=17657-19403`,
    );

    // A non-empty log so lineCount > 0 triggers the initialLine effect.
    const logContent = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`)
      .join('\n');

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
    // At least one error so firstErrorLine fires the App effect that re-reads
    // the URL — that effect is the second clobber path.
    fetchMock.get(errorsUrl, [
      { line: 'TEST-UNEXPECTED-FAIL fake', line_number: 17546 },
    ]);
  });

  afterEach(() => {
    fetchMock.reset();
  });

  // Regression test for the bug where opening a shared URL like
  //   /logviewer?...&lineNumber=17657-19403
  // would replace the range with `17547` (the first error line) or `17657`
  // (the range start) before the page finished loading.
  test('preserves ?lineNumber=START-END across log and error loads', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    // Wait for both async fetches that drive the bug-prone effects to fire.
    await waitFor(() => {
      expect(fetchMock.called(logUrl)).toBe(true);
      expect(fetchMock.called(errorsUrl)).toBe(true);
    });

    // Let the effect cascade triggered by firstErrorLine settle.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(window.location.search).toContain('lineNumber=17657-19403');
  });

  test('seeds useLogViewer highlight from URL so the first onHighlightChange does not clear it', async () => {
    const pushStateSpy = jest.spyOn(window.history, 'pushState');

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchMock.called(logUrl)).toBe(true);
      expect(fetchMock.called(errorsUrl)).toBe(true);
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    // The mount-time highlight effect, the post-fetch initialLine effect, and
    // the post-errors App effect must each preserve the range when they write
    // back to the URL. No pushState call should clobber it with a single line
    // or remove it entirely.
    const urlWrites = pushStateSpy.mock.calls
      .map(([, , url]) => url)
      .filter((url) => typeof url === 'string' && url.includes('lineNumber'));

    for (const url of urlWrites) {
      expect(url).toContain('lineNumber=17657-19403');
    }

    pushStateSpy.mockRestore();
  });
});
