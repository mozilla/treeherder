/**
 * Unit tests for the PushLoadErrors component.
 *
 * This component displays various error/waiting states when pushes cannot be loaded:
 * - Waiting for push with valid revision
 * - Waiting for push with lando commit ID
 * - Invalid revision error
 * - No pushes found
 * - Unknown repository
 */

import { render, screen } from '@testing-library/react';

import PushLoadErrors from '../../../../ui/job-view/pushes/PushLoadErrors';

describe('PushLoadErrors', () => {
  const createMockRepo = (overrides = {}) => ({
    url: 'https://hg.mozilla.org/mozilla-central',
    pushLogUrl: 'https://hg.mozilla.org/mozilla-central/pushloghtml',
    getPushLogHref: jest.fn(
      (rev) => `https://hg.mozilla.org/mozilla-central/rev/${rev}`,
    ),
    ...overrides,
  });

  const renderPushLoadErrors = (props = {}) => {
    const { loadingPushes = false, ...rest } = props;
    return render(
      <PushLoadErrors loadingPushes={loadingPushes} {...rest} />,
    );
  };

  describe('loading state', () => {
    it('renders nothing when loadingPushes is true', () => {
      const { container } = renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        revision: 'abc123def456',
        loadingPushes: true,
      });

      // Should not show any error messages while loading
      expect(
        container.querySelector('.unknown-message-body'),
      ).not.toBeInTheDocument();
    });
  });

  describe('valid revision waiting state', () => {
    it('shows waiting message for valid 12-char revision', () => {
      renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        revision: 'abc123def456',
      });

      expect(
        screen.getByText(/Waiting for push with revision/),
      ).toBeInTheDocument();
      expect(screen.getByText('abc123def456')).toBeInTheDocument();
    });

    it('shows waiting message for valid 40-char revision', () => {
      const longRevision = 'a'.repeat(40);
      renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        revision: longRevision,
      });

      expect(
        screen.getByText(/Waiting for push with revision/),
      ).toBeInTheDocument();
      expect(screen.getByText(longRevision)).toBeInTheDocument();
    });

    it('links revision to pushlog', () => {
      const repo = createMockRepo();
      renderPushLoadErrors({
        currentRepo: repo,
        repoName: 'mozilla-central',
        revision: 'abc123def456',
      });

      const link = screen.getByRole('link', { name: 'abc123def456' });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(repo.getPushLogHref).toHaveBeenCalledWith('abc123def456');
    });

    it('shows spinner when waiting for push', () => {
      renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        revision: 'abc123def456',
      });

      expect(screen.getByTitle('Loading...')).toBeInTheDocument();
    });

    it('shows explanatory message about processing time', () => {
      renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        revision: 'abc123def456',
      });

      expect(
        screen.getByText(/If the push exists, it will appear in a few minutes/),
      ).toBeInTheDocument();
    });
  });

  describe('lando commit ID waiting state', () => {
    it('shows waiting message for lando commit ID when no revision', () => {
      renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        landoCommitID: 'L12345',
        landoStatus: 'in_progress',
      });

      expect(
        screen.getByText(/Waiting for push with lando commit ID/),
      ).toBeInTheDocument();
      expect(screen.getByText('L12345')).toBeInTheDocument();
    });

    it('shows lando status', () => {
      renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        landoCommitID: 'L12345',
        landoStatus: 'submitted',
      });

      expect(
        screen.getByText(/Lando status is: submitted/),
      ).toBeInTheDocument();
    });

    it('links lando commit ID to lando jobs URL', () => {
      renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        landoCommitID: 'L12345',
      });

      const link = screen.getByRole('link', { name: 'L12345' });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('title', 'See lando status');
    });

    it('defaults landoStatus to unknown', () => {
      renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        landoCommitID: 'L12345',
      });

      expect(screen.getByText(/Lando status is: unknown/)).toBeInTheDocument();
    });
  });

  describe('invalid revision error', () => {
    it('shows error for revision shorter than 12 chars', () => {
      renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        revision: 'abc123',
      });

      expect(
        screen.getByText(/This is an invalid or unknown revision/),
      ).toBeInTheDocument();
    });

    it('shows error for revision longer than 40 chars', () => {
      const tooLongRevision = 'a'.repeat(41);
      renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        revision: tooLongRevision,
      });

      expect(
        screen.getByText(/This is an invalid or unknown revision/),
      ).toBeInTheDocument();
    });

    it('provides link to reload latest revisions', () => {
      renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        revision: 'invalid',
      });

      expect(screen.getByRole('link', { name: /here/ })).toBeInTheDocument();
      expect(screen.getByText(/mozilla-central/)).toBeInTheDocument();
    });
  });

  describe('no pushes found state', () => {
    it('shows no pushes message when no revision or lando commit', () => {
      renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
      });

      expect(screen.getByText('No pushes found.')).toBeInTheDocument();
    });

    it('links to repository URL', () => {
      const repo = createMockRepo({
        url: 'https://hg.mozilla.org/try',
      });
      renderPushLoadErrors({ currentRepo: repo, repoName: 'try' });

      const link = screen.getByRole('link', { name: 'here' });
      expect(link).toHaveAttribute('href', 'https://hg.mozilla.org/try');
    });

    it('shows message about repository information', () => {
      renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
      });

      expect(
        screen.getByText(/No commit information could be loaded/),
      ).toBeInTheDocument();
    });
  });

  describe('unknown repository state', () => {
    it('shows unknown repository message when repo has no URL', () => {
      const repo = createMockRepo({ url: '' });
      renderPushLoadErrors({ currentRepo: repo, repoName: 'nonexistent' });

      expect(screen.getByText('Unknown repository.')).toBeInTheDocument();
    });

    it('provides link to file a bug', () => {
      const repo = createMockRepo({ url: '' });
      renderPushLoadErrors({ currentRepo: repo, repoName: 'nonexistent' });

      const link = screen.getByRole('link', {
        name: /file a bug against the Treeherder product/,
      });
      expect(link).toHaveAttribute(
        'href',
        'https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree%20Management&component=Treeherder',
      );
    });

    it('shows explanatory message about unknown repository', () => {
      const repo = createMockRepo({ url: '' });
      renderPushLoadErrors({ currentRepo: repo, repoName: 'nonexistent' });

      expect(
        screen.getByText(/This repository is either unknown to Treeherder/),
      ).toBeInTheDocument();
    });
  });

  describe('container structure', () => {
    it('renders inside push-load-errors container', () => {
      const { container } = renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        revision: 'abc123def456',
      });

      expect(container.querySelector('.push-load-errors')).toBeInTheDocument();
    });

    it('renders messages inside push-body unknown-message-body', () => {
      const { container } = renderPushLoadErrors({
        currentRepo: createMockRepo(),
        repoName: 'mozilla-central',
        revision: 'abc123def456',
      });

      expect(container.querySelector('.push-body')).toBeInTheDocument();
      expect(
        container.querySelector('.unknown-message-body'),
      ).toBeInTheDocument();
    });
  });
});
