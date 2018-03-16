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

export const escapeHTML = function escapeHTML(text) {
  if (text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&quot;');
  }
  return '';
};

export const highlightCommonTerms = function highlightCommonTerms(input, compareStr) {
  const tokens = compareStr.split(/[^a-zA-Z0-9_-]+/);

  tokens.sort((a, b) => (b.length - a.length));
  tokens.forEach((elem) => {
    if (elem.length > 0) {
      input = input.replace(
        new RegExp(`(^|\\W)(${elem})($|\\W)`, 'gi'),
        (match, prefix, token, suffix) => `${prefix}<strong>${token}</strong>${suffix}`
      );
    }
  });
  return input;
};
