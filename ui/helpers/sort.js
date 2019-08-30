// eslint-disable-next-line import/prefer-default-export
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

// This is a helper function for sorting an array of hashes:
// arr.sort(sortHashes(key, dataType, desc))
export const sortHashes = (key, dataType, desc) => {
  return (a, b) => {
    let result = 0;
    let item1 = desc ? b[key] : a[key];
    let item2 = desc ? a[key] : b[key];
    // If a[key] or b[key] doesn't exist, they are skipped by the sorting
    // so they need to be initialized with a default value
    if (dataType === 'number') {
      if (Number.isNaN(item1)) item1 = 0;
      if (Number.isNaN(item2)) item2 = 0;
      result = item1 - item2;
    } else if (dataType === 'array') {
      if (!Array.isArray(item1)) item1 = [];
      if (!Array.isArray(item2)) item2 = [];
      result = item1.length - item2.length;
    } else {
      if (typeof item1 !== 'string') item1 = '';
      if (typeof item2 !== 'string') item2 = '';
      if (item1 < item2) result = -1;
      if (item1 > item2) result = 1;
    }
    return result;
  };
};