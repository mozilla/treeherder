import chunk from 'lodash/chunk';

import { getApiUrl, createQueryParams } from '../helpers/url';
import { getData } from '../helpers/http';
import PerfSeriesModel from '../models/perfSeries';
import { phTimeRanges } from '../helpers/constants';

import { tValueCareMin, tValueConfidence } from './constants';

export const calcPercentOf = function calcPercentOf(a, b) {
  return b ? (100 * a) / b : 0;
};

export const calcAverage = function calcAverage(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((a, b) => a + b, 0) / values.length;
};

export const getStdDev = function getStandardDeviation(values, avg) {
  if (values.length < 2) {
    return undefined;
  }

  if (!avg) avg = calcAverage(values);

  return Math.sqrt(
    values.map(v => (v - avg) ** 2).reduce((a, b) => a + b) /
      (values.length - 1),
  );
};

// If a set has only one value, assume average-ish-plus standard deviation, which
// will manifest as smaller t-value the less items there are at the group
// (so quite small for 1 value). This default value is a parameter.
// C/T mean control/test group (in our case original/new data).
export const getTTest = function getTTest(
  valuesC,
  valuesT,
  stddev_default_factor,
) {
  const lenC = valuesC.length;
  const lenT = valuesT.length;

  if (!lenC || !lenT) {
    return 0;
  }

  const avgC = calcAverage(valuesC);
  const avgT = calcAverage(valuesT);
  let stddevC =
    lenC > 1 ? getStdDev(valuesC, avgC) : stddev_default_factor * avgC;
  let stddevT =
    lenT > 1 ? getStdDev(valuesT, avgT) : stddev_default_factor * avgT;

  if (lenC === 1) {
    stddevC = (valuesC[0] * stddevT) / avgT;
  } else if (lenT === 1) {
    stddevT = (valuesT[0] * stddevC) / avgC;
  }

  const delta = avgT - avgC;
  const stdDiffErr = Math.sqrt(
    (stddevC * stddevC) / lenC + // control-variance / control-size
      (stddevT * stddevT) / lenT,
  );

  return delta / stdDiffErr;
};
// TODO many of these are only used in one controller so can likely be moved
// into the appropriate react component

const numericCompare = (a, b) => {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
};

const analyzeSet = (values, testName) => {
  let average;
  let stddev = 1;

  if (testName === 'Noise Metric') {
    average = Math.sqrt(values.map(x => x ** 2).reduce((a, b) => a + b, 0));
  } else {
    average = calcAverage(values);
    stddev = getStdDev(values, average);
  }

  return {
    average,
    stddev,
    stddevPct: Math.round(calcPercentOf(stddev, average) * 100) / 100,
    // TODO verify this is needed
    // We use slice to keep the original values at their original order
    // in case the order is important elsewhere.
    runs: values.slice().sort(numericCompare),
  };
};

const getClassName = (newIsBetter, oldVal, newVal, absTValue) => {
  // Returns a class name, if any, based on a relative change in the absolute value
  if (!oldVal || !newVal) {
    return '';
  }
  let ratio = newVal / oldVal;
  if (ratio < 1) {
    ratio = 1 / ratio; // Direction agnostic and always >= 1.
  }

  if (ratio < 1.02 || absTValue < tValueCareMin) {
    return '';
  }

  if (absTValue < tValueConfidence) {
    return newIsBetter ? '' : 'compare-notsure';
  }

  return newIsBetter ? 'compare-improvement' : 'compare-regression';
};

// Aggregates two sets of values into a "comparison object" which is later used
// to display a single line of comparison.
// The result object has the following properties:
// - .isEmpty: true if no data for either side.
// If !isEmpty, for originalData/newData (if the data exists)
// - .[original|new]Value      // Average of the values
// - .[original|new]Stddev     // stddev
// - .[original|new]StddevPct  // stddev as percentage of the average
// - .[original|new]Runs       // Display data: number of runs and their values
// If both originalData/newData exist, comparison data:
// - .newIsBetter              // is new result better or worse (even if unsure)
// - .isImprovement            // is new result better + we're confident about it
// - .isRegression             // is new result worse + we're confident about it
// - .delta
// - .deltaPercentage
// - .confidence               // t-test value
// - .confidenceText           // 'low'/'med'/'high'
// - .confidenceTextLong       // more explanation on what confidenceText means
// - .isMeaningful             // for highlighting - bool over t-test threshold
// And some data to help formatting of the comparison:
// - .className
// - .magnitude
// - .marginDirection

