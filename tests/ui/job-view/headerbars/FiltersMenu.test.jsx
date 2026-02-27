import { render, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import FiltersMenu from '../../../../ui/job-view/headerbars/FiltersMenu';
import { thAllResultStatuses } from '../../../../ui/helpers/constants';

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

// Mock Zustand stores
const mockSetSelectedJob = jest.fn();
const mockPinJobs = jest.fn();
let mockSelectedJob = null;

jest.mock('../../../../ui/job-view/stores/selectedJobStore', () => ({
  useSelectedJobStore: (selector) => selector({ selectedJob: mockSelectedJob }),
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
    mockSelectedJob = null;
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
    mockSelectedJob = null;

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
    mockSelectedJob = { id: 3, jobType: 'test' };

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

  it('renders My pushes only option', () => {
    renderWithRouter(
      <FiltersMenu
        filterModel={mockFilterModel}
        getAllShownJobs={mockGetAllShownJobs}
        user={mockUser}
      />,
    );

    // Open the dropdown
    fireEvent.click(screen.getByText('Filters'));

    // Check that "My pushes only" is rendered
    expect(screen.getByText('My pushes only')).toBeInTheDocument();
  });
});
