export const taskResultColorMap = {
  success: 'success',
  testfailed: 'danger',
  busted: 'danger',
  unknown: 'darker-secondary',
};

export const filterTests = (tests, searchStr) => {
  const filters = searchStr
    .toLowerCase()
    .trim()
    .slice(0, 200)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 20);

  return tests.filter((test) => {
    const haystack = `${test.testName} ${test.platform} ${test.config}`.toLowerCase();
    return filters.every((filter) => haystack.includes(filter));
  });
};

export const myPushesDefaultMessage =
  'Log in or use the author query string to see pushes';
