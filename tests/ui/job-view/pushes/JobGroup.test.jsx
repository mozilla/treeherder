import { act, render, screen } from '@testing-library/react';

import JobGroup from '../../../../ui/job-view/pushes/JobGroup';
import {
  getJobGroupInstance,
  clearJobGroupRegistry,
} from '../../../../ui/hooks/useJobGroupRegistry';

jest.mock('../../../../ui/job-view/pushes/JobButton', () => {
  const MockJobButton = ({ job }) => (
    <button type="button" data-testid="job-btn" data-job-id={job.id}>
      {job.job_type_symbol}
    </button>
  );
  MockJobButton.displayName = 'MockJobButton';
  return { __esModule: true, default: MockJobButton };
});

const makeJob = (id) => ({
  id,
  job_type_symbol: `t${id}`,
  job_type_name: `test-${id}`,
  task_run: `task${id}.0`,
  resultStatus: 'success',
  result: 'success',
  visible: true,
});

const group = {
  name: 'Mochitests',
  symbol: 'M',
  tier: 1,
  mapKey: 'push1M1linux64opt',
  jobs: [makeJob(1), makeJob(2), makeJob(3)],
};

const renderGroup = (groupOverride = group) =>
  render(
    <JobGroup
      group={groupOverride}
      filterModel={{ showJob: () => true }}
      filterPlatformCb={() => {}}
      pushGroupState="collapsed"
      duplicateJobsVisible={false}
      groupCountsExpanded={false}
      intermittentJobTypeNames={new Set()}
      runnableVisible={false}
      toggleSelectedRunnableJob={() => {}}
    />,
  );

describe('JobGroup', () => {
  beforeEach(() => {
    clearJobGroupRegistry();
    window.history.replaceState(null, null, '/jobs?repo=autoland');
  });

  it('renders a collapsed group as a count', () => {
    renderGroup();

    expect(screen.getByTestId('job-group-count')).toHaveTextContent('3');
    expect(screen.queryAllByTestId('job-btn')).toHaveLength(0);
  });

  it('registers itself so the group can be expanded by map key', () => {
    renderGroup();

    const instance = getJobGroupInstance(group.mapKey);
    expect(instance).toBeDefined();

    act(() => {
      instance.setExpanded(true);
    });

    expect(screen.queryByTestId('job-group-count')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('job-btn')).toHaveLength(3);
  });

  it('expands on mount when the selected job is rolled up into a count', () => {
    window.history.replaceState(
      null,
      null,
      '/jobs?repo=autoland&selectedTaskRun=task2.0',
    );

    renderGroup();

    expect(screen.queryByTestId('job-group-count')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('job-btn')).toHaveLength(3);
  });

  it('stays collapsed on mount when the selected job already renders as a button', () => {
    window.history.replaceState(
      null,
      null,
      '/jobs?repo=autoland&selectedTaskRun=task2.0',
    );
    const failed = {
      ...makeJob(2),
      resultStatus: 'testfailed',
      result: 'testfailed',
    };

    renderGroup({ ...group, jobs: [makeJob(1), failed, makeJob(3)] });

    expect(screen.getByTestId('job-group-count')).toHaveTextContent('2');
    expect(screen.getAllByTestId('job-btn')).toHaveLength(1);
  });

  it('stays collapsed on mount when the selected job is in another group', () => {
    window.history.replaceState(
      null,
      null,
      '/jobs?repo=autoland&selectedTaskRun=elsewhere.0',
    );

    renderGroup();

    expect(screen.getByTestId('job-group-count')).toHaveTextContent('3');
    expect(screen.queryAllByTestId('job-btn')).toHaveLength(0);
  });

  it('unregisters itself on unmount', () => {
    const { unmount } = renderGroup();

    unmount();

    expect(getJobGroupInstance(group.mapKey)).toBeUndefined();
  });
});
