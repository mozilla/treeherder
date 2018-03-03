import moment from 'moment';

//be sure to wrap date arg in a moment()
export const ISODate = function formatISODate(date) {
  return date.format('YYYY-MM-DD');
};

export const prettyDate = function formatPrettyDate(date) {
  return moment(date).format('ddd MMM D, YYYY');
};

export const setDateRange = function setISODateRange(day, numDays) {
  const to = ISODate(day);
  const from = ISODate(day.subtract(numDays, 'days'));
  return { from, to };
};

export const formatBugs = function formatBugsForBugzilla(data) {
  let bugs = '';
  for (let i = 0; i < data.length; i++) {
    bugs += `${data[i].bug_id},`;
  }
  return bugs;
};

export const mergeData = function mergeDataFromTwoApis(data, bugs) {
  let dict = {};
  for (let i = 0; i < data.length; i++) {
    dict[data[i].bug_id] = data[i].bug_count;
  }

  for (let i = 0; i < bugs.length; i++) {
    let match = dict[bugs[i].id];
    if (match) {
      bugs[i].count = match;
    }
  }

  bugs.sort(function (a, b) {
    return b.count - a.count;
  });
  return bugs;
};

export const calculateMetrics = function calculateMetricsForGraphs(data) {
  const dateCounts = [];
  const dateTestRunCounts = [];
  const dateFreqs = [];
  let totalFailures = 0;
  let totalRuns = 0;

  for (let i = 0; i < data.length; i++) {
    let failures = data[i].failure_count;
    let testRuns = data[i].test_runs;
    let freq = (testRuns < 1 || failures < 1) ? 0 : Math.round(failures / testRuns);
    // metrics graphics only accepts JS Date objects
    let date = moment(data[i].date).toDate();

    totalFailures += failures;
    totalRuns += testRuns;
    dateCounts.push({ date, value: failures });
    dateTestRunCounts.push({ date, value: testRuns });
    dateFreqs.push({ date, value: freq });
  }
  return { graphOneData: dateFreqs, graphTwoData: [dateCounts, dateTestRunCounts], totalFailures, totalRuns };
};

export const updateQueryParams = function updateHistoryWithQueryParams(view, queryParams, history, location) {
  if (queryParams !== history.location.search) {
    history.replace(`${view}${queryParams}`);
    //we do this so the api's won't be called twice (location/history updates will trigger a lifecycle hook)
    location.search = queryParams;
  }
};
