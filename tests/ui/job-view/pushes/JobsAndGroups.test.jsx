
import { render, screen } from '@testing-library/react';

import JobsAndGroups, {
  getIntermittentJobTypeNames,
} from '../../../../ui/job-view/pushes/JobsAndGroups';

// Mock the child components
jest.mock('../../../../ui/job-view/pushes/JobButton', () => {
  const MockJobButton = ({ job, visible, intermittent }) => (
    <div
      data-testid={`job-button-${job.id}`}
      data-visible={visible}
      data-intermittent={intermittent}
    >
      Job Button: {job.job_type_name}
    </div>
  );
  return MockJobButton;
});

jest.mock('../../../../ui/job-view/pushes/JobGroup', () => {
  const MockJobGroup = ({ group, confirmGroup }) => (
    <div
      data-testid={`job-group-${group.mapKey}`}
      data-confirm-group={!!Object.keys(confirmGroup).length}
    >
      Job Group: {group.symbol}
    </div>
  );
  return MockJobGroup;
});

describe('JobsAndGroups', () => {
  const defaultProps = {
    groups: [],
    repoName: 'mozilla-central',
    filterModel: {},
    filterPlatformCb: jest.fn(),
    pushGroupState: 'collapsed',
    duplicateJobsVisible: false,
    groupCountsExpanded: false,
    runnableVisible: false,
    toggleSelectedRunnableJob: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderInTable = (ui) =>
    render(
      <table>
        <tbody>
          <tr>{ui}</tr>
        </tbody>
      </table>,
    );

  it('renders correctly with no groups', () => {
    renderInTable(<JobsAndGroups {...defaultProps} />);

    const jobRow = screen.getByRole('cell');
    expect(jobRow).toHaveClass('job-row');
    expect(jobRow).toBeEmptyDOMElement();
  });

  it('renders job groups correctly', () => {
    const groups = [
      {
        mapKey: 'group1',
        symbol: 'G1',
        tier: 2,
        visible: true,
        jobs: [],
      },
      {
        mapKey: 'group2',
        symbol: 'G2',
        tier: 3,
        visible: true,
        jobs: [],
      },
    ];

    renderInTable(<JobsAndGroups {...defaultProps} groups={groups} />);

    expect(screen.getByTestId('job-group-group1')).toBeInTheDocument();
    expect(screen.getByTestId('job-group-group2')).toBeInTheDocument();
  });

  it('does not render invisible job groups', () => {
    const groups = [
      {
        mapKey: 'group1',
        symbol: 'G1',
        tier: 2,
        visible: true,
        jobs: [],
      },
      {
        mapKey: 'group2',
        symbol: 'G2',
        tier: 3,
        visible: false,
        jobs: [],
      },
    ];

    renderInTable(<JobsAndGroups {...defaultProps} groups={groups} />);

    expect(screen.getByTestId('job-group-group1')).toBeInTheDocument();
    expect(screen.queryByTestId('job-group-group2')).not.toBeInTheDocument();
  });

  it('renders individual job buttons for tier 1 groups with empty symbol', () => {
    const groups = [
      {
        mapKey: 'group1',
        symbol: '',
        tier: 1,
        visible: true,
        jobs: [
          {
            id: 1,
            job_type_name: 'test-job-1',
            visible: true,
            resultStatus: 'success',
            failure_classification_id: 0,
            result: 'success',
          },
          {
            id: 2,
            job_type_name: 'test-job-2',
            visible: true,
            resultStatus: 'testfailed',
            failure_classification_id: 0,
            result: 'testfailed',
          },
        ],
      },
    ];

    renderInTable(<JobsAndGroups {...defaultProps} groups={groups} />);

    expect(screen.queryByTestId('job-group-group1')).not.toBeInTheDocument();
    expect(screen.getByTestId('job-button-1')).toBeInTheDocument();
    expect(screen.getByTestId('job-button-2')).toBeInTheDocument();
  });

  it('identifies intermittent jobs correctly', () => {
    const groups = [
      {
        mapKey: 'group1',
        symbol: '',
        tier: 1,
        visible: true,
        jobs: [
          {
            id: 1,
            job_type_name: 'test-job-1',
            visible: true,
            resultStatus: 'success',
            failure_classification_id: 0,
            result: 'success',
          },
          {
            id: 2,
            job_type_name: 'test-job-1',
            visible: true,
            resultStatus: 'testfailed',
            failure_classification_id: 0,
            result: 'testfailed',
          },
        ],
      },
    ];

    renderInTable(<JobsAndGroups {...defaultProps} groups={groups} />);

    // The second job should be marked as intermittent because there's a passing job with the same name
    expect(screen.getByTestId('job-button-2')).toHaveAttribute(
      'data-intermittent',
      'true',
    );
  });

  it('handles confirm groups correctly', () => {
    const groups = [
      {
        mapKey: 'push1 G1 2 linux debug2',
        symbol: 'G1',
        tier: 2,
        visible: true,
        jobs: [],
      },
      {
        mapKey: 'push1 G1 2 linux debug-cf3',
        symbol: 'G1-cf',
        tier: 3,
        visible: true,
        jobs: [
          {
            job_type_name: 'test-job-1-cf',
            result: 'testfailed',
          },
        ],
      },
    ];

    renderInTable(<JobsAndGroups {...defaultProps} groups={groups} />);

    // The first group should have a confirm group
    expect(
      screen.getByTestId('job-group-push1 G1 2 linux debug2'),
    ).toHaveAttribute('data-confirm-group', 'true');
  });

  describe('getIntermittentJobTypeNames', () => {
    it('identifies intermittent jobs based on failure ratio', () => {
      const groupJobs = [
        {
          id: 1,
          job_type_name: 'test-job-1',
          result: 'testfailed',
        },
        {
          id: 2,
          job_type_name: 'test-job-1',
          result: 'success',
        },
        {
          id: 3,
          job_type_name: 'test-job-1',
          result: 'success',
        },
      ];

      const intermittentJobTypeNames = getIntermittentJobTypeNames(groupJobs);

      // test-job-1 should be identified as intermittent because 1/3 of the jobs failed (below the 0.5 threshold)
      expect(intermittentJobTypeNames.has('test-job-1')).toBe(true);
    });

    it('does not identify jobs as intermittent if failure ratio is too high', () => {
      const groupJobs = [
        {
          id: 1,
          job_type_name: 'test-job-1',
          result: 'testfailed',
        },
        {
          id: 2,
          job_type_name: 'test-job-1',
          result: 'testfailed',
        },
        {
          id: 3,
          job_type_name: 'test-job-1',
          result: 'success',
        },
      ];

      const intermittentJobTypeNames = getIntermittentJobTypeNames(groupJobs);

      // test-job-1 should not be identified as intermittent because 2/3 of the jobs failed (above the 0.5 threshold)
      expect(intermittentJobTypeNames.has('test-job-1')).toBe(false);
    });

    it('identifies jobs as intermittent if they have a confirm job', () => {
      const groupJobs = [
        {
          id: 1,
          job_type_name: 'test-job-1',
          result: 'testfailed',
        },
      ];

      const confirmGroup = {
        jobs: [
          {
            job_type_name: 'test-job-1-cf',
            result: 'success',
          },
        ],
      };

      const intermittentJobTypeNames = getIntermittentJobTypeNames(
        groupJobs,
        confirmGroup,
      );

      // test-job-1 should be identified as intermittent because it has a green confirm job
      expect(intermittentJobTypeNames.has('test-job-1')).toBe(true);
    });

    it('does not identify jobs as intermittent if they have a failing confirm job', () => {
      const groupJobs = [
        {
          id: 1,
          job_type_name: 'test-job-1',
          result: 'testfailed',
        },
      ];

      const confirmGroup = {
        jobs: [
          {
            job_type_name: 'test-job-1-cf',
            result: 'testfailed',
          },
        ],
      };

      const intermittentJobTypeNames = getIntermittentJobTypeNames(
        groupJobs,
        confirmGroup,
      );

      // test-job-1 should not be identified as intermittent because it has a failing confirm job
      expect(intermittentJobTypeNames.has('test-job-1')).toBe(false);
    });
  });
});
