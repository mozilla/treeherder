
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// Import the component under test
import InfraCompareView from '../../../ui/infra-compare/InfraCompare';
import { getCounterMap } from '../../../ui/infra-compare/helpers';

// Mock dependencies
jest.mock('../../../ui/perfherder/Validation', () => ({
  __esModule: true,
  default: () => (Component) => (props) => (
    <Component {...props} validated={props.validated || {}} />
  ),
}));

jest.mock('../../../ui/infra-compare/helpers', () => ({
  getCounterMap: jest.fn((_jobName, originalData, newData) => {
    if (!originalData && !newData) {
      return { isEmpty: true };
    }

    return {
      isEmpty: false,
      platform: 'mock-platform',
      suite: 'mock-suite',
      originalValue: 100,
      newValue: 110,
      delta: 10,
      deltaPercentage: 10,
      originalJobs: new Map(),
      newJobs: new Map(),
    };
  }),
}));

jest.mock('../../../ui/infra-compare/constants', () => ({
  phTimeRanges: [
    { value: 86400, text: 'Last day' },
    { value: 86400 * 2, text: 'Last 2 days' },
    { value: 604800, text: 'Last 7 days' },
    { value: 1209600, text: 'Last 14 days' },
    { value: 2592000, text: 'Last 30 days' },
  ],
}));

// Store props passed to the mock component for testing
let mockTableViewProps = {};

jest.mock('../../../ui/infra-compare/InfraCompareTableView', () => {
  const MockTableView = (props) => {
    // Store the props for testing
    mockTableViewProps = props;
    return <div data-testid="infra-compare-table-view" />;
  };
  return MockTableView;
});

