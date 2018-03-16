export const toDateStr = function toDateStr(timestamp) {
  const dateFormat = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  };
  return new Date(timestamp * 1000).toLocaleString("en-US", dateFormat);
};

// remove any words that are 1 letter long for matching
export const getSearchWords = function getHighlighterArray(text) {
  const tokens = text.split(/[^a-zA-Z0-9_-]+/);

  return tokens.reduce((acc, token) => (
    token.length > 1 ? [...acc, token] : acc
  ), []);
};
