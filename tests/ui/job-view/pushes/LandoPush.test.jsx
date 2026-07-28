/**
 * Unit tests for the LandoPush component, which displays a lando landing job
 * that has not been turned into a push yet, using the layout of a real push.
 */

import { render, screen } from '@testing-library/react';

import LandoPush from '../../../../ui/job-view/pushes/LandoPush';

const landoJob = {
  commit_id: '',
  created_at: '2026-07-28T17:22:11.721Z',
  error: '',
  id: 72544,
  requester: 'fqueze@mozilla.com',
  status: 'SUBMITTED',
  updated_at: '2026-07-28T17:22:11.769Z',
  repository: 'try',
  url: 'https://lando.moz.tools/landings/72544',
  revisions: [
    {
      author_email: 'florian@queze.net',
      author_name: 'Florian Quèze',
      commit_message:
        "Bug 2052432 - Log each minidump's name and size, r=ahal.\n\nMore details here.",
      url: 'https://lando.moz.tools/landings/72544#r177716',
    },
    {
      author_email: 'someone@example.com',
      author_name: 'Some One',
      commit_message: 'Fuzzy query=xpcshell linux and windows',
      url: 'https://lando.moz.tools/landings/72544#r177719',
    },
  ],
};

const renderLandoPush = (overrides = {}) =>
  render(
    <LandoPush
      landoJob={{ ...landoJob, ...overrides }}
      landoInstance="lando-prod-2025"
    />,
  );

describe('LandoPush', () => {
  it('shows the requester and status', () => {
    renderLandoPush();

    expect(screen.getByText(/fqueze@mozilla.com/)).toBeInTheDocument();
    expect(screen.getByText('submitted')).toBeInTheDocument();
    expect(screen.getByTitle('Loading...')).toBeInTheDocument();
  });

  it('links the push date to the lando job', () => {
    const { container } = renderLandoPush();

    expect(container.querySelector('.push-header a')).toHaveAttribute(
      'href',
      'https://lando.moz.tools/landings/72544',
    );
  });

  it('shows one row per revision, tip first, with only the first line of the commit message', () => {
    renderLandoPush();

    const revisions = screen.getAllByTestId('revision');
    expect(revisions).toHaveLength(2);
    // Lando returns the commits in the opposite order.
    expect(revisions[0]).toHaveTextContent('Fuzzy query=xpcshell');
    expect(revisions[1]).toHaveTextContent('Log each minidump');
    expect(
      screen.getByText(/Log each minidump's name and size, r=ahal./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/More details here/)).not.toBeInTheDocument();
  });

  it('shows no commit hash, as the commits have not landed yet', () => {
    renderLandoPush();

    expect(screen.queryByText('r177716')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Copy full hash')).not.toBeInTheDocument();
  });

  it('explains that the jobs are not available yet', () => {
    renderLandoPush();

    expect(
      screen.getByText(/hasn't been processed by Lando yet/),
    ).toBeInTheDocument();
  });

  it('shows the lando error instead, when there is one', () => {
    const error = 'hg error in cmd: hg push -r tip\nabort: stream ended';
    const { container } = renderLandoPush({ status: 'FAILED', error });

    // The line breaks of the raw error output are kept.
    expect(container.querySelector('.lando-push-error').textContent).toBe(
      error,
    );
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(
      screen.queryByText(/hasn't been processed by Lando yet/),
    ).not.toBeInTheDocument();
  });

  it.each(['LANDED', 'FAILED', 'CANCELLED'])(
    'stops spinning once the job is %s',
    (status) => {
      renderLandoPush({ status });

      expect(screen.queryByTitle('Loading...')).not.toBeInTheDocument();
    },
  );

  it('keeps spinning while the job is still being processed', () => {
    renderLandoPush({ status: 'IN_PROGRESS' });

    expect(screen.getByText('in progress')).toBeInTheDocument();
    expect(screen.getByTitle('Loading...')).toBeInTheDocument();
  });
});
