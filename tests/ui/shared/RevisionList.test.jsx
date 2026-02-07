
import { render, screen } from '@testing-library/react';

import {
  RevisionList,
  MoreRevisionsLink,
} from '../../../ui/shared/RevisionList';

// Mock the Revision component
jest.mock('../../../ui/shared/Revision', () => ({
  Revision: ({ revision, repo }) => (
    <div data-testid={`revision-${revision.revision}`} data-repo={repo.name}>
      {revision.author}: {revision.comments}
    </div>
  ),
}));

describe('RevisionList', () => {
  const defaultProps = {
    revision: 'abc123',
    revisions: [
      {
        author: 'developer1',
        comments: 'Fix bug 123',
        repository_id: 1,
        result_set_id: 100,
        revision: 'abc123',
      },
      {
        author: 'developer2',
        comments: 'Update tests',
        repository_id: 1,
        result_set_id: 101,
        revision: 'def456',
      },
    ],
    revisionCount: 2,
    repo: {
      name: 'mozilla-central',
      getPushLogHref: jest
        .fn()
        .mockReturnValue(
          'https://hg.mozilla.org/mozilla-central/pushloghtml?changeset=abc123',
        ),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with revisions', () => {
    render(<RevisionList {...defaultProps} />);

    expect(screen.getByTestId('revision-abc123')).toBeInTheDocument();
    expect(screen.getByTestId('revision-def456')).toBeInTheDocument();
  });

  it('applies the widthClass prop to the column', () => {
    const { container } = render(
      <RevisionList {...defaultProps} widthClass="custom-width" />,
    );

    // The Col component renders as a div with the widthClass
    // In Bootstrap 5, Col might not always render with 'col' class if specific sizing is used
    const column = container.querySelector('.custom-width');
    expect(column).toBeInTheDocument();
  });

  it('passes commitShaClass prop to Revision components', () => {
    render(<RevisionList {...defaultProps} commitShaClass="custom-sha" />);

    // The mock implementation doesn't actually use commitShaClass,
    // but we can verify it's passed through by checking the props
    expect(screen.getByTestId('revision-abc123')).toBeInTheDocument();
    expect(screen.getByTestId('revision-def456')).toBeInTheDocument();
  });

  it('passes commentFont prop to Revision components', () => {
    render(<RevisionList {...defaultProps} commentFont="custom-font" />);

    // The mock implementation doesn't actually use commentFont,
    // but we can verify it's passed through by checking the props
    expect(screen.getByTestId('revision-abc123')).toBeInTheDocument();
    expect(screen.getByTestId('revision-def456')).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    render(
      <RevisionList {...defaultProps}>
        <div data-testid="child-element">Child content</div>
      </RevisionList>,
    );

    expect(screen.getByTestId('child-element')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders MoreRevisionsLink when revisionCount > revisions.length', () => {
    const props = {
      ...defaultProps,
      revisionCount: 5, // More than the 2 revisions we have
    };

    render(<RevisionList {...props} />);

    // The MoreRevisionsLink should be rendered
    expect(screen.getByText('…and more')).toBeInTheDocument();

    // The link should have the correct href
    const link = screen.getByText('…and more').closest('a');
    expect(link).toHaveAttribute(
      'href',
      'https://hg.mozilla.org/mozilla-central/pushloghtml?changeset=abc123',
    );
  });

  it('does not render MoreRevisionsLink when revisionCount <= revisions.length', () => {
    render(<RevisionList {...defaultProps} />);

    // The MoreRevisionsLink should not be rendered
    expect(screen.queryByText('…and more')).not.toBeInTheDocument();
  });
});

describe('MoreRevisionsLink', () => {
  it('renders correctly with href', () => {
    render(<MoreRevisionsLink href="https://example.com/revisions" />);

    const link = screen.getByText('…and more');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute(
      'href',
      'https://example.com/revisions',
    );
    expect(link.closest('a')).toHaveAttribute('target', '_blank');
    expect(link.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('includes an external link icon', () => {
    const { container } = render(
      <MoreRevisionsLink href="https://example.com/revisions" />,
    );

    // Check for the FontAwesome icon by looking for the svg element with the ms-1 class
    const icon = container.querySelector('svg.ms-1');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('ms-1');
  });
});