export const getCounterMap = function getCounterMap(
  testName,
  originalData,
  newData,
) {
  // TODO setting this value seems a bit odd, look into how its being used
  const cmap = { isEmpty: false };
  const hasOrig = originalData && originalData.values.length;
  const hasNew = newData && newData.values.length;

  if (!hasOrig && !hasNew) {
    cmap.isEmpty = true;
    return cmap;
  }

  if (hasOrig) {
    const orig = analyzeSet(originalData.values, testName);
    cmap.originalValue = orig.average;
    cmap.originalRuns = orig.runs;
    cmap.originalStddev = orig.stddev;
    cmap.originalStddevPct = orig.stddevPct;
  } else {
    cmap.originalRuns = [];
  }

  if (hasNew) {
    const newd = analyzeSet(newData.values, testName);
    cmap.newValue = newd.average;
    cmap.newRuns = newd.runs;
    cmap.newStddev = newd.stddev;
    cmap.newStddevPct = newd.stddevPct;
  } else {
    cmap.newRuns = [];
  }

  if (!hasOrig || !hasNew) {
    return cmap; // No comparison, just display for one side.
  }

  cmap.frameworkId = originalData.frameworkId;
  // Normally tests are "lower is better", can be over-ridden with a series option
  cmap.delta = cmap.newValue - cmap.originalValue;
  cmap.newIsBetter =
    (originalData.lowerIsBetter && cmap.delta < 0) ||
    (!originalData.lowerIsBetter && cmap.delta > 0);

  cmap.deltaPercentage = calcPercentOf(cmap.delta, cmap.originalValue);
  // arbitrary scale from 0-20% multiplied by 5, capped
  // at 100 (so 20% regression === 100% bad)
  cmap.magnitude = Math.min(Math.abs(cmap.deltaPercentage) * 5, 100);

  // 0.15 is used for getTTest: default stddev if both sets have only a single value - 15%.
  // Should be rare case and it's unreliable, but at least have something.
  const absTValue = Math.abs(
    getTTest(originalData.values, newData.values, 0.15),
  );
  cmap.className = getClassName(
    cmap.newIsBetter,
    cmap.originalValue,
    cmap.newValue,
    absTValue,
  );
  cmap.confidence = absTValue;
  cmap.confidenceTextLong =
    'Result of running t-test on base versus new result distribution: ';

  if (absTValue < tValueCareMin) {
    cmap.confidenceText = 'low';
    cmap.confidenceTextLong +=
      "A value of 'low' suggests less confidence that there is a sustained, significant change between the two revisions.";
  } else if (absTValue < tValueConfidence) {
    cmap.confidenceText = 'med';
    cmap.confidenceTextLong +=
      "A value of 'med' indicates uncertainty that there is a significant change. If you haven't already, consider retriggering the job to be more sure.";
  } else {
    cmap.confidenceText = 'high';
    cmap.confidenceTextLong +=
      "A value of 'high' indicates more confidence that there is a significant change, however you should check the historical record for the test by looking at the graph to be more sure (some noisy tests can provide inconsistent results).";
  }
  cmap.isRegression = cmap.className === 'compare-regression';
  cmap.isImprovement = cmap.className === 'compare-improvement';
  cmap.isMeaningful = cmap.className !== '';

  cmap.isComplete = cmap.originalRuns.length && cmap.newRuns.length;
  cmap.isConfident =
    (cmap.originalRuns.length > 1 &&
      cmap.newRuns.length > 1 &&
      absTValue >= tValueConfidence) ||
    (cmap.originalRuns.length >= 6 &&
      cmap.newRuns.length >= 6 &&
      absTValue >= tValueCareMin);
  cmap.needsMoreRuns =
    cmap.isComplete && !cmap.isConfident && cmap.originalRuns.length < 6;
  cmap.isNoiseMetric = false;

  return cmap;
};

