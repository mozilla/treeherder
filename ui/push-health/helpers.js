export const taskResultColorMap = {
  success: 'success',
  testfailed: 'danger',
  busted: 'danger',
  unknown: 'darker-secondary',
};

export const filterTests = (tests, searchStr, showParentMatches) => {
  const filters = searchStr.split(' ').map((filter) => new RegExp(filter, 'i'));
  const testsFilteredForParentMatches = tests.filter(
    (test) =>
      !test.failedInParent || (test.failedInParent && showParentMatches),
  );

  return testsFilteredForParentMatches.filter((test) =>
    filters.every((f) =>
      f.test(`${test.testName} ${test.platform} ${test.config}`),
    ),
  );
};

export const filterJobs = (jobs, showParentMatches) => {
  return jobs.filter((job) => job.failedInParent === showParentMatches);
};
