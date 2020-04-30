export const thTitleSuffixLimit = 70;

export const parseAuthor = function parseAuthor(author) {
  const userTokens = author.split(/[<>]+/);
  const name = userTokens[0]
    .trim()
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1));
  const email = userTokens.length > 1 ? userTokens[1] : '';
  return { name, email };
};

export const isSHAorCommit = function isSHAorCommit(str) {
  return /^[a-f\d]{12,40}$/.test(str) || str.includes('hg.mozilla.org');
};

export const getRevisionTitle = function getRevisionTitle(revisions) {
  let title;
  for (const revision of revisions) {
    title = revision.comments;
    /*
     *  Strip out unwanted things like additional lines, trychooser
     *  syntax, request flags, mq cruft, whitespace, and punctuation
     */
    // eslint-disable-next-line prefer-destructuring
    title = title.split('\n')[0];
    title = title.replace(/\btry: .*/, '');
    title = title.replace(/\b(r|sr|f|a)=.*/, '');
    title = title.replace(/(imported patch|\[mq\]:) /, '');
    title = title.replace(/[;,\-. ]+$/, '').trim();
    if (title) {
      if (title.length > thTitleSuffixLimit) {
        title = `${title.substr(0, thTitleSuffixLimit - 3)}...`;
      }
      break;
    }
  }
  return title;
};