// TODO: move into a react component as this is only used once (in PhCompare controller)
export const getInterval = function getInterval(oldTimestamp, newTimestamp) {
  const now = new Date().getTime() / 1000;
  let timeRange = Math.min(oldTimestamp, newTimestamp);
  timeRange = Math.round(now - timeRange);
  const newTimeRange = phTimeRanges.find(time => timeRange <= time.value);
  return newTimeRange.value;
};

// TODO possibly break up into different functions and/or move into a component
export const validateQueryParams = async function validateQueryParams(params) {
  const {
    originalProject,
    newProject,
    originalRevision,
    newRevision,
    originalSignature,
    newSignature,
  } = params;
  const errors = [];

  if (!originalProject) errors.push('Missing input: originalProject');
  if (!newProject) errors.push('Missing input: newProject');
  if (!originalRevision) errors.push('Missing input: originalRevision');
  if (!newRevision) errors.push('Missing input: newRevision');

  if (originalSignature && newSignature) {
    if (!originalSignature) errors.push('Missing input: originalSignature');
    if (!newSignature) errors.push('Missing input: newSignature');
  }

  const { data, failureStatus } = await getData(getApiUrl(repoEndpoint));

  if (
    !failureStatus &&
    data.find(project => project.name === originalProject)
  ) {
    errors.push(`Invalid project, doesn't exist ${originalProject}`);
  }

  if (!failureStatus && data.find(project => project.name === newProject)) {
    errors.push(`Invalid project, doesn't exist ${newProject}`);
  }

  return errors;
};

const getResultMapEntry = (datum, resultsMap, params) => {
  if (params.push_id) {
    if (!resultsMap[datum.push_id]) {
      resultsMap[datum.push_id] = {};
    }
    return resultsMap[datum.push_id];
  }
  return resultsMap;
};

export const getResultsMap = function getResultsMap(
  projectName,
  seriesList,
  params,
) {
  const resultsMap = {};

  return Promise.all(
    chunk(seriesList, 150).map(seriesChunk =>
      PerfSeriesModel.getSeriesData(projectName, {
        signature_id: seriesChunk.map(series => series.id),
        framework: [...new Set(seriesChunk.map(series => series.frameworkId))],
        ...params,
      }).then(seriesData => {
        // Aggregates data from a single group of values and returns an object containing
        // description (name/platform) and values; these are later processed in getCounterMap.
        for (const [signatureHash, data] of Object.entries(seriesData)) {
          const signature = seriesList.find(
            series => series.signature === signatureHash,
          );

          if (signature) {
            data.forEach(datum => {
              const entry = getResultMapEntry(datum, resultsMap, params);
              if (!entry[signatureHash]) {
                entry[signatureHash] = {
                  ...signature,
                  values: [datum.value],
                };
              } else {
                entry[signatureHash].values.push(datum.value);
              }
            });
          }
        }
      }),
    ),
  ).then(() => resultsMap);
};

export const getGraphsLink = function getGraphsLink(
  seriesList,
  resultSets,
  timeRange,
) {
  const params = {
    series: seriesList.map(series => [
      series.projectName,
      series.signature,
      1,
      series.frameworkId,
    ]),
    highlightedRevisions: resultSets.map(resultSet =>
      resultSet.revision.slice(0, 12),
    ),
  };

  if (resultSets && !timeRange) {
    params.timerange = Math.max(
      ...resultSets.map(resultSet =>
        phTimeRanges
          .map(range => range.value)
          .find(t => Date.now() / 1000.0 - resultSet.push_timestamp < t),
      ),
    );
  }

  if (timeRange) {
    params.timerange = timeRange;
  }

  return `perf.html#/graphs${createQueryParams(params)}`;
};
