import {
  render,
  screen,
  act,
  waitFor,
  fireEvent,
} from '@testing-library/react';

import TabsPanel from '../../../../../ui/job-view/details/tabs/TabsPanel';

jest.mock('../../../../../ui/job-view/details/tabs/summaryTab/SummaryTab', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../../../ui/shared/JobArtifacts', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../../../ui/job-view/details/tabs/PerformanceTab', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../../../ui/job-view/details/tabs/AnnotationsTab', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../../../ui/job-view/details/tabs/SimilarJobsTab', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../../../ui/job-view/details/JobTestGroups', () => ({
  __esModule: true,
  default: () => null,
}));

const currentRepo = {
  name: 'autoland',
  tc_root_url: 'https://firefox-ci-tc.services.mozilla.com',
};

const selectedJob = {
  id: 1,
  task_id: 'TASK_A',
  retry_id: 0,
  resultStatus: 'testfailed',
};

const summaryArtifactUrl =
  'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/TASK_A/runs/0/artifacts/public/summary.jsonl';

const makeJobDetails = () => [
  { url: summaryArtifactUrl, value: 'summary.jsonl', path: '' },
  { url: 'https://example.com/log.txt', value: 'log.txt', path: '' },
];

const renderTabsPanel = (props = {}) =>
  render(
    <TabsPanel
      selectedJob={selectedJob}
      selectedJobFull={{ ...selectedJob }}
      currentRepo={currentRepo}
      jobDetails={makeJobDetails()}
      classifications={[]}
      classificationMap={{}}
      bugs={[]}
      togglePinBoardVisibility={() => {}}
      jobLogUrls={[]}
      logParseStatus="parsed"
      perfJobDetail={[]}
      testGroups={[]}
      {...props}
    />,
  );

describe('TabsPanel summary tab', () => {
  let fetchMock;
  let originalOffsetWidth;

  beforeAll(() => {
    // Give elements realistic widths so checkTabOverflow doesn't hide tabs in jsdom
    originalOffsetWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetWidth',
    );
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        if (this.id === 'tab-header-buttons') return 100;
        if (this.getAttribute('role') === 'tab') return 50;
        return 1000;
      },
    });
  });

  afterAll(() => {
    if (originalOffsetWidth) {
      Object.defineProperty(
        HTMLElement.prototype,
        'offsetWidth',
        originalOffsetWidth,
      );
    }
  });

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    window.fetch = fetchMock;
  });

  afterEach(() => {
    delete window.fetch;
  });

  it('always shows the Summary tab without probing the artifact', () => {
    renderTabsPanel();

    expect(screen.getByRole('tab', { name: 'Summary' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves a user-selected tab when jobDetails is replaced with identical content', async () => {
    const { rerender } = renderTabsPanel();

    await screen.findByRole('tab', { name: 'Summary' });

    const annotationsTab = screen.getByRole('tab', { name: 'Annotations' });
    fireEvent.click(annotationsTab);
    expect(annotationsTab).toHaveAttribute('aria-selected', 'true');

    await act(async () => {
      rerender(
        <TabsPanel
          selectedJob={selectedJob}
          selectedJobFull={{ ...selectedJob }}
          currentRepo={currentRepo}
          jobDetails={makeJobDetails()}
          classifications={[]}
          classificationMap={{}}
          bugs={[]}
          togglePinBoardVisibility={() => {}}
          jobLogUrls={[]}
          logParseStatus="parsed"
          perfJobDetail={[]}
          testGroups={[]}
        />,
      );
    });

    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: 'Annotations' }),
      ).toHaveAttribute('aria-selected', 'true'),
    );
  });

  it('selects the Summary tab by default for a failed job', () => {
    renderTabsPanel();

    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('selects the Artifacts tab by default for a non-failed job', () => {
    const successJob = { ...selectedJob, resultStatus: 'success' };
    renderTabsPanel({
      selectedJob: successJob,
      selectedJobFull: { ...successJob },
    });

    expect(
      screen.getByRole('tab', { name: 'Artifacts and Debugging Tools' }),
    ).toHaveAttribute('aria-selected', 'true');
  });
});
