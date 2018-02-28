export const parseAuthor = function parseAuthor(author) {
  const userTokens = author.split(/[<>]+/);
  const name = userTokens[0].trim().replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1));
  const email = userTokens.length > 1 ? userTokens[1] : '';
  return { name, email };
};

export const isSHA = (str) => {
  let code, i, len;
  // SHAs come in 12 and 40 character varieties
  if (str.length !== 12 && str.length !== 40) {
    return false;
  }
  // SHAs are a-f,0-9
  for (i = 0, len = str.length; i < len; i++) {
    code = str.charCodeAt(i);
    if (!(code > 47 && code < 58) && // numeric (0-9)
        !(code > 64 && code < 71) && // upper alpha (A-F)
        !(code > 96 && code < 103)) { // lower alpha (a-f)
      return false;
    }
  }
  return true;
};
