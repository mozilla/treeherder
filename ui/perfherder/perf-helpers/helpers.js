import moment from 'moment';
import numeral from 'numeral';
import queryString from 'query-string';

import { getApiUrl, getJobsUrl } from '../../helpers/url';
import { update, processResponse } from '../../helpers/http';
import PerfSeriesModel, {
  getSeriesName,
  getTestName,
} from '../../models/perfSeries';
import RepositoryModel from '../../models/repository';
import JobModel from '../../models/job';
import { sxsTaskName } from '../../helpers/constants';

import {
  endpoints,
  tValueCareMin,
  tValueConfidence,
  noiseMetricTitle,
  availablePlatforms,
  summaryStatusMap,
  alertStatusMap,
  phFrameworksWithRelatedBranches,
  phTimeRanges,
  phDefaultTimeRangeValue,
  unknownFrameworkMessage,
  permaLinkPrefix,
} from './constants';

const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

export const formatNumber = (input) => numberFormat.format(input);

export const abbreviatedNumber = (num) =>
  num.toString().length <= 5 ? num : numeral(num).format('0.0a');

export const displayNumber = (input) =>
  Number.isNaN(input) ? 'N/A' : Number(input).toFixed(2);

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
    values.map((v) => (v - avg) ** 2).reduce((a, b) => a + b) /
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
  stddevDefaultFactor,
) {
  const lenC = valuesC.length;
  const lenT = valuesT.length;

  if (!lenC || !lenT) {
    return 0;
  }

  const avgC = calcAverage(valuesC);
  const avgT = calcAverage(valuesT);
  let stddevC =
    lenC > 1 ? getStdDev(valuesC, avgC) : stddevDefaultFactor * avgC;
  let stddevT =
    lenT > 1 ? getStdDev(valuesT, avgT) : stddevDefaultFactor * avgT;

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

  if (testName === noiseMetricTitle) {
    average = Math.sqrt(values.map((x) => x ** 2).reduce((a, b) => a + b, 0));
  } else {
    average = calcAverage(values);
    stddev = getStdDev(values, average);
  }

  return {
    average,
    stddev,
    stddevPct: Math.round(calcPercentOf(stddev, average) * 100) / 100,

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
    return newIsBetter ? '' : 'warning';
  }

  return newIsBetter ? 'success' : 'danger';
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
  const cmap = { isEmpty: false };
  const hasOrig = originalData && originalData.values.length;
  const hasNew = newData && newData.values.length;

  if (!hasOrig && !hasNew) {
    cmap.isEmpty = true;
    return cmap;
  }

  cmap.originalRetriggerableJobId = null;
  cmap.newRetriggerableJobId = null;

  if (hasOrig) {
    const orig = analyzeSet(originalData.values, testName);
    cmap.originalValue = orig.average;
    cmap.originalRuns = orig.runs;
    cmap.originalStddev = orig.stddev;
    cmap.originalStddevPct = orig.stddevPct;

    cmap.originalRepoName = originalData.repository_name;
    if (originalData.job_ids && originalData.job_ids.length) {
      [cmap.originalRetriggerableJobId] = originalData.job_ids;
    }
  } else {
    cmap.originalRuns = [];
  }

  if (hasNew) {
    const newd = analyzeSet(newData.values, testName);
    cmap.newValue = newd.average;
    cmap.newRuns = newd.runs;
    cmap.newStddev = newd.stddev;
    cmap.newStddevPct = newd.stddevPct;

    cmap.newRepoName = newData.repository_name;
    if (newData.job_ids && newData.job_ids.length) {
      [cmap.newRetriggerableJobId] = newData.job_ids;
    }
  } else {
    cmap.newRuns = [];
  }

  if (!hasOrig || !hasNew) {
    return cmap; // No comparison, just display for one side.
  }

  cmap.frameworkId = originalData.framework_id;
  // Normally tests are "lower is better", can be over-ridden with a series option
  cmap.delta = cmap.newValue - cmap.originalValue;

  cmap.newIsBetter =
    (originalData.lower_is_better && cmap.delta < 0) ||
    (!originalData.lower_is_better && cmap.delta > 0);

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
  cmap.isRegression = cmap.className === 'danger';
  cmap.isImprovement = cmap.className === 'success';
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

// TODO change usage of signature_hash to signature.id
export const getGraphsLink = function getGraphsLink(
  seriesList,
  resultSets,
  timeRange,
) {
  const params = {
    series: seriesList.map((series) => [
      series.projectName,
      series.signature,
      1,
      series.frameworkId,
    ]),
    highlightedRevisions: resultSets.map((resultSet) =>
      resultSet.revision.slice(0, 12),
    ),
  };

  if (resultSets && !timeRange) {
    params.timerange = Math.max(
      ...resultSets.map((resultSet) =>
        phTimeRanges
          .map((range) => range.value)
          .find((t) => Date.now() / 1000.0 - resultSet.push_timestamp < t),
      ),
    );
  }

  if (timeRange) {
    params.timerange = timeRange;
  }

  return `./graphs?${queryString.stringify(params)}`;
};

export const createNoiseMetric = function createNoiseMetric(
  cmap,
  name,
  compareResults,
) {
  cmap.name = name;
  cmap.isNoiseMetric = true;

  if (compareResults.has(noiseMetricTitle)) {
    compareResults.get(noiseMetricTitle).push(cmap);
  } else {
    compareResults.set(noiseMetricTitle, [cmap]);
  }
  return compareResults;
};

export const createGraphsLinks = (
  validatedProps,
  links,
  framework,
  timeRange,
  signature,
  app,
) => {
  const {
    originalProject,
    newProject,
    originalRevision,
    newResultSet,
    originalResultSet,
  } = validatedProps;

  const graphsParams = [...new Set([originalProject, newProject])].map(
    (projectName) => ({
      projectName,
      signature,
      frameworkId: framework.id,
      application: app,
    }),
  );

  let graphsLink;
  if (originalRevision) {
    graphsLink = getGraphsLink(graphsParams, [originalResultSet, newResultSet]);
  } else {
    graphsLink = getGraphsLink(graphsParams, [newResultSet], timeRange.value);
  }

  links.push({
    title: 'graph',
    to: graphsLink,
  });

  return links;
};

export const getSideBySideLink = (
  repository,
  baseRevision,
  newRevision,
  platform,
  testName,
) => {
  const revisions = `${baseRevision.slice(0, 12)} ${newRevision.slice(0, 12)}`;

  const jobUrl = getJobsUrl({
    repo: repository,
    tochange: newRevision,
    fromchange: baseRevision,
    searchStr: `${platform} ${testName} ${revisions} ${sxsTaskName}`,
    group_state: 'expanded',
  });

  return jobUrl;
};

// TODO change usage of signature_hash to signature.id
// for originalSignature and newSignature query params
const Alert = (alertData, optionCollectionMap) => ({
  ...alertData,
  title: getSeriesName(alertData.series_signature, optionCollectionMap, {
    includePlatformInName: true,
  }),
});

export const getTimeRange = (alertSummary) => {
  const defaultTimeRange =
    alertSummary.repository === 'mozilla-beta'
      ? 7776000
      : phDefaultTimeRangeValue;
  const timeRange = Math.max(
    defaultTimeRange,
    phTimeRanges
      .map((time) => time.value)
      .find(
        (value) => Date.now() / 1000.0 - alertSummary.push_timestamp <= value,
      ),
  );
  // default value of one year, for one a push_timestamp exceeds the one year value slightly
  return timeRange || 31536000;
};

// TODO change usage of signature_hash to signature.id
export const getGraphsURL = (
  alert,
  timeRange,
  alertRepository,
  performanceFrameworkId,
) => {
  let url = `./graphs?timerange=${timeRange}&series=${alertRepository},${alert.series_signature.id},1,${alert.series_signature.framework_id}`;

  // automatically add related branches (we take advantage of
  // the otherwise rather useless signature hash to avoid having to fetch this
  // information from the server)
  if (phFrameworksWithRelatedBranches.includes(performanceFrameworkId)) {
    const branches = alertRepository === 'mozilla-beta' ? ['autoland'] : [];
    url += branches
      .map(
        (branch) =>
          `&series=${branch},${alert.series_signature.signature_hash},1,${alert.series_signature.framework_id}`,
      )
      .join('');
  }

  return url;
};

export const modifyAlert = (alert, modification) =>
  update(getApiUrl(`${endpoints.alert}${alert.id}/`), modification);

export const modifyAlertSummary = (alertSummaryId) => {
  update(getApiUrl(`${endpoints.alertSummary}${alertSummaryId}/`));
};

export const getInitializedAlerts = (alertSummary, optionCollectionMap) =>
  // this function converts the representation returned by the perfherder
  // api into a representation more suited for display in the UI

  // just treat related (reassigned or downstream) alerts as one
  // big block -- we'll display in the UI depending on their content
  alertSummary.alerts
    .concat(alertSummary.related_alerts)
    .map((alertData) => Alert(alertData, optionCollectionMap));

export const addResultsLink = (taskId) => {
  const taskLink =
    'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/';
  const resultsPath =
    '/runs/0/artifacts/public/test_info/browsertime-results.tgz';
  return `${taskLink}${taskId}${resultsPath}`;
};

export const getFrameworkName = (frameworks, frameworkId) => {
  const framework = frameworks.find((item) => item.id === frameworkId);
  return framework ? framework.name : unknownFrameworkMessage;
};

const getPlatformInfo = (platforms) => {
  const platformInfo = [];
  platforms.forEach((platform) =>
    availablePlatforms.forEach((name) => {
      if (platform.includes(name.toLowerCase())) {
        if (!platformInfo.includes(name)) {
          platformInfo.push(name);
        }
      }
    }),
  );
  return platformInfo;
};

export const getFilledBugSummary = (alertSummary) => {
  let filledBugSummary;
  let maxMagnitudeAlert;
  let minMagnitudeAlert;

  // we should never include downstream alerts in the description
  let alertsInSummary = alertSummary.alerts.filter(
    (alert) =>
      alert.status !== alertStatusMap.downstream ||
      alert.summary_id === alertSummary.id,
  );

  // figure out if there are any regressions -- if there are,
  // the summary should only incorporate those. if there
  // aren't, then use all of them (that aren't downstream,
  // see above)
  const regressions = alertsInSummary.filter((alert) => alert.is_regression);
  if (regressions.length > 0) {
    alertsInSummary = regressions;
  }

  // reassigned and invalid alerts are excluded
  alertsInSummary = [
    ...new Set(
      alertsInSummary.filter(
        (alert) =>
          (alert.related_summary_id === alertSummary.id ||
            alert.related_summary_id === null) &&
          alert.status !== alertStatusMap.invalid,
      ),
    ),
  ];

  if (alertsInSummary.length > 1) {
    const maxMagnitude = Math.max(
      ...alertsInSummary.map((alert) => alert.amount_pct),
    );
    const minMagnitude = Math.min(
      ...alertsInSummary.map((alert) => alert.amount_pct),
    );
    maxMagnitudeAlert = alertsInSummary.find(
      (alert) => alert.amount_pct === maxMagnitude,
    );
    minMagnitudeAlert = alertsInSummary.find(
      (alert) => alert.amount_pct === minMagnitude,
    );
    filledBugSummary = `${maxMagnitude} - ${minMagnitude}%`;
  } else if (alertsInSummary.length === 1) {
    filledBugSummary = `${alertsInSummary[0].amount_pct}%`;
  } else {
    filledBugSummary = 'Empty alert';
  }

  // add test info
  let testInfo = `${getTestName(alertsInSummary[0].series_signature)}`;
  if (maxMagnitudeAlert && minMagnitudeAlert) {
    testInfo = `${getTestName(
      maxMagnitudeAlert.series_signature,
    )} / ${getTestName(minMagnitudeAlert.series_signature)}`;
  }
  if (alertsInSummary.length > 2) {
    testInfo += ` + ${alertsInSummary.length - 2} more`;
  }
  filledBugSummary += ` ${testInfo}`;

  // add platform info
  const platforms = [
    ...new Set(
      alertsInSummary.map((alert) => alert.series_signature.machine_platform),
    ),
  ];
  const platformInfo = getPlatformInfo(platforms).sort().join(', ');
  filledBugSummary += ` (${platformInfo})`;

  // add push date info
  const pushDate = moment(alertSummary.push_timestamp * 1000).format(
    'ddd MMMM D YYYY',
  );
  filledBugSummary += ` regression on ${pushDate}`;

  return filledBugSummary;
};

export const getTitle = (alertSummary) => {
  let title;

  // we should never include downstream alerts in the description
  let alertsInSummary = alertSummary.alerts.filter(
    (alert) =>
      alert.status !== alertStatusMap.downstream ||
      alert.summary_id === alertSummary.id,
  );

  // figure out if there are any regressions -- if there are,
  // the summary should only incorporate those. if there
  // aren't, then use all of them (that aren't downstream,
  // see above)
  const regressions = alertsInSummary.filter((alert) => alert.is_regression);
  if (regressions.length > 0) {
    alertsInSummary = regressions;
  }

  if (alertsInSummary.length > 1) {
    title = `${Math.min(
      ...alertsInSummary.map((alert) => alert.amount_pct),
    )} - ${Math.max(...alertsInSummary.map((alert) => alert.amount_pct))}%`;
  } else if (alertsInSummary.length === 1) {
    title = `${alertsInSummary[0].amount_pct}%`;
  } else {
    title = 'Empty alert';
  }

  // add test info
  const testInfo = [
    ...new Set(alertsInSummary.map((a) => getTestName(a.series_signature))),
  ]
    .sort()
    .join(' / ');
  title += ` ${testInfo}`;
  // add platform info
  const platformInfo = [
    ...new Set(alertsInSummary.map((a) => a.series_signature.machine_platform)),
  ]
    .sort()
    .join(', ');
  title += ` (${platformInfo})`;
  return title;
};

export const updateAlertSummary = async (alertSummaryId, params) =>
  update(getApiUrl(`${endpoints.alertSummary}${alertSummaryId}/`), params);

export const convertParams = (params, value) =>
  Boolean(params[value] !== undefined && parseInt(params[value], 10));

export const getFrameworkData = (props) => {
  const { validated, frameworks } = props;

  if (validated.framework) {
    const frameworkObject = frameworks.find(
      (item) => item.id === parseInt(validated.framework, 10),
    );
    return frameworkObject;
  }
  return { id: 1, name: 'talos' };
};

export const getStatus = (statusNum, statusMap = summaryStatusMap) => {
  const status = Object.entries(statusMap).find(
    (item) => statusNum === item[1],
  );
  return status[0];
};

export const containsText = (string, text) => {
  const words = text
    .split(' ')
    .map((word) => `(?=.*${word})`)
    .join('');
  const regex = RegExp(words, 'gi');
  return regex.test(string);
};

export const processSelectedParam = (tooltipArray) => ({
  signature_id: parseInt(tooltipArray[0], 10),
  dataPointId: parseInt(tooltipArray[1], 10),
});

export const getInitialData = async (
  errorMessages,
  repositoryName,
  framework,
  timeRange,
) => {
  const params = { interval: timeRange.value, framework: framework.id };
  const platforms = await PerfSeriesModel.getPlatformList(
    repositoryName.name,
    params,
  );

  const updates = {
    ...processResponse(platforms, 'platforms', errorMessages),
  };
  return updates;
};

export const updateSeriesData = (origSeriesData, testData) =>
  origSeriesData.filter(
    (item) =>
      testData.findIndex((test) => item.id === test.signature_id) === -1,
  );

export const getSeriesData = async (
  params,
  errorMessages,
  repositoryName,
  testData,
) => {
  let updates = {
    filteredData: [],
    relatedTests: [],
    showNoRelatedTests: false,
    loading: false,
  };
  const response = await PerfSeriesModel.getSeriesList(
    repositoryName.name,
    params,
  );
  updates = {
    ...updates,
    ...processResponse(response, 'origSeriesData', errorMessages),
  };

  if (updates.origSeriesData) {
    updates.seriesData = updateSeriesData(updates.origSeriesData, testData);
  }

  return updates;
};

export const scrollWithOffset = function scrollWithOffset(el) {
  // solution from https://github.com/rafrex/react-router-hash-link/issues/25#issuecomment-536688104

  const yCoordinate = el.getBoundingClientRect().top + window.pageYOffset;
  const yOffset = -35;
  window.scrollTo({ top: yCoordinate + yOffset, behavior: 'smooth' });
};

export const onPermalinkClick = (hashBasedValue, history, element) => {
  scrollWithOffset(element);
  history.replace(
    `${history.location.pathname}${history.location.search}#${hashBasedValue}`,
  );
};

// human readable signature name
const getSignatureName = (testName, platformName) =>
  [testName, platformName].filter((item) => item !== null).join(' ');

export const getHashBasedId = function getHashBasedId(
  testName,
  hashFunction,
  platformName = null,
) {
  const tableSection = platformName === null ? 'header' : 'row';
  const hashValue = hashFunction(getSignatureName(testName, platformName));

  return `${permaLinkPrefix}-${tableSection}-${hashValue}`;
};

const retriggerByRevision = async (
  jobId,
  currentRepo,
  isBaseline,
  times,
  props,
) => {
  const { isBaseAggregate, notify } = props;

  // do not retrigger if the base is aggregate (there is a selected time range)
  if (isBaseline && isBaseAggregate) {
    return;
  }

  if (jobId) {
    const job = await JobModel.get(currentRepo.name, jobId);
    JobModel.retrigger([job], currentRepo, notify, times);
  }
};

export const retriggerMultipleJobs = async (
  results,
  baseRetriggerTimes,
  newRetriggerTimes,
  props,
) => {
  // retrigger base revision jobs
  const { projects } = props;

  retriggerByRevision(
    results.originalRetriggerableJobId,
    RepositoryModel.getRepo(results.originalRepoName, projects),
    true,
    baseRetriggerTimes,
    props,
  );
  // retrigger new revision jobs
  retriggerByRevision(
    results.newRetriggerableJobId,
    RepositoryModel.getRepo(results.newRepoName, projects),
    false,
    newRetriggerTimes,
    props,
  );
};

export const reduceDictToKeys = function reduceDictToKeys(dict, keys) {
  const keysToKeep = keys || dict.keys();
  if (!dict) {
    return false;
  }

  const reducedDict = {};
  Object.entries(dict).forEach(([key, value]) => {
    if (keysToKeep.includes(key)) {
      reducedDict[key] = value;
    }
  });

  return reducedDict;
};

export const createGraphData = (
  seriesData,
  alertSummaries,
  colors,
  symbols,
  commonAlerts,
  replicates,
) =>
  seriesData.map((series) => {
    const color = colors.pop();
    const symbol = symbols.pop();
    // signature_id, framework_id and repository_name are
    // not renamed in camel case in order to match the fields
    // returned by the performance/summary API (since we only fetch
    // new data if a user adds additional tests to the graph)
    return {
      color: color || ['border-secondary', ''],
      symbol: symbol || ['circle', 'outline'],
      visible: Boolean(color),
      name: series.name,
      suite: series.suite,
      signature_id: series.signature_id,
      signatureHash: series.signature_hash,
      framework_id: series.framework_id,
      platform: series.platform,
      repository_name: series.repository_name,
      projectId: series.repository_id,
      id: `${series.repository_name} ${series.name}`,
      data: series.data.map((dataPoint) => ({
        // Backend implicitly provides all dates as UTC.
        // Let's make this explicit, so frontend doesn't get confused.
        retrigger_time: new Date(`${dataPoint.submit_time}Z`),
        x: new Date(`${dataPoint.push_timestamp}Z`),
        y: dataPoint.value,
        z: color ? color[1] : '',
        _z: symbol || ['circle', 'outline'],
        revision: dataPoint.revision,
        alertSummary: alertSummaries.find(
          (item) => item.push_id === dataPoint.push_id,
        ),
        commonAlert: reduceDictToKeys(
          commonAlerts[0].find((alert) => alert.push_id === dataPoint.push_id),
          ['id', 'status'],
        ),
        signature_id: series.signature_id,
        pushId: dataPoint.push_id,
        jobId: dataPoint.job_id,
        dataPointId: dataPoint.id,
        application: series.application,
      })),
      application: series.application,
      measurementUnit: series.measurement_unit || '',
      lowerIsBetter: series.lower_is_better,
      resultSetData: series.data.map((dataPoint) => dataPoint.push_id),
      parentSignature: series.parent_signature,
      shouldAlert: series.should_alert,
      alertChangeType: series.alert_change_type,
      alertThreshold: series.alert_threshold,
      replicates,
    };
  });

/**
 * This function will create a new Map object that holds keys composed by name and platform.
 *
 * @param {Array} results - The full list of signatures for a specific revision, framework and repo.
 */
export const getResultsMap = (results) => {
  const resultsMap = new Map();
  const testNames = [];
  const names = [];
  const platforms = [];
  results.forEach((item) => {
    testNames.push(item.test);
    names.push(item.name);
    platforms.push(item.platform);
    const key = `${item.name} ${item.platform}`;
    if (
      !resultsMap.has(key) ||
      (resultsMap.has(key) && item.values.length !== 0)
    ) {
      resultsMap.set(key, item);
    }
    if (item.test !== '' && !resultsMap.has(item.test)) {
      resultsMap.set(item.test, item);
    }
  });
  return { testNames, names, platforms, resultsMap };
};
