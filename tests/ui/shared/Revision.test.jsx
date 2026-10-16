import { render, screen, fireEvent } from '@testing-library/react';

import { Revision } from '../../../ui/shared/Revision';

describe('Revision', () => {
  const revision = {
    author: 'Jane Doe <jane@example.com>',
    comments:
      'Bug 123 - Fix the thing r=reviewer\n\nLonger explanation.\n\nDifferential Revision: https://phabricator.services.mozilla.com/D456',
    revision: 'abcdef1234567890abcdef1234567890abcdef12',
  };
  const repo = {
    url: 'https://hg.mozilla.org/integration/autoland',
    getRevisionHref: (rev) => `https://example.com/rev/${rev}`,
  };

  it('shows the hash, author and Phabricator link inline on desktop', () => {
    render(<Revision revision={revision} repo={repo} />);

    expect(screen.getByText('abcdef123456')).toBeInTheDocument();
    expect(
      screen.getByTitle('Open D456 on Phabricator'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { expanded: false })).toBeNull();
  });

  it('collapses to the commit message on mobile and expands on tap', () => {
    render(<Revision revision={revision} repo={repo} mobile />);

    const toggle = screen.getByRole('button', {
      name: /Fix the thing/,
      expanded: false,
    });
    expect(screen.queryByText('abcdef123456')).toBeNull();
    expect(screen.queryByText('Jane Doe')).toBeNull();
    expect(screen.queryByTitle('Open D456 on Phabricator')).toBeNull();
    // Bug numbers are plain text until the row is expanded.
    expect(toggle.querySelector('a')).toBeNull();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('abcdef123456')).toHaveAttribute(
      'href',
      `https://example.com/rev/${revision.revision}`,
    );
    expect(screen.getByText('Jane Doe')).toHaveAttribute(
      'title',
      'jane@example.com',
    );
    expect(screen.getByTitle('Open D456 on Phabricator')).toHaveAttribute(
      'href',
      'https://phabricator.services.mozilla.com/D456',
    );
    expect(screen.getByText(/Longer explanation\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bug 123' })).toHaveAttribute(
      'href',
      'https://bugzilla.mozilla.org/show_bug.cgi?id=123',
    );

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('abcdef123456')).toBeNull();
  });

  it('omits the hash on mobile when hideCommitSha is set', () => {
    render(<Revision revision={revision} repo={repo} mobile hideCommitSha />);

    fireEvent.click(screen.getByRole('button', { name: /Fix the thing/ }));

    expect(screen.queryByText('abcdef123456')).toBeNull();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });
});
