
import { render, fireEvent, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import FiltersMenu from '../../../../ui/job-view/headerbars/FiltersMenu';
import { thAllResultStatuses } from '../../../../ui/helpers/constants';
import * as filterHelpers from '../../../../ui/helpers/filter';

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

// Mock Redux action modules - must use jest.mock for ES modules with SWC
const mockSetSelectedJob = jest.fn((job) => ({
  type: 'SET_SELECTED_JOB',
  job,
}));
const mockClearSelectedJob = jest.fn(() => ({
  type: 'CLEAR_SELECTED_JOB',
}));
const mockPinJobs = jest.fn((jobs) => ({
  type: 'PIN_JOBS',
  jobs,
}));

jest.mock('../../../../ui/job-view/redux/stores/selectedJob', () => ({
  setSelectedJob: (...args) => mockSetSelectedJob(...args),
  clearSelectedJob: (...args) => mockClearSelectedJob(...args),
}));

jest.mock('../../../../ui/job-view/redux/stores/pinnedJobs', () => ({
  pinJobs: (...args) => mockPinJobs(...args),
}));

// Create a mock store
const mockStore = configureStore([thunk]);

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

  let store;

  const renderWithRouter = (component) => {
    return render(
      <MemoryRouter>
        <Provider store={store}>{component}</Provider>
      </MemoryRouter>,
    );
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
    mockClearSelectedJob.mockClear();
    mockPinJobs.mockClear();

    // Create a fresh store for each test
    store = mockStore({
      selectedJob: {
        selectedJob: null,
      },
      pinnedJobs: {
        pinnedJobs: [],
      },
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

    // Check that the store received the PIN_JOBS action
    const actions = store.getActions();
    expect(actions).toContainEqual({
      type: 'PIN_JOBS',
      jobs: [
        { id: 1, jobType: 'test' },
        { id: 2, jobType: 'build' },
      ],
    });
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

    // Check that the store received the SET_SELECTED_JOB action
    const actions = store.getActions();
    expect(actions).toContainEqual({
      type: 'SET_SELECTED_JOB',
      job: {
        id: 1,
        jobType: 'test',
      },
    });
  });

  it('does not call setSelectedJob when pinning jobs and a job is already selected', () => {
    // Create a store with a selected job
    const storeWithSelectedJob = mockStore({
      selectedJob: {
        selectedJob: { id: 3, jobType: 'test' },
      },
      pinnedJobs: {
        pinnedJobs: [],
      },
    });

    render(
      <MemoryRouter>
        <Provider store={storeWithSelectedJob}>
          <FiltersMenu
            filterModel={mockFilterModel}
            getAllShownJobs={mockGetAllShownJobs}
            user={mockUser}
          />
        </Provider>
      </MemoryRouter>,
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
