import { render, screen } from '@testing-library/react';

import PushJobs from '../../../../ui/job-view/pushes/PushJobs';

jest.mock('../../../../ui/job-view/pushes/Platform', () => {
  const MockPlatform = ({ platform }) => (
    <tr data-testid={`platform-${platform.name}`}>
      <td>{platform.name}</td>
    </tr>
  );
  return MockPlatform;
});

const makePlatform = (name, jobs) => ({
  name,
  option: 'opt',
  groups: [{ symbol: '', tier: 1, mapKey: name, jobs }],
});

describe('PushJobs', () => {
  const defaultProps = {
    push: { id: 1, revision: 'abcdef' },
    repoName: 'autoland',
    filterModel: { showJob: () => true },
    pushGroupState: 'collapsed',
    runnableVisible: false,
    duplicateJobsVisible: false,
    groupCountsExpanded: false,
    toggleSelectedRunnableJob: jest.fn(),
  };

  it('does not render the manifest variant section without variant jobs', () => {
    render(
      <PushJobs
        {...defaultProps}
        platforms={[makePlatform('linux', [{ id: 1, state: 'completed' }])]}
      />,
    );

    expect(screen.getByTestId('platform-linux')).toBeInTheDocument();
    expect(screen.queryByTestId('manifest-variant-jobs')).toBeNull();
  });

  it('renders variant jobs in their own section', () => {
    render(
      <PushJobs
        {...defaultProps}
        platforms={[makePlatform('linux', [{ id: 1, state: 'completed' }])]}
        variantPlatforms={[
          makePlatform('windows', [{ id: 2, state: 'completed' }]),
        ]}
      />,
    );

    const section = screen.getByTestId('manifest-variant-jobs');
    expect(section).toHaveTextContent('Different test manifests');
    expect(section).toContainElement(screen.getByTestId('platform-windows'));
    expect(section).not.toContainElement(screen.getByTestId('platform-linux'));
  });

  it('hides the variant section when its jobs are filtered out', () => {
    render(
      <PushJobs
        {...defaultProps}
        filterModel={{ showJob: (job) => job.id !== 2 }}
        platforms={[makePlatform('linux', [{ id: 1, state: 'completed' }])]}
        variantPlatforms={[
          makePlatform('windows', [{ id: 2, state: 'completed' }]),
        ]}
      />,
    );

    expect(screen.queryByTestId('manifest-variant-jobs')).toBeNull();
  });
});
