export const parseAuthor = function parseAuthor(author) {
  const userTokens = author.split(/[<>]+/);
  const name = userTokens[0].trim().replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1));
  const email = userTokens.length > 1 ? userTokens[1] : '';
  return { name, email };
};

export default parseAuthor;
