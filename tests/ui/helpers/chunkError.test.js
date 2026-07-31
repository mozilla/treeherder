/**
 * Unit tests for the chunkError helper module.
 *
 * These helpers back the ChunkErrorBoundary, which recovers from failures to
 * load a lazily-imported route bundle. After a deploy, old content-hashed
 * chunks are deleted, so a tab still running the pre-deploy runtime gets a
 * ChunkLoadError when it navigates to a not-yet-loaded route. This module
 * decides whether such an error should trigger a one-time reload (to pick up
 * the current assets) without getting stuck in a reload loop.
 *
 * This suite covers:
 * - isChunkLoadError: classifying chunk-load failures vs. ordinary errors
 * - reloadOnChunkError: the reload-with-cooldown decision logic
 */

import {
  isChunkLoadError,
  reloadOnChunkError,
} from '../../../ui/helpers/chunkError';

const chunkError = (message, name = 'ChunkLoadError') => {
  const error = new Error(message);
  error.name = name;
  return error;
};

describe('chunkError helper', () => {
  describe('isChunkLoadError', () => {
    it('returns true for an error named ChunkLoadError', () => {
      expect(isChunkLoadError(chunkError('boom'))).toBe(true);
    });

    it('returns true for a webpack/rspack "Loading chunk N failed" message', () => {
      const error = chunkError('Loading chunk 437 failed.', 'Error');
      expect(isChunkLoadError(error)).toBe(true);
    });

    it('returns true for a "Loading CSS chunk" failure message', () => {
      const error = chunkError('Loading CSS chunk 12 failed.', 'Error');
      expect(isChunkLoadError(error)).toBe(true);
    });

    it('returns true for a dynamically-imported-module fetch failure', () => {
      const error = chunkError(
        'Failed to fetch dynamically imported module: https://th/assets/logviewer.abcd1234.js',
        'TypeError',
      );
      expect(isChunkLoadError(error)).toBe(true);
    });

    it('returns true for Safari\'s "Importing a module script failed" message', () => {
      const error = chunkError('Importing a module script failed.', 'TypeError');
      expect(isChunkLoadError(error)).toBe(true);
    });

    it('returns false for an ordinary application error', () => {
      expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(
        false,
      );
    });

    it('returns false for null/undefined', () => {
      expect(isChunkLoadError(null)).toBe(false);
      expect(isChunkLoadError(undefined)).toBe(false);
    });
  });

  describe('reloadOnChunkError', () => {
    let storage;
    let location;

    beforeEach(() => {
      const store = {};
      storage = {
        getItem: (key) => (key in store ? store[key] : null),
        setItem: (key, value) => {
          store[key] = String(value);
        },
        removeItem: (key) => {
          delete store[key];
        },
      };
      location = { reload: jest.fn() };
    });

    it('reloads once when a chunk error is seen for the first time', () => {
      const reloaded = reloadOnChunkError(chunkError('Loading chunk 1 failed.'), {
        storage,
        location,
        now: 1000,
      });

      expect(reloaded).toBe(true);
      expect(location.reload).toHaveBeenCalledTimes(1);
    });

    it('does not reload again for a repeat chunk error within the cooldown window', () => {
      // First failure triggers a reload and records the timestamp.
      reloadOnChunkError(chunkError('Loading chunk 1 failed.'), {
        storage,
        location,
        now: 1000,
      });
      location.reload.mockClear();

      // The reloaded page immediately fails again (e.g. a corrupt immutable
      // cache entry that a normal reload cannot bust). We must NOT loop.
      const reloaded = reloadOnChunkError(chunkError('Loading chunk 1 failed.'), {
        storage,
        location,
        now: 3000,
      });

      expect(reloaded).toBe(false);
      expect(location.reload).not.toHaveBeenCalled();
    });

    it('reloads again once the cooldown has elapsed (e.g. a later deploy)', () => {
      reloadOnChunkError(chunkError('Loading chunk 1 failed.'), {
        storage,
        location,
        now: 1000,
      });
      location.reload.mockClear();

      const reloaded = reloadOnChunkError(chunkError('Loading chunk 9 failed.'), {
        storage,
        location,
        now: 1000 + 60 * 1000,
      });

      expect(reloaded).toBe(true);
      expect(location.reload).toHaveBeenCalledTimes(1);
    });

    it('never reloads for a non-chunk error', () => {
      const reloaded = reloadOnChunkError(new Error('regular bug'), {
        storage,
        location,
        now: 1000,
      });

      expect(reloaded).toBe(false);
      expect(location.reload).not.toHaveBeenCalled();
    });
  });
});
