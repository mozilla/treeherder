export const calcPercentOf = function calcPercentOf(a, b) {
  return b ? (100 * a) / b : 0;
};

const analyzeSet = (jobs) => {
  let totalDurationAvg = 0;
  let failures = 0;
  let failureTotalRuntime = 0;
  jobs.forEach((job) => {
    totalDurationAvg += job.duration / jobs.length;
    if (job.result === 'testfailed') {
      failures++;
      failureTotalRuntime += job.duration;
    }
  });
  const failureAvgRunTime = failureTotalRuntime / failures;
  return {
    totalDurationAvg,
    failures,
    failureAvgRunTime,
  };
};

export const getCounterMap = function getCounterMap(
  jobName,
  originalData,
  newData,
) {
  const cmap = { isEmpty: false, jobName };

  if (!originalData && !newData) {
    cmap.isEmpty = true;
    return cmap;
  }

  if (originalData) {
    const orig = analyzeSet(originalData);
    cmap.originalValue = orig.totalDurationAvg;
    cmap.originalFailures = orig.failures;
    cmap.originalFailureAvgRunTime = orig.failureAvgRunTime;
  }

  if (newData) {
    const newd = analyzeSet(newData);
    cmap.newValue = newd.totalDurationAvg;
    cmap.newFailures = newd.failures;
    cmap.newFailureAvgRunTime = newd.failureAvgRunTime;
  }

  if (!originalData || !newData) {
    return cmap; // No comparison, just display for one side.
  }

  // Normally tests are "lower is better", can be over-ridden with a series option
  cmap.delta = cmap.newValue - cmap.originalValue;
  cmap.failureDelta = cmap.newFailures - cmap.originalFailures;
  cmap.failureRunTimeDelta =
    cmap.newFailureAvgRunTime - cmap.originalFailureAvgRunTime;
  cmap.deltaPercentage = calcPercentOf(cmap.delta, cmap.originalValue);
  cmap.failureDeltaPercentage = calcPercentOf(
    cmap.failureDelta,
    cmap.originalFailures,
  );
  cmap.failureRunTimeDeltaPercentage = calcPercentOf(
    cmap.failureRunTimeDelta,
    cmap.originalFailureAvgRunTime,
  );
  cmap.magnitude = Math.min(Math.abs(cmap.deltaPercentage), 100);
  cmap.failureDeltaMagnitude = Math.min(
    Math.abs(cmap.failureDeltaPercentage),
    100,
  );
  cmap.failureRuntimeMagnitude = Math.min(
    Math.abs(cmap.failureRunTimeDeltaPercentage),
    100,
  );

  return cmap;
};
