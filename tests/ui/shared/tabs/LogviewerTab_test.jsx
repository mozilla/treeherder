import { render, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';

import LogviewerTab from '../../../../ui/shared/tabs/LogviewerTab';
import { getProjectJobUrl } from '../../../../ui/helpers/location';
import { textLogErrorsEndpoint } from '../../../../ui/helpers/url';

// Mock @melloware/react-logviewer
jest.mock('@melloware/react-logviewer', () => ({
  LazyLog: jest.fn(({ url, scrollToLine, highlight, rowHeight }) => (
    <div
      data-testid="lazy-log"
      data-url={url}
      data-scroll-to-line={scrollToLine}
      data-highlight={JSON.stringify(highlight)}
      data-row-height={rowHeight}
    >
      Mocked LazyLog Component
    </div>
  )),
}));

describe('LogviewerTab', () => {
  const repoName = 'autoland';
  const jobId = 12345;
  const logUrl =
    'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/ABC123/runs/0/artifacts/public/logs/live_backing_log';

  const selectedTaskFull = {
    id: jobId,
    logs: [
      {
        name: 'live_backing_log',
        url: logUrl,
      },
    ],
  };

  beforeEach(() => {
    fetchMock.reset();
  });

  afterEach(() => {
    fetchMock.reset();
  });

  test('should render LazyLog component with correct props when no errors', async () => {
    fetchMock.mock(getProjectJobUrl(textLogErrorsEndpoint, jobId), {
      status: 200,
      body: [],
    });

    render(
      <LogviewerTab
        selectedTaskFull={selectedTaskFull}
        repoName={repoName}
      />,
    );

    // Wait for component to mount and fetch errors
    await waitFor(() => {
      const lazyLog = screen.getByTestId('lazy-log');
      expect(lazyLog).toBeInTheDocument();
    });

    const lazyLog = screen.getByTestId('lazy-log');
    expect(lazyLog).toHaveAttribute('data-url', logUrl);
    expect(lazyLog).toHaveAttribute('data-scroll-to-line', '0');
    expect(lazyLog).toHaveAttribute('data-highlight', 'null');
    expect(lazyLog).toHaveAttribute('data-row-height', '13');
  });

  test('should highlight first error line when errors are present', async () => {
    const errorData = [
      {
        line: 'Error line 1',
        line_number: 99,
      },
      {
        line: 'Error line 2',
        line_number: 150,
      },
    ];

    fetchMock.mock(getProjectJobUrl(textLogErrorsEndpoint, jobId), {
      status: 200,
      body: errorData,
    });

    render(
      <LogviewerTab
        selectedTaskFull={selectedTaskFull}
        repoName={repoName}
      />,
    );

    // Wait for async data fetch and state update
    await waitFor(() => {
      const lazyLog = screen.getByTestId('lazy-log');
      const highlightAttr = lazyLog.getAttribute('data-highlight');
      expect(highlightAttr).toBe('[100]'); // line_number + 1
    });

    const lazyLog = screen.getByTestId('lazy-log');
    expect(lazyLog).toHaveAttribute('data-scroll-to-line', '100');
  });

  test('should handle fetch error gracefully', async () => {
    fetchMock.mock(getProjectJobUrl(textLogErrorsEndpoint, jobId), {
      status: 404,
      body: { detail: 'Not found' },
    });

    render(
      <LogviewerTab
        selectedTaskFull={selectedTaskFull}
        repoName={repoName}
      />,
    );

    // Component should still render even if error fetch fails
    await waitFor(() => {
      const lazyLog = screen.getByTestId('lazy-log');
      expect(lazyLog).toBeInTheDocument();
    });

    const lazyLog = screen.getByTestId('lazy-log');
    expect(lazyLog).toHaveAttribute('data-url', logUrl);
    expect(lazyLog).toHaveAttribute('data-highlight', 'null');
  });

  test('should render Full Screen and Text Log links', () => {
    fetchMock.mock(getProjectJobUrl(textLogErrorsEndpoint, jobId), []);

    render(
      <LogviewerTab
        selectedTaskFull={selectedTaskFull}
        repoName={repoName}
      />,
    );

    const fullScreenLinks = screen.getAllByText('Full Screen');
    expect(fullScreenLinks).toHaveLength(1);

    const textLogLinks = screen.getAllByText('Text Log');
    expect(textLogLinks).toHaveLength(1);

    // Check href attributes (URL is relative)
    const expectedUrl = `/logviewer?job_id=${jobId}&repo=${repoName}`;
    fullScreenLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', expectedUrl);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    textLogLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', expectedUrl);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  test('should render with aria-label for accessibility', () => {
    fetchMock.mock(getProjectJobUrl(textLogErrorsEndpoint, jobId), []);

    render(
      <LogviewerTab
        selectedTaskFull={selectedTaskFull}
        repoName={repoName}
      />,
    );

    const logContainer = screen.getByLabelText('Log');
    expect(logContainer).toBeInTheDocument();
    expect(logContainer).toHaveClass('h-100', 'w-100');
  });

  test('should find live_backing_log from logs array', () => {
    const taskWithMultipleLogs = {
      id: jobId,
      logs: [
        {
          name: 'build_log',
          url: 'https://example.com/build.log',
        },
        {
          name: 'live_backing_log',
          url: logUrl,
        },
        {
          name: 'other_log',
          url: 'https://example.com/other.log',
        },
      ],
    };

    fetchMock.mock(getProjectJobUrl(textLogErrorsEndpoint, jobId), []);

    render(
      <LogviewerTab selectedTaskFull={taskWithMultipleLogs} repoName={repoName} />,
    );

    const lazyLog = screen.getByTestId('lazy-log');
    expect(lazyLog).toHaveAttribute('data-url', logUrl);
  });

  test('should apply errorLinesCss when errors are present', async () => {
    const errorData = [
      {
        line: 'Error line 1',
        line_number: 50,
      },
      {
        line: 'Error line 2',
        line_number: 75,
      },
      {
        line: 'Error line 3',
        line_number: 100,
      },
    ];

    fetchMock.mock(getProjectJobUrl(textLogErrorsEndpoint, jobId), {
      status: 200,
      body: errorData,
    });

    render(
      <LogviewerTab
        selectedTaskFull={selectedTaskFull}
        repoName={repoName}
      />,
    );

    // Wait for state update
    await waitFor(() => {
      const lazyLog = screen.getByTestId('lazy-log');
      const highlightAttr = lazyLog.getAttribute('data-highlight');
      expect(highlightAttr).toBe('[51]'); // First error line_number + 1
    });
  });

  test('should handle empty error array', async () => {
    fetchMock.mock(getProjectJobUrl(textLogErrorsEndpoint, jobId), {
      status: 200,
      body: [],
    });

    render(
      <LogviewerTab
        selectedTaskFull={selectedTaskFull}
        repoName={repoName}
      />,
    );

    await waitFor(() => {
      const lazyLog = screen.getByTestId('lazy-log');
      expect(lazyLog).toBeInTheDocument();
    });

    const lazyLog = screen.getByTestId('lazy-log');
    expect(lazyLog).toHaveAttribute('data-highlight', 'null');
    expect(lazyLog).toHaveAttribute('data-scroll-to-line', '0');
  });
});
