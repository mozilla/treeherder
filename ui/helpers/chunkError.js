// Helpers for recovering from failures to load a lazily-imported route bundle.
//
// The UI code-splits each route (see `lazy(() => import(...))` in ui/App.jsx).
// Bundles are content-hashed and old ones are removed on every deploy, so a
// long-lived tab running a pre-deploy runtime can request a chunk URL that no
// longer exists and fail with a ChunkLoadError. Reloading fetches the current
// (always no-store) HTML shell and the matching assets. We reload at most once
// per cooldown window so a failure that a reload cannot fix (e.g. a corrupt
// immutable cache entry) surfaces an error instead of looping forever.

const RELOAD_TIMESTAMP_KEY = 'thChunkReloadAt';
const RELOAD_COOLDOWN_MS = 10 * 1000;

export const isChunkLoadError = function isChunkLoadError(error) {
  if (!error) {
    return false;
  }

  const name = error.name || '';
  const message = error.message || '';

  return (
    name === 'ChunkLoadError' ||
    /Loading (CSS )?chunk [\d]+ failed/i.test(message) ||
    // Chrome/Firefox native-ESM import failures, plus Safari's variant
    // ("Importing a module script failed.").
    /(failed to fetch|error loading) dynamically imported module/i.test(
      message,
    ) ||
    /importing a module script failed/i.test(message)
  );
};

export const reloadOnChunkError = function reloadOnChunkError(
  error,
  {
    storage = window.sessionStorage,
    location = window.location,
    now = Date.now(),
  } = {},
) {
  if (!isChunkLoadError(error)) {
    return false;
  }

  let lastReloadAt = null;
  try {
    const stored = parseInt(storage.getItem(RELOAD_TIMESTAMP_KEY), 10);
    lastReloadAt = Number.isNaN(stored) ? null : stored;
  } catch (_storageError) {
    lastReloadAt = null;
  }

  // A failure within the cooldown means the reload we already triggered did not
  // fix it; don't loop. A missing timestamp means we have not reloaded yet.
  if (lastReloadAt !== null && now - lastReloadAt < RELOAD_COOLDOWN_MS) {
    return false;
  }

  try {
    storage.setItem(RELOAD_TIMESTAMP_KEY, String(now));
  } catch (_storageError) {
    // sessionStorage can be unavailable (private mode quotas); reload anyway.
  }

  location.reload();
  return true;
};
