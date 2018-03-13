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

export const highlightCommonTerms = function highlightCommonTerms(matchText, items) {
  const compareStr = items.filter(x => (x)).join(" ");
  const tokens = compareStr.split(/[^a-zA-Z0-9_-]+/);
  tokens.sort(function (a, b) {
    return b.length - a.length;
  });

  tokens.forEach((elem) => {
    if (elem.length > 0) {
      matchText = matchText.replace(
        new RegExp("(^|\\W)(" + elem + ")($|\\W)", "gi"),
        (match, prefix, token, suffix) => `${prefix}<strong>${token}</strong>${suffix}`
      );
    }
  });
  return matchText;
};
