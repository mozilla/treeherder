import React from 'react';
import { render, screen } from '@testing-library/react';

import JobButtonComponent from '../../../../ui/job-view/pushes/JobButton';
import * as jobButtonRegistry from '../../../../ui/hooks/useJobButtonRegistry';

// Mock the useJobButtonRegistry hook
jest.mock('../../../../ui/hooks/useJobButtonRegistry', () => ({
  useJobButtonRegistry: jest.fn(),
  registerJobButton: jest.fn(),
  unregisterJobButton: jest.fn(),
  getJobButtonInstance: jest.fn(),
}));

describe('JobButton', () => {
  const mockSetSelected = jest.fn();
  const mockToggleRunnableSelected = jest.fn();
  const mockRefilter = jest.fn();
  const mockButtonRef = jest.fn();

  const defaultHookReturn = {
    isSelected: false,
    isRunnableSelected: false,
    setSelected: mockSetSelected,
    toggleRunnableSelected: mockToggleRunnableSelected,
    refilter: mockRefilter,
    buttonRef: mockButtonRef,
  };

  const createMockJob = (overrides = {}) => ({
    id: 1,
    state: 'completed',
    failure_classification_id: 1,
    job_type_symbol: 'bc',
    resultStatus: 'success',
    hoverText: 'mochitest-browser - success - 5 mins',
    task_run: 'task-run-123',
    ...overrides,
  });

  const createMockFilterModel = () => ({
    showJob: jest.fn(() => true),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jobButtonRegistry.useJobButtonRegistry.mockReturnValue(defaultHookReturn);
  });

  it('renders the job type symbol', () => {
    const job = createMockJob({ job_type_symbol: 'M' });
    const filterModel = createMockFilterModel();
    const filterPlatformCb = jest.fn();

    render(
      <JobButtonComponent
        job={job}
        filterModel={filterModel}
        visible={true}
        filterPlatformCb={filterPlatformCb}
      />,
    );

    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('returns null when not visible', () => {
    const job = createMockJob();
    const filterModel = createMockFilterModel();
    const filterPlatformCb = jest.fn();

    const { container } = render(
      <JobButtonComponent
        job={job}
        filterModel={filterModel}
        visible={false}
        filterPlatformCb={filterPlatformCb}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('has correct data attributes', () => {
    const job = createMockJob({ id: 42, resultStatus: 'testfailed' });
    const filterModel = createMockFilterModel();
    const filterPlatformCb = jest.fn();

    render(
      <JobButtonComponent
        job={job}
        filterModel={filterModel}
        visible={true}
        filterPlatformCb={filterPlatformCb}
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-job-id', '42');
    expect(button).toHaveAttribute('data-status', 'testfailed');
  });

  it('shows title from job hoverText', () => {
    const job = createMockJob({ hoverText: 'Test job hover text' });
    const filterModel = createMockFilterModel();
    const filterPlatformCb = jest.fn();

    render(
      <JobButtonComponent
        job={job}
        filterModel={filterModel}
        visible={true}
        filterPlatformCb={filterPlatformCb}
      />,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Test job hover text');
  });

  describe('classification display', () => {
    it('does not show classified icon for unclassified jobs', () => {
      const job = createMockJob({ failure_classification_id: 1 });
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      expect(screen.queryByTitle('classified')).not.toBeInTheDocument();
    });

    it('shows classified icon for classified jobs', () => {
      const job = createMockJob({ failure_classification_id: 4 });
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      expect(screen.getByTitle('classified')).toBeInTheDocument();
    });

    it('does not show classified icon for classification id 6', () => {
      const job = createMockJob({ failure_classification_id: 6 });
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      expect(screen.queryByTitle('classified')).not.toBeInTheDocument();
    });

    it('does not show classified icon for classification id 8', () => {
      const job = createMockJob({ failure_classification_id: 8 });
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      expect(screen.queryByTitle('classified')).not.toBeInTheDocument();
    });

    it('sets data-classified attribute for classified jobs', () => {
      const job = createMockJob({ failure_classification_id: 4 });
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-classified', 'true');
    });
  });

  describe('runnable job state', () => {
    it('adds runnable classes for runnable jobs', () => {
      const job = createMockJob({ state: 'runnable' });
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('runnable-job-btn');
      expect(button).toHaveClass('runnable');
    });

    it('adds selected class for selected runnable jobs', () => {
      jobButtonRegistry.useJobButtonRegistry.mockReturnValue({
        ...defaultHookReturn,
        isRunnableSelected: true,
      });

      const job = createMockJob({ state: 'runnable' });
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('runnable-job-btn-selected');
    });
  });

  describe('selected job state', () => {
    it('adds selected classes when job is selected', () => {
      jobButtonRegistry.useJobButtonRegistry.mockReturnValue({
        ...defaultHookReturn,
        isSelected: true,
      });

      const job = createMockJob();
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('selected-job');
      expect(button).toHaveClass('btn-lg-xform');
    });

    it('always has job-btn data-testid', () => {
      jobButtonRegistry.useJobButtonRegistry.mockReturnValue({
        ...defaultHookReturn,
        isSelected: true,
      });

      const job = createMockJob();
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      // The component always has data-testid="job-btn"
      expect(screen.getByTestId('job-btn')).toBeInTheDocument();
      expect(screen.getByTestId('job-btn')).toHaveClass('selected-job');
    });

    it('adds btn-xs class when not selected', () => {
      const job = createMockJob();
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-xs');
      expect(button).not.toHaveClass('selected-job');
    });
  });

  describe('intermittent indicator', () => {
    it('shows intermittent icon when intermittent prop is true', () => {
      const job = createMockJob();
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
          intermittent={true}
        />,
      );

      expect(
        screen.getByTitle(
          'Intermittent failure - There is a successful run of this task for the same push.',
        ),
      ).toBeInTheDocument();
    });

    it('does not show intermittent icon by default', () => {
      const job = createMockJob();
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      expect(
        screen.queryByTitle(
          'Intermittent failure - There is a successful run of this task for the same push.',
        ),
      ).not.toBeInTheDocument();
    });
  });

  describe('hook integration', () => {
    it('calls useJobButtonRegistry with correct arguments', () => {
      const job = createMockJob();
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      expect(jobButtonRegistry.useJobButtonRegistry).toHaveBeenCalledWith(
        job,
        filterModel,
        filterPlatformCb,
      );
    });

    it('uses buttonRef from hook', () => {
      const job = createMockJob();
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      // The buttonRef callback should have been called when the button mounted
      expect(mockButtonRef).toHaveBeenCalled();
    });
  });

  describe('imperative handle', () => {
    it('exposes imperative methods via ref', () => {
      const job = createMockJob();
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();
      const ref = React.createRef();

      render(
        <JobButtonComponent
          ref={ref}
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      expect(ref.current).toHaveProperty('props');
      expect(ref.current).toHaveProperty('setSelected');
      expect(ref.current).toHaveProperty('toggleRunnableSelected');
      expect(ref.current).toHaveProperty('refilter');
    });

    it('exposes job in props via imperative handle', () => {
      const job = createMockJob({ id: 999 });
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();
      const ref = React.createRef();

      render(
        <JobButtonComponent
          ref={ref}
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      expect(ref.current.props.job.id).toBe(999);
    });

    it('exposes visible in props via imperative handle', () => {
      const job = createMockJob();
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();
      const ref = React.createRef();

      render(
        <JobButtonComponent
          ref={ref}
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      expect(ref.current.props.visible).toBe(true);
    });
  });

  describe('CSS classes', () => {
    it('always has btn and filter-shown classes', () => {
      const job = createMockJob();
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn');
      expect(button).toHaveClass('filter-shown');
    });

    it('has job-btn class for non-runnable jobs', () => {
      const job = createMockJob({ state: 'completed' });
      const filterModel = createMockFilterModel();
      const filterPlatformCb = jest.fn();

      render(
        <JobButtonComponent
          job={job}
          filterModel={filterModel}
          visible={true}
          filterPlatformCb={filterPlatformCb}
        />,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('job-btn');
      expect(button).not.toHaveClass('runnable-job-btn');
    });
  });
});
