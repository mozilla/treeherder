export const calcPercentOf = function calcPercentOf(a, b) {
  return b ? (100 * a) / b : 0;
};

export const getHashBasedId = function getHashBasedId(
  suiteName,
  hashFunction,
  platformName,
) {
  const tableSection = platformName === null ? 'header' : 'row';
  const hashValue = hashFunction(`${suiteName}${platformName}`);

  return `table-${tableSection}-${hashValue}`;
};

export const containsText = (string, text) => {
  const words = text
    .split(' ')
    .map((word) => `(?=.*${word})`)
    .join('');
  const regex = RegExp(words, 'gi');
  return regex.test(string);
};

export const convertParams = (params, value) =>
  Boolean(params[value] !== undefined && parseInt(params[value], 10));

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

  if (!originalData || !newData) {
    return cmap; // No comparison, just display for one side.
  }
  cmap.delta = Math.abs(cmap.newValue - cmap.originalValue);
  cmap.deltaPercentage = calcPercentOf(cmap.delta, cmap.originalValue);
  cmap.isCertain = cmap.originalDataPoints > 4 && cmap.newDataPoints > 4;

  return cmap;
};
