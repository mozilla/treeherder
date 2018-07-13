export const parseAuthor = function parseAuthor(author) {
  const userTokens = author.split(/[<>]+/);
  const name = userTokens[0].trim().replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1));
  const email = userTokens.length > 1 ? userTokens[1] : '';
  return { name, email };
};

export const isSHAorCommit = function isSHAorCommit(str) {
  return /^[a-f\d]{12,40}$/.test(str) || str.includes('hg.mozilla.org');
};
