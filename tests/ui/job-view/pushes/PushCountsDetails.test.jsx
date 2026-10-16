import { render, screen } from '@testing-library/react';

import PushCountsDetails from '../../../../ui/job-view/pushes/PushCountsDetails';

const counts = {
  build_failed: 2,
  build_pending: 0,
  build_running: 0,
  intermittentBuild: 0,
  intermittentLint: 0,
  intermittentTests: 3,
  lint_failed: 0,
  lint_pending: 0,
  lint_running: 0,
  pending: 0,
  running: 0,
  test_failed: 15,
  total: 40,
};

const mockMatchMedia = (matches) =>
  jest.spyOn(window, 'matchMedia').mockImplementation((media) => ({
    media,
    matches,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));

describe('PushCountsDetails', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows each category in its own column on desktop', () => {
    mockMatchMedia(false);
    render(<PushCountsDetails {...counts} />);

    expect(screen.getByText(/2 build jobs failed/)).toBeInTheDocument();
    expect(screen.getByText(/15 jobs failed/)).toBeInTheDocument();
    expect(screen.getByText(/3 intermittents/)).toBeInTheDocument();
  });

  it('fits the categories and failed counts on one line on mobile', () => {
    mockMatchMedia(true);
    const { container } = render(<PushCountsDetails {...counts} />);

    const line = container.querySelector('.push-counts-inline');
    expect(line).toHaveTextContent('LintingBuilds2Tests15 failed');
    expect(screen.getByTitle('0 lint jobs failed')).toBeInTheDocument();
    expect(screen.getByTitle('2 build jobs failed')).toBeInTheDocument();
    expect(
      screen.getByTitle('15 jobs failed (3 intermittents)'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/intermittent/)).toBeNull();
  });

  it('links the mobile test failures to the external failure view', () => {
    mockMatchMedia(true);
    render(
      <PushCountsDetails
        {...counts}
        externalFailureUrl="https://example.com/failures"
        externalFailureTooltip="Open failures"
      />,
    );

    expect(screen.getByRole('link', { name: '15 failed' })).toHaveAttribute(
      'href',
      'https://example.com/failures',
    );
  });
});
