import { render, screen, waitFor } from '@testing-library/react';

import ClassicLogViewer from '../../../ui/logviewer/ClassicLogViewer';

describe('ClassicLogViewer error states', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('shows an expired message when the log fetch returns 404', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    render(<ClassicLogViewer url="https://example.com/expired.log" />);

    expect(
      await screen.findByText(
        'This log has expired and is no longer available.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the generic error message for non-404 failures', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    });

    render(<ClassicLogViewer url="https://example.com/broken.log" />);

    expect(
      await screen.findByText(/Error loading log:/),
    ).toBeInTheDocument();
  });
});

describe('ClassicLogViewer console line resolution', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  const anchor = 'ConsoleLogger online at 20260904 in /builds/worker';
  const log = [
    '[taskcluster 2026-09-04T14:08:00.000Z] Task ID: abc',
    `[task 2026-09-04T14:08:33.047+00:00] 14:08:33     INFO - ${anchor}`,
    '[taskcluster 2026-09-04T14:08:45.000Z] [taskcluster-proxy] refreshed',
    '[task 2026-09-04T14:08:40.000+00:00] 14:08:40     INFO - TEST-START | a.html',
  ].join('\n');

  it('reports the resolved log line once the log is loaded', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(log),
    });
    const onConsoleLineResolved = jest.fn();

    render(
      <ClassicLogViewer
        url="https://example.com/live_backing.log"
        consoleLine={{ line: 2, anchorLine: 1, message: anchor }}
        onConsoleLineResolved={onConsoleLineResolved}
      />,
    );

    await waitFor(() => expect(onConsoleLineResolved).toHaveBeenCalledWith(4));
    expect(onConsoleLineResolved).toHaveBeenCalledTimes(1);
  });

  it('reports null when the anchor is not in the log', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(log),
    });
    const onConsoleLineResolved = jest.fn();

    render(
      <ClassicLogViewer
        url="https://example.com/live_backing.log"
        consoleLine={{ line: 2, anchorLine: 1, message: 'another task' }}
        onConsoleLineResolved={onConsoleLineResolved}
      />,
    );

    await waitFor(() => expect(onConsoleLineResolved).toHaveBeenCalledWith(null));
  });
});
