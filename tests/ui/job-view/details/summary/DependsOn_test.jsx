import { fireEvent, render, screen } from '@testing-library/react';

import DependsOn, {
  findDependencies,
} from '../../../../../ui/job-view/details/summary/DependsOn';
import { usePushesStore } from '../../../../../ui/shared/stores/pushesStore';
import { selectJobViaUrl } from '../../../../../ui/shared/stores/selectedJobStore';

jest.mock('../../../../../ui/shared/stores/selectedJobStore', () => ({
  selectJobViaUrl: jest.fn(),
}));

const job = (over) => ({
  push_id: 10,
  retry_id: 0,
  state: 'completed',
  resultStatus: 'success',
  ...over,
});

const build = job({
  id: 1,
  task_id: 'BUILD',
  job_type_name: 'build-linux64/opt',
  state: 'running',
  resultStatus: 'running',
});
const signing = job({ id: 2, task_id: 'SIGN', job_type_name: 'build-signing-linux64/opt' });
const signingRetry = job({ id: 3, task_id: 'SIGN', retry_id: 1, job_type_name: 'build-signing-linux64/opt' });
const unrelated = job({ id: 4, task_id: 'OTHER', job_type_name: 'test-linux64/opt-xpcshell-1' });
const earlierPush = job({ id: 5, push_id: 9, task_id: 'TOOLCHAIN', job_type_name: 'toolchain-linux64-clang' });

describe('findDependencies', () => {
  it('names dependencies that are jobs, unfinished first, latest run only', () => {
    const jobMap = { 1: signing, 2: build, 3: signingRetry, 4: unrelated };
    const { jobs, others } = findDependencies(['SIGN', 'BUILD', 'DOCKER'], 10, jobMap);

    expect(jobs).toEqual([build, signingRetry]);
    expect(others).toBe(1);
  });

  it('counts a dependency built in another loaded push instead of naming it', () => {
    const { jobs, others } = findDependencies(['BUILD', 'TOOLCHAIN'], 10, {
      1: build,
      5: earlierPush,
    });

    expect(jobs).toEqual([build]);
    expect(others).toBe(1);
  });
});

describe('DependsOn', () => {
  beforeEach(() => {
    usePushesStore.setState({ jobMap: { 1: build, 4: unrelated, 5: earlierPush } });
  });

  it('lists the jobs a job waits on, and counts the rest', () => {
    render(<DependsOn taskIds={['BUILD', 'TOOLCHAIN', 'DOCKER']} pushId={10} />);

    expect(screen.getByTestId('depends-on')).toHaveTextContent(
      'Depends on: build-linux64/opt (running), and 2 tasks not in this push',
    );
  });

  it('selects a dependency when it is clicked', () => {
    render(<DependsOn taskIds={['BUILD']} pushId={10} />);
    fireEvent.click(screen.getByText('build-linux64/opt'));

    expect(selectJobViaUrl).toHaveBeenCalledWith(build);
  });

  it('renders nothing for a task without dependencies', () => {
    render(<DependsOn taskIds={[]} pushId={10} />);

    expect(screen.queryByTestId('depends-on')).not.toBeInTheDocument();
  });
});
