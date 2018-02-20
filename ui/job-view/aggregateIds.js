export const escape = id => (
  id.replace(/(:|\[|\]|\?|,|\.|\s+)/g, '-')
);

export const getPlatformRowId = (repoName, pushId, platformName, platformOptions) => (
  // ensure there are no invalid characters in the id (like spaces, etc)
  escape(repoName + pushId + platformName + platformOptions)
);

export const getPushTableId = (repoName, pushId, revision) => (
  escape(repoName + pushId + revision)
);

export const getGroupMapKey = (pushId, grSymbol, grTier, plName, plOpt) => (
  //Build string key for groupMap entries
  escape(pushId + grSymbol + grTier + plName + plOpt)
);
