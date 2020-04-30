import { getArtifactsUrl } from './url';

export const longDateFormat = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hour12: false,
};

export const shortDateFormat = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hour12: false,
};

export const toDateStr = function toDateStr(timestamp) {
  return new Date(timestamp * 1000).toLocaleString('en-US', longDateFormat);
};

export const toShortDateStr = function toDateStr(timestamp) {
  return new Date(timestamp * 1000).toLocaleString('en-US', shortDateFormat);
};

// remove any words that are 1 letter long for matching
export const getSearchWords = function getHighlighterArray(text) {
  const tokens = text.split(/[^a-zA-Z0-9_-]+/);

  return tokens.reduce(
    (acc, token) => (token.length > 1 ? [...acc, token] : acc),
    [],
  );
};

export const getPercentComplete = function getPercentComplete(counts) {
  const { pending, running, completed } = counts;
  const inProgress = pending + running;
  const total = completed + inProgress;

  return total > 0 ? Math.floor((completed / total) * 100) : 0;
};

export const formatArtifacts = function formatArtifacts(data, artifactParams) {
  return data.map((item) => {
    const value = item.name.replace(/.*\//, '');
    artifactParams.artifactPath = item.name;
    // for backwards compatibility with JobDetail API
    const title = 'artifact uploaded';
    return { url: getArtifactsUrl(artifactParams), value, title };
  });
};
