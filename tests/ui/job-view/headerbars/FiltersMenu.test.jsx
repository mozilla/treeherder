
import { render, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import FiltersMenu from '../../../../ui/job-view/headerbars/FiltersMenu';
import { thAllResultStatuses } from '../../../../ui/helpers/constants';
import * as filterHelpers from '../../../../ui/helpers/filter';
import { useSelectedJobStore } from '../../../../ui/job-view/stores/selectedJobStore';
import { usePinnedJobsStore } from '../../../../ui/job-view/stores/pinnedJobsStore';

// Mock the filter helpers
jest.mock('../../../../ui/helpers/filter', () => ({
  thDefaultFilterResultStatuses: [
    'success',
    'testfailed',
    'busted',
    'exception',
  ],
  arraysEqual: jest.fn((a, b) => JSON.stringify(a) === JSON.stringify(b)),
}));

// Mock the standalone functions
const mockSetSelectedJob = jest.fn();
const mockPinJobs = jest.fn();

// Mock the Zustand stores
jest.mock('../../../../ui/job-view/stores/selectedJobStore', () => ({
  useSelectedJobStore: jest.fn(),
  setSelectedJob: (...args) => mockSetSelectedJob(...args),
}));

jest.mock('../../../../ui/job-view/stores/pinnedJobsStore', () => ({
  usePinnedJobsStore: jest.fn(),
  pinJobs: (...args) => mockPinJobs(...args),
}));

describe('FiltersMenu', () => {
  const mockFilterModel = {
    urlParams: {
      resultStatus: ['success', 'testfailed', 'busted', 'exception'],
      classifiedState: ['unclassified', 'classified'],
    },
    toggleResultStatuses: jest.fn(),
    toggleClassifiedFailures: jest.fn(),
    toggleUnclassifiedFailures: jest.fn(),
    isClassifiedFailures: jest.fn(),
    isUnclassifiedFailures: jest.fn(),
    setOnlySuperseded: jest.fn(),
    resetNonFieldFilters: jest.fn(),
  };

  const mockGetAllShownJobs = jest.fn().mockReturnValue([
    { id: 1, jobType: 'test' },
    { id: 2, jobType: 'build' },
  ]);

  const mockUser = {
    email: 'test@example.com',
  };

  const renderWithRouter = (component) => {
    return render(<MemoryRouter>{component}</MemoryRouter>);
  };
  let originalWindowLocation;

  beforeEach(() => {
    // Save original window.location and mock it
    originalWindowLocation = window.location;
    delete window.location;
    window.location = {
      search: '?repo=mozilla-central',
      toString: jest.fn(),
    };

    // Reset all mocks
    jest.clearAllMocks();
    mockSetSelectedJob.mockClear();
    mockPinJobs.mockClear();

    // Set up Zustand store mocks
    useSelectedJobStore.mockImplementation((selector) => {
      const state = {
        selectedJob: null,
        setSelectedJob: mockSetSelectedJob,
      };
      return selector ? selector(state) : state;
    });

    usePinnedJobsStore.mockImplementation((selector) => {
      const state = {
        pinnedJobs: {},
        pinJobs: mockPinJobs,
      };
      return selector ? selector(state) : state;
    });
  });

  afterEach(() => {
    // Restore window.location
    window.location = originalWindowLocation;
  });

  it('renders correctly', () => {
    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Check that the dropdown toggle is rendered
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('renders all result status menu items', () => {
    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Check that all result status menu items are rendered (except 'runnable')
    const resultStatusMenuItems = thAllResultStatuses.filter(
      (rs) => rs !== 'runnable',
    );

    resultStatusMenuItems.forEach((status) => {
      expect(screen.getByText(status)).toBeInTheDocument();
    });
  });

  it('calls toggleResultStatuses when a status filter is clicked', () => {
    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Click on a status filter
    fireEvent.click(screen.getByText('success'));

    // Check that toggleResultStatuses was called with the correct argument
    expect(mockFilterModel.toggleResultStatuses).toHaveBeenCalledWith([
      'success',
    ]);
  });

  it('calls pinJobs when "Pin all showing" is clicked', () => {
    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Click on "Pin all showing"
    fireEvent.click(screen.getByText('Pin all showing'));

    // Check that getAllShownJobs and pinJobs were called
    expect(mockGetAllShownJobs).toHaveBeenCalled();
    expect(mockPinJobs).toHaveBeenCalledWith([
      { id: 1, jobType: 'test' },
      { id: 2, jobType: 'build' },
    ]);
  });

  it('calls setSelectedJob when pinning jobs and no job is selected', () => {
    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Click on "Pin all showing"
    fireEvent.click(screen.getByText('Pin all showing'));

    // Check that setSelectedJob was called with the first job
    expect(mockSetSelectedJob).toHaveBeenCalledWith({ id: 1, jobType: 'test' });
  });

  it('does not call setSelectedJob when pinning jobs and a job is already selected', () => {
    // Set up store with a selected job
    useSelectedJobStore.mockImplementation((selector) => {
      const state = {
        selectedJob: { id: 3, jobType: 'test' },
        setSelectedJob: mockSetSelectedJob,
      };
      return selector ? selector(state) : state;
    });

    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Click on "Pin all showing"
    fireEvent.click(screen.getByText('Pin all showing'));

    // Check that setSelectedJob was not called
    expect(mockSetSelectedJob).not.toHaveBeenCalled();
  });

  it('calls toggleClassifiedFailures(true) when "All failures" is clicked', () => {
    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Click on "All failures"
    fireEvent.click(screen.getByText('All failures'));

    // Check that toggleClassifiedFailures was called with true
    expect(mockFilterModel.toggleClassifiedFailures).toHaveBeenCalledWith(true);
  });

  it('calls toggleUnclassifiedFailures when "Unclassified failures" is clicked', () => {
    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Click on "Unclassified failures"
    fireEvent.click(screen.getByText('Unclassified failures'));

    // Check that toggleUnclassifiedFailures was called
    expect(mockFilterModel.toggleUnclassifiedFailures).toHaveBeenCalled();
  });

  it('calls toggleClassifiedFailures when "Classified failures" is clicked', () => {
    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Click on "Classified failures"
    fireEvent.click(screen.getByText('Classified failures'));

    // Check that toggleClassifiedFailures was called
    expect(mockFilterModel.toggleClassifiedFailures).toHaveBeenCalled();
  });

  it('calls setOnlySuperseded when "Superseded only" is clicked', () => {
    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Click on "Superseded only"
    fireEvent.click(screen.getByText('Superseded only'));

    // Check that setOnlySuperseded was called
    expect(mockFilterModel.setOnlySuperseded).toHaveBeenCalled();
  });

  it('calls resetNonFieldFilters when "Reset" is clicked', () => {
    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Click on "Reset"
    fireEvent.click(screen.getByText('Reset'));

    // Check that resetNonFieldFilters was called
    expect(mockFilterModel.resetNonFieldFilters).toHaveBeenCalled();
  });

  it('creates correct URL for "My pushes only" link', () => {
    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Find the "My pushes only" link
    const myPushesLink = screen.getByText('My pushes only').closest('a');

    // Check that the link has the correct search parameter
    expect(myPushesLink.search).toContain('author=test%40example.com');
  });

  it('creates correct URL for "Hide code review pushes" link', () => {
    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Find the "Hide code review pushes" link
    const hideReviewbotLink = screen
      .getByText('Hide code review pushes')
      .closest('a');

    // Check that the link has the correct search parameter
    expect(hideReviewbotLink.search).toContain('author=-reviewbot');
  });

  it('handles "All jobs" filter correctly when default filters are active', () => {
    // Mock arraysEqual to return true for the default filters
    filterHelpers.arraysEqual.mockImplementation((a, b) => {
      if (
        JSON.stringify(a) ===
          JSON.stringify(filterHelpers.thDefaultFilterResultStatuses) &&
        JSON.stringify(b) === JSON.stringify(['unclassified', 'classified'])
      ) {
        return true;
      }
      return JSON.stringify(a) === JSON.stringify(b);
    });

    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Click on "All jobs"
    fireEvent.click(screen.getByText('All jobs'));

    // Check that toggleClassifiedFailures was called with true
    expect(mockFilterModel.toggleClassifiedFailures).toHaveBeenCalledWith(true);
  });

  it('handles "All jobs" filter correctly when non-default filters are active', () => {
    // Mock arraysEqual to return false for the default filters
    filterHelpers.arraysEqual.mockImplementation(() => false);

    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Click on "All jobs"
    fireEvent.click(screen.getByText('All jobs'));

    // Check that resetNonFieldFilters was called
    expect(mockFilterModel.resetNonFieldFilters).toHaveBeenCalled();
  });
});