describe('InfraCompareView', () => {
  // Test fixtures
  const defaultProps = {
    projects: [{ name: 'mozilla-central' }, { name: 'try' }],
    updateAppState: jest.fn(),
  };

  const mockValidated = {
    originalProject: 'mozilla-central',
    newProject: 'try',
    originalRevision: 'abc123',
    newRevision: 'def456',
    originalResultSet: {
      push_timestamp: 1596240000,
    },
    newResultSet: {
      push_timestamp: 1596250000,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock props
    mockTableViewProps = {};
    // Mock Date.now() to return a fixed timestamp for consistent testing
    // The mock timestamps (push_timestamp) are around 1596240000-1596250000
    // We need Date.now() to be close to these values (within 30 days = 2592000 seconds)
    jest.spyOn(Date, 'now').mockImplementation(() => 1596340000 * 1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders correctly', () => {
    const { getByTestId } = render(
      <MemoryRouter>
        <InfraCompareView {...defaultProps} validated={mockValidated} />
      </MemoryRouter>,
    );

    expect(getByTestId('infra-compare-table-view')).toBeInTheDocument();
  });

  it('passes the correct props to InfraCompareTableView', () => {
    render(
      <MemoryRouter>
        <InfraCompareView {...defaultProps} validated={mockValidated} />
      </MemoryRouter>,
    );

    // Check that the correct props were passed to the mock component
    expect(mockTableViewProps).toHaveProperty('projects');
    expect(mockTableViewProps).toHaveProperty('validated');
    expect(mockTableViewProps).toHaveProperty('updateAppState');
    expect(mockTableViewProps).toHaveProperty('jobsNotDisplayed');
    expect(mockTableViewProps).toHaveProperty('getQueryParams');
    expect(mockTableViewProps).toHaveProperty('getDisplayResults');
  });

  describe('getInterval function', () => {
    it('calculates the correct interval based on timestamps', () => {
      render(
        <MemoryRouter>
          <InfraCompareView {...defaultProps} validated={mockValidated} />
        </MemoryRouter>,
      );

      // Since we can't directly access the component's methods,
      // we'll test the getQueryParams function which uses getInterval
      expect(mockTableViewProps).toHaveProperty('getQueryParams');

      // We can test that getQueryParams returns the expected result
      const timeRange = { value: 86400 };
      const [originalParams, newParams] = mockTableViewProps.getQueryParams(
        timeRange,
      );

      // Verify the params have the expected properties
      expect(originalParams).toHaveProperty('project', 'mozilla-central');
      expect(originalParams).toHaveProperty('interval');
      expect(originalParams).toHaveProperty('revision', 'abc123');

      expect(newParams).toHaveProperty('project', 'try');
      expect(newParams).toHaveProperty('interval');
      expect(newParams).toHaveProperty('revision', 'def456');
    });
  });

  describe('getQueryParams function', () => {
    it('returns correct params with originalRevision', () => {
      render(
        <MemoryRouter>
          <InfraCompareView {...defaultProps} validated={mockValidated} />
        </MemoryRouter>,
      );

      const timeRange = { value: 86400 };
      const [originalParams, newParams] = mockTableViewProps.getQueryParams(
        timeRange,
      );

      // Verify the params have the expected properties
      expect(originalParams).toHaveProperty('project', 'mozilla-central');
      expect(originalParams).toHaveProperty('interval');
      expect(originalParams).toHaveProperty('revision', 'abc123');

      expect(newParams).toHaveProperty('project', 'try');
      expect(newParams).toHaveProperty('interval');
      expect(newParams).toHaveProperty('revision', 'def456');
    });

    it('returns correct params without originalRevision', () => {
      const validatedWithoutOriginalRevision = {
        ...mockValidated,
        originalRevision: null,
      };

      render(
        <MemoryRouter>
          <InfraCompareView
            {...defaultProps}
            validated={validatedWithoutOriginalRevision}
          />
        </MemoryRouter>,
      );

      const timeRange = { value: 86400, text: 'Last day' };
      const [originalParams, newParams] = mockTableViewProps.getQueryParams(
        timeRange,
      );

      // Verify the params have the expected properties
      expect(originalParams).toHaveProperty(
        'originalProject',
        'mozilla-central',
      );
      expect(originalParams).toHaveProperty('interval', 86400);
      expect(originalParams).toHaveProperty('startday');
      expect(originalParams).toHaveProperty('endday');

      expect(newParams).toHaveProperty('project', 'try');
      expect(newParams).toHaveProperty('interval', 86400);
      expect(newParams).toHaveProperty('revision', 'def456');
    });
  });

  describe('getDisplayResults function', () => {
    it('processes empty results correctly', () => {
      render(
        <MemoryRouter>
          <InfraCompareView {...defaultProps} validated={mockValidated} />
        </MemoryRouter>,
      );

      const origResultsMap = [];
      const newResultsMap = [];
      const tableNames = [];

      const result = mockTableViewProps.getDisplayResults(
        origResultsMap,
        newResultsMap,
        tableNames,
      );

      expect(result).toHaveProperty('compareResults');
      expect(result).toHaveProperty('loading', false);
      expect(defaultProps.updateAppState).toHaveBeenCalledWith({
        compareData: expect.any(Map),
      });
    });

    it('processes valid results correctly', () => {
      render(
        <MemoryRouter>
          <InfraCompareView {...defaultProps} validated={mockValidated} />
        </MemoryRouter>,
      );

      const origResultsMap = [
        {
          job_type__name: 'platform/suite-1',
          duration: 100,
          result: 'success',
        },
      ];
      const newResultsMap = [
        {
          job_type__name: 'platform/suite-1',
          duration: 110,
          result: 'success',
        },
      ];
      const tableNames = ['platform/suite'];

      const result = mockTableViewProps.getDisplayResults(
        origResultsMap,
        newResultsMap,
        tableNames,
      );

      expect(result).toHaveProperty('compareResults');
      expect(result).toHaveProperty('loading', false);
      expect(defaultProps.updateAppState).toHaveBeenCalledWith({
        compareData: expect.any(Map),
      });
    });

    it('updates jobsNotDisplayed state for empty results', async () => {
      // Mock getCounterMap to return isEmpty: true for the specific test case
      getCounterMap.mockImplementation((jobName) => {
        if (jobName === 'platform/suite') {
          return { isEmpty: true };
        }
        return {
          isEmpty: false,
          platform: 'mock-platform',
          suite: 'mock-suite',
          originalJobs: new Map(),
          newJobs: new Map(),
        };
      });

      // Render the component
      const { rerender } = render(
        <MemoryRouter>
          <InfraCompareView {...defaultProps} validated={mockValidated} />
        </MemoryRouter>,
      );

      // Initial jobsNotDisplayed should be an empty array
      expect(mockTableViewProps.jobsNotDisplayed).toEqual([]);

      // Call getDisplayResults with a table name that will result in isEmpty: true
      const origResultsMap = [];
      const newResultsMap = [];
      const tableNames = ['platform/suite'];

      // Use act to handle the state update
      await act(async () => {
        mockTableViewProps.getDisplayResults(
          origResultsMap,
          newResultsMap,
          tableNames,
        );
      });

      // Force a re-render to ensure the updated state is reflected in the props
      rerender(
        <MemoryRouter>
          <InfraCompareView {...defaultProps} validated={mockValidated} />
        </MemoryRouter>,
      );

      // Now jobsNotDisplayed should contain the table name
      expect(mockTableViewProps.jobsNotDisplayed).toContain('platform/suite');
    });
  });
});
