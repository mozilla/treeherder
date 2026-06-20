/**
 * Unit tests for the ChunkErrorBoundary component.
 *
 * The boundary wraps the lazily-loaded routes in ui/App.jsx. When loading a
 * route bundle fails (a stale/removed chunk after a deploy, or a corrupt
 * cached asset), it should attempt a one-time recovery reload instead of
 * leaving the user on an infinite Suspense spinner, and fall back to a
 * readable message when a reload cannot fix it.
 *
 * This suite covers:
 * - Rendering children when there is no error
 * - Triggering a recovery reload on a chunk-load error
 * - Showing a recoverable message when the reload is suppressed (cooldown)
 * - Showing a generic fallback for ordinary (non-chunk) errors
 */

import { render, screen } from '@testing-library/react';

import ChunkErrorBoundary from '../../../ui/shared/ChunkErrorBoundary';
import { reloadOnChunkError } from '../../../ui/helpers/chunkError';

jest.mock('../../../ui/helpers/chunkError', () => {
  const actual = jest.requireActual('../../../ui/helpers/chunkError');
  return {
    __esModule: true,
    ...actual,
    reloadOnChunkError: jest.fn(),
  };
});

const chunkLoadError = () => {
  const error = new Error('Loading chunk 437 failed.');
  error.name = 'ChunkLoadError';
  return error;
};

const Bomb = ({ error }) => {
  throw error;
};

describe('ChunkErrorBoundary', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    reloadOnChunkError.mockReset();
    // React logs caught render errors to console.error; keep test output clean.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders its children when nothing throws', () => {
    render(
      <ChunkErrorBoundary>
        <div>healthy content</div>
      </ChunkErrorBoundary>,
    );

    expect(screen.getByText('healthy content')).toBeInTheDocument();
    expect(reloadOnChunkError).not.toHaveBeenCalled();
  });

  it('attempts a recovery reload when a chunk fails to load', () => {
    reloadOnChunkError.mockReturnValue(true);
    const error = chunkLoadError();

    render(
      <ChunkErrorBoundary>
        <Bomb error={error} />
      </ChunkErrorBoundary>,
    );

    expect(reloadOnChunkError).toHaveBeenCalledWith(error);
    expect(screen.getByText(/reloading/i)).toBeInTheDocument();
  });

  it('shows a recoverable message when a reload cannot fix the chunk error', () => {
    reloadOnChunkError.mockReturnValue(false);

    render(
      <ChunkErrorBoundary>
        <Bomb error={chunkLoadError()} />
      </ChunkErrorBoundary>,
    );

    expect(reloadOnChunkError).toHaveBeenCalled();
    expect(screen.getByText(/refresh/i)).toBeInTheDocument();
  });

  it('shows a generic fallback for an ordinary error without reloading', () => {
    reloadOnChunkError.mockReturnValue(false);

    render(
      <ChunkErrorBoundary>
        <Bomb error={new Error('something unrelated broke')} />
      </ChunkErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/reloading/i)).not.toBeInTheDocument();
  });
});
