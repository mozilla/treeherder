export const escapeId = (id) => id.replace(/(:|\[|\]|\?|,|\.|\s+)/g, '-');

export const getPlatformRowId = (
  repoName,
  pushId,
  platformName,
  platformOptions,
) =>
  // ensure there are no invalid characters in the id (like spaces, etc)
  escapeId(`${repoName}${pushId}${platformName}${platformOptions}`);

export const getPushTableId = (repoName, pushId, revision) =>
  escapeId(`${repoName}${pushId}${revision}`);

export const getGroupMapKey = (pushId, grSymbol, grTier, plName, plOpt) =>
  // Build string key for groupMap entries
  escapeId(`${pushId}${grSymbol}${grTier}${plName}${plOpt}`);
