export const escape = function (id) {
  return id.replace(/(:|\[|\]|\?|,|\.|\s+)/g, '-');
};

export const getPlatformRowId = function (repoName, resultsetId, platformName, platformOptions) {
  // ensure there are no invalid characters in the id (like spaces, etc)
  return escape(repoName +
    resultsetId +
    platformName +
    platformOptions);
};

export const getResultsetTableId = function (repoName, resultsetId, revision) {
  return escape(repoName + resultsetId + revision);
};

export const getGroupMapKey = function (result_set_id, grSymbol, grTier, plName, plOpt) {
  //Build string key for groupMap entries
  return escape(result_set_id + grSymbol + grTier + plName + plOpt);
};
