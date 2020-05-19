export const calcPercentOf = function calcPercentOf(a, b) {
  return b ? (100 * a) / b : 0;
};

const analyzeSet = (jobs) => {
  let totalDurationAvg = 0;
  let failures = 0;
  jobs.forEach((job) => {
    totalDurationAvg += job.duration / jobs.length;
    if (job.result === 'testfailed') {
      failures++;
    }
  });
  return {
    totalDurationAvg,
    failures,
  };
};

export const getCounterMap = function getCounterMap(
  jobName,
  originalData,
  newData,
) {
  const cmap = { isEmpty: false };

  if ((!originalData && !newData) || jobName.indexOf('/') === -1) {
    cmap.isEmpty = true;
    return cmap;
  }
  const platform = jobName.slice(0, jobName.indexOf('/'));
  const suite = jobName.slice(jobName.indexOf('/'));
  cmap.platform = jobName.slice(0, jobName.indexOf('/'));
  cmap.suite = jobName.slice(jobName.indexOf('/') + 1);
  if (suite.indexOf('-') === -1) {
    cmap.platform = `${platform.slice(platform.indexOf('-') + 1)}${suite}`;
    cmap.suite = platform.slice(0, platform.indexOf('-'));
  } else {
    cmap.platform = `${platform.slice(platform.indexOf('-') + 1)}${suite.slice(
      0,
      suite.indexOf('-'),
    )}`;
    cmap.suite = suite.slice(suite.indexOf('-') + 1);
  }
  if (originalData) {
    const orig = analyzeSet(originalData);
    cmap.originalValue = Math.round(orig.totalDurationAvg);
    cmap.originalFailures = orig.failures;
    cmap.originalDataPoints = originalData.length;
  }

  if (newData) {
    const newd = analyzeSet(newData);
    cmap.newValue = Math.round(newd.totalDurationAvg);
    cmap.newFailures = newd.failures;
    cmap.newDataPoints = newData.length;
  }

  return cmap;
};
