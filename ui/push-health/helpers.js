export const taskResultColorMap = {
  success: 'success',
  testfailed: 'danger',
  busted: 'danger',
  unknown: 'darker-secondary',
};

export const filterTests = (tests, searchStr) => {
  const filters = searchStr.split(' ').map((filter) => new RegExp(filter, 'i'));

  return tests.filter((test) =>
    filters.every((f) =>
      f.test(`${test.testName} ${test.platform} ${test.config}`),
    ),
  );
};

export const myPushesDefaultMessage =
  'Log in or use the author query string to see pushes';

export const filterUnstructuredFailures = (unstructuredFailures, searchStr) => {
  const filters = searchStr.split(' ').map((filter) => new RegExp(filter, 'i'));

  return unstructuredFailures.filter((test) =>
    filters.every((f) => f.test(`${test.platform} ${test.config}`)),
  );
};
