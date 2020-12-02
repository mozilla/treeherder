import {
  faClock,
  faExclamationTriangle,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';

export const resultColorMap = {
  pass: 'success',
  fail: 'danger',
  indeterminate: 'secondary',
  done: 'darker-info',
  'in progress': 'secondary',
  none: 'darker-info',
  unknown: 'secondary',
};

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

export const getIcon = (result) => {
  switch (result) {
    case 'pass':
      return faCheck;
    case 'fail':
      return faExclamationTriangle;
  }
  return faClock;
};
