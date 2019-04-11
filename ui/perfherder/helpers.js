import numeral from 'numeral';
import sortBy from 'lodash/sortBy';

import { getApiUrl, createQueryParams } from '../helpers/url';
import { create, getData, update } from '../helpers/http';
import { getSeriesName, getTestName } from '../models/perfSeries';
import OptionCollectionModel from '../models/optionCollection';
import {
  phAlertStatusMap,
  phAlertSummaryStatusMap,
  phFrameworksWithRelatedBranches,
  phTimeRanges,
  thPerformanceBranches,
} from '../helpers/constants';

import {
  endpoints,
  tValueCareMin,
  tValueConfidence,
  noiseMetricTitle,
  alertSummaryStatus,
} from './constants';

export const displayNumber = input =>
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

  if (testName === noiseMetricTitle) {
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

// TODO look into using signature_id instead of the hash
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
) => {
  const {
    originalProject,
    newProject,
    originalRevision,
    newResultSet,
    originalResultSet,
  } = validatedProps;

  const graphsParams = [...new Set([originalProject, newProject])].map(
    projectName => ({
      projectName,
      signature,
      frameworkId: framework.id,
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
    href: graphsLink,
  });

  return links;
};

// old PhAlerts' inner workings
// TODO change all usage of signature_hash to signature.id
// for originalSignature and newSignature query params
const Alert = (alertData, optionCollectionMap) => ({
  ...alertData,
  title: getSeriesName(alertData.series_signature, optionCollectionMap, {
    includePlatformInName: true,
  }),
});
// TODO move into graphs component or remove
export const getAlertStatusText = alert =>
  Object.values(phAlertStatusMap).find(status => status.id === alert.status)
    .text;

// TODO look into using signature_id instead of the hash
export const getGraphsURL = (
  alert,
  timeRange,
  alertRepository,
  performanceFrameworkId,
) => {
  let url = `#/graphs?timerange=${timeRange}&series=${alertRepository},${
    alert.series_signature.id
  },1`;

  // automatically add related branches (we take advantage of
  // the otherwise rather useless signature hash to avoid having to fetch this
  // information from the server)
  if (phFrameworksWithRelatedBranches.includes(performanceFrameworkId)) {
    const branches =
      alertRepository === 'mozilla-beta'
        ? ['mozilla-inbound']
        : thPerformanceBranches.filter(branch => branch !== alertRepository);
    url += branches
      .map(
        branch =>
          `&series=${branch},${alert.series_signature.signature_hash},0`,
      )
      .join('');
  }

  return url;
};
// TODO remove
export const getSubtestsURL = (alert, alertSummary) => {
  const urlParameters = {
    framework: alertSummary.framework,
    originalProject: alertSummary.repository,
    originalSignature: alert.series_signature.id,
    newProject: alertSummary.repository,
    newSignature: alert.series_signature.id,
    originalRevision: alertSummary.prev_push_revision,
    newRevision: alertSummary.revision,
  };

  return `#/comparesubtest${createQueryParams(urlParameters)}`;
};

const modifyAlert = (alert, modification) =>
  update(getApiUrl(`/performance/alert/${alert.id}/`), modification);

export const alertIsOfState = (alert, phAlertStatus) =>
  alert.status === phAlertStatus.id;

let issueTrackers; // will cache on first AlertSummary call

export const getInitializedAlerts = (alertSummary, optionCollectionMap) =>
  // this function converts the representation returned by the perfherder
  // api into a representation more suited for display in the UI

  // just treat related (reassigned or downstream) alerts as one
  // big block -- we'll display in the UI depending on their content
  alertSummary.alerts
    .concat(alertSummary.related_alerts)
    .map(alertData => Alert(alertData, optionCollectionMap));

// TODO remove
const constructAlertSummary = (
  alertSummaryData,
  optionCollectionMap,
  issueTrackers,
) => {
  const alertSummaryState = {
    ...alertSummaryData,
    issueTrackers,
    alerts: getInitializedAlerts(alertSummaryData, optionCollectionMap),
  };

  return alertSummaryState;
};

// TODO remove usage
export const AlertSummary = async (alertSummaryData, optionCollectionMap) => {
  if (issueTrackers === undefined) {
    return getData(getApiUrl(endpoints.issueTrackers)).then(
      ({ data: issueTrackerList }) => {
        issueTrackers = issueTrackerList;
        return constructAlertSummary(
          alertSummaryData,
          optionCollectionMap,
          issueTrackers,
        );
      },
    );
  }

  return constructAlertSummary(
    alertSummaryData,
    optionCollectionMap,
    issueTrackers,
  );
};
// TODO remove
export const getIssueTrackerUrl = alertSummary => {
  if (!alertSummary.bug_number) {
    return;
  }
  if (alertSummary.issue_tracker) {
    const { issueTrackerUrl } = alertSummary.issueTrackers.find(
      tracker => tracker.id === alertSummary.issue_tracker,
    );
    return issueTrackerUrl + alertSummary.bug_number;
  }
};

export const getTextualSummary = (alertSummary, copySummary) => {
  let resultStr = '';
  const improved = sortBy(
    alertSummary.alerts.filter(alert => !alert.is_regression && alert.visible),
    'amount_pct',
  ).reverse();
  const regressed = sortBy(
    alertSummary.alerts.filter(
      alert =>
        alert.is_regression &&
        alert.visible &&
        !alertIsOfState(alert, phAlertStatusMap.INVALID),
    ),
    'amount_pct',
  ).reverse();

  const getMaximumAlertLength = alertList =>
    Math.max(...alertList.map(alert => alert.title.length));

  const formatAlert = (alert, alertList) => {
    const numFormat = '0,0.00';

    const amountPct = alert.amount_pct.toFixed(0).padStart(3);
    const title = alert.title.padEnd(getMaximumAlertLength(alertList) + 5);
    const prevValue = numeral(alert.prev_value).format(numFormat);
    const newValue = numeral(alert.new_value).format(numFormat);

    return `${amountPct}%  ${title}${prevValue} -> ${newValue}`;
  };

  const formatAlertBulk = alerts =>
    alerts.map(alert => formatAlert(alert, alerts)).join('\n');

  // add summary header if getting text for clipboard only
  if (copySummary) {
    const created = new Date(alertSummary.created);
    resultStr += `== Change summary for alert #${
      alertSummary.id
    } (as of ${created.toUTCString()}) ==\n`;
  }
  if (regressed.length > 0) {
    // add a newline if we displayed the header
    if (copySummary) {
      resultStr += '\n';
    }
    const formattedRegressions = formatAlertBulk(regressed);
    resultStr += `Regressions:\n\n${formattedRegressions}\n`;
  }
  if (improved.length > 0) {
    // Add a newline if we displayed some regressions
    if (resultStr.length > 0) {
      resultStr += '\n';
    }
    const formattedImprovements = formatAlertBulk(improved);
    resultStr += `Improvements:\n\n${formattedImprovements}\n`;
  }
  // include link to alert if getting text for clipboard only
  if (copySummary) {
    const alertLink = `${window.location.origin}/perf.html#/alerts?id=${
      alertSummary.id
    }`;
    resultStr += `\nFor up to date results, see: ${alertLink}`;
  }
  return resultStr;
};

// TODO remove
export const refreshAlertSummary = alertSummary =>
  getData(getApiUrl(`${endpoints.alertSummary}${alertSummary.id}/`)).then(
    ({ data }) =>
      OptionCollectionModel.getMap().then(optionCollectionMap => {
        Object.assign(alertSummary, data);
        alertSummary.alerts = getInitializedAlerts(
          alertSummary,
          optionCollectionMap,
        );
      }),
  );

export const getTitle = alertSummary => {
  let title;

  // we should never include downstream alerts in the description
  let alertsInSummary = alertSummary.alerts.filter(
    alert =>
      alert.status !== phAlertStatusMap.DOWNSTREAM.id ||
      alert.summary_id === alertSummary.id,
  );

  // figure out if there are any regressions -- if there are,
  // the summary should only incorporate those. if there
  // aren't, then use all of them (that aren't downstream,
  // see above)
  const regressions = alertsInSummary.filter(alert => alert.is_regression);
  if (regressions.length > 0) {
    alertsInSummary = regressions;
  }

  if (alertsInSummary.length > 1) {
    title = `${Math.min(
      ...alertsInSummary.map(alert => alert.amount_pct),
    )} - ${Math.max(...alertsInSummary.map(alert => alert.amount_pct))}%`;
  } else if (alertsInSummary.length === 1) {
    title = `${alertsInSummary[0].amount_pct}%`;
  } else {
    title = 'Empty alert';
  }

  // add test info
  const testInfo = [
    ...new Set(alertsInSummary.map(a => getTestName(a.series_signature))),
  ]
    .sort()
    .join(' / ');
  title += ` ${testInfo}`;
  // add platform info
  const platformInfo = [
    ...new Set(alertsInSummary.map(a => a.series_signature.machine_platform)),
  ]
    .sort()
    .join(', ');
  title += ` (${platformInfo})`;
  return title;
};

export const modifySelectedAlerts = (alertSummary, modification) => {
  alertSummary.allSelected = false;

  return Promise.all(
    alertSummary.alerts
      .filter(alert => alert.selected)
      .map(selectedAlert => {
        selectedAlert.selected = false;
        return modifyAlert(selectedAlert, modification);
      }),
  );
};

export const getAlertSummaryStatusText = alertSummary =>
  Object.values(phAlertSummaryStatusMap).find(
    status => status.id === alertSummary.status,
  ).text;

export const getAlertSummary = id =>
  OptionCollectionModel.getMap().then(optionCollectionMap =>
    getData(getApiUrl(`${endpoints.alertSummary}${id}/`)).then(({ data }) =>
      AlertSummary(data, optionCollectionMap),
    ),
  );

export const getAlertSummaryTitle = id =>
  getAlertSummary(id).then(alertSummary => getTitle(alertSummary));

// TODO remove
export const getAlertSummaries = options => {
  let { href } = options;
  if (!options || !options.href) {
    href = getApiUrl(endpoints.alertSummary);

    // add filter parameters for status and framework
    const params = [];
    if (
      options &&
      options.statusFilter !== undefined &&
      options.statusFilter !== -1
    ) {
      params[params.length] = `status=${options.statusFilter}`;
    }
    if (options && options.frameworkFilter !== undefined) {
      params[params.length] = `framework=${options.frameworkFilter}`;
    }
    // TODO replace all usage with createQueryParams except for
    // signatureId and seriesSignature (used in graphs controller)
    if (options && options.signatureId !== undefined) {
      params[params.length] = `alerts__series_signature=${options.signatureId}`;
    }
    if (options && options.seriesSignature !== undefined) {
      params[params.length] = `alerts__series_signature__signature_hash=${
        options.seriesSignature
      }`;
    }
    if (options && options.repository !== undefined) {
      params[params.length] = `repository=${options.repository}`;
    }
    if (options && options.page !== undefined) {
      params[params.length] = `page=${options.page}`;
    }

    if (params.length) {
      href += `?${params.join('&')}`;
    }
  }

  return OptionCollectionModel.getMap().then(optionCollectionMap =>
    getData(href).then(({ data }) =>
      Promise.all(
        data.results.map(alertSummaryData =>
          AlertSummary(alertSummaryData, optionCollectionMap),
        ),
      ).then(alertSummaries => ({
        results: alertSummaries,
        next: data.next,
        count: data.count,
      })),
    ),
  );
};

export const createAlert = data =>
  create(getApiUrl(endpoints.alertSummary), {
    repository_id: data.project.id,
    framework_id: data.series.frameworkId,
    push_id: data.resultSetId,
    prev_push_id: data.prevResultSetId,
  })
    .then(response => response.json())
    .then(response => {
      const newAlertSummaryId = response.alert_summary_id;
      return create(getApiUrl('/performance/alert/'), {
        summary_id: newAlertSummaryId,
        signature_id: data.series.id,
      }).then(() => newAlertSummaryId);
    });

export const findPushIdNeighbours = (dataPoint, resultSetData, direction) => {
  const pushId = dataPoint.resultSetId;
  const pushIdIndex =
    direction === 'left'
      ? resultSetData.indexOf(pushId)
      : resultSetData.lastIndexOf(pushId);
  const relativePos = direction === 'left' ? -1 : 1;
  return {
    push_id: resultSetData[pushIdIndex + relativePos],
    prev_push_id: resultSetData[pushIdIndex + (relativePos - 1)],
  };
};

export const nudgeAlert = (dataPoint, towardsDataPoint) => {
  const alertId = dataPoint.alert.id;
  return update(getApiUrl(`/performance/alert/${alertId}/`), towardsDataPoint);
};

export const convertParams = (params, value) =>
  Boolean(params[value] !== undefined && parseInt(params[value], 10));

export const getFrameworkData = props => {
  const { framework, frameworks } = props;

  if (framework) {
    const frameworkObject = frameworks.find(
      item => item.id === parseInt(framework, 10),
    );
    return frameworkObject;
  }
  return { id: 1, name: 'talos' };
};

export const getStatus = status =>
  Object.entries(alertSummaryStatus).find(item => status === item[1])[0];
