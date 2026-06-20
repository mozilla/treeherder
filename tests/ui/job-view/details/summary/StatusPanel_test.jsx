import { render, screen } from '@testing-library/react';

import StatusPanel from '../../../../../ui/job-view/details/summary/StatusPanel';

const baseJob = {
  resultStatus: 'success',
  result: 'success',
  state: 'completed',
};

describe('StatusPanel', () => {
  it('does not show the Taskcluster expired badge by default', () => {
    render(<StatusPanel selectedJobFull={baseJob} />);

    expect(
      screen.queryByTestId('taskcluster-expired-badge'),
    ).not.toBeInTheDocument();
  });

  it('shows the Taskcluster expired badge when taskExpired is true', () => {
    render(<StatusPanel selectedJobFull={baseJob} taskExpired />);

    const badge = screen.getByTestId('taskcluster-expired-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Expired');
  });
});
