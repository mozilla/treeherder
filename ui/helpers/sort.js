export const sortAlphaNum = (a, b) => {
  // Implement a better alphanumeric sort so that mochitest-10
  // is sorted after mochitest 9, not mochitest-1
  const reA = /[^a-zA-Z]/g;
  const reN = /[^0-9]/g;
  if (a.name) {
    a = a.name;
    b = b.name;
  }
  const aA = a.replace(reA, '');
  const bA = b.replace(reA, '');
  if (aA === bA) {
    const aN = parseInt(a.replace(reN, ''), 10);
    const bN = parseInt(b.replace(reN, ''), 10);
    let rv;
    if (aN === bN) {
      rv = 0;
    } else if (aN > bN) {
      rv = 1;
    } else {
      rv = -1;
    }
    return rv;
  }
};
