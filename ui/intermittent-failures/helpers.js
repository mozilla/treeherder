import moment from 'moment';
import { prettyErrorMessages } from './constants';

// be sure to wrap date arg in a moment()
export const ISODate = function formatISODate(date) {
  return date.format('YYYY-MM-DD');
};

export const prettyDate = function formatPrettyDate(date) {
  return moment(date).format('ddd MMM D, YYYY');
};

export const formatBugs = function formatBugsForBugzilla(data) {
  const bugs = [];
  for (let i = 0; i < data.length; i++) {
    bugs.push(`${data[i].bug_id}`);
  }

  return bugs;
};

export const mergeData = function mergeDataFromTwoApis(data, bugs) {
  const dict = {};
  for (let i = 0; i < data.length; i++) {
    dict[data[i].bug_id] = data[i].bug_count;
  }

  for (let i = 0; i < bugs.length; i++) {
    const match = dict[bugs[i].id];
    if (match) {
      bugs[i].count = match;
    }
  }

  bugs.sort((a, b) => b.count - a.count);
  return bugs;
};

export const calculateMetrics = function calculateMetricsForGraphs(data) {
  const dateCounts = [];
  const dateTestRunCounts = [];
  const dateFreqs = [];
  let totalFailures = 0;
  let totalRuns = 0;

  for (let i = 0; i < data.length; i++) {
    const failures = data[i].failure_count;
    const testRuns = data[i].test_runs;
    const freq = (testRuns < 1 || failures < 1) ? 0 : failures / testRuns;
    // metrics graphics only accepts JS Date objects
    const date = moment(data[i].date).toDate();

    totalFailures += failures;
    totalRuns += testRuns;
    dateCounts.push({ date, value: failures });
    dateTestRunCounts.push({ date, value: testRuns });
    dateFreqs.push({ date, value: freq });
  }
  return { graphOneData: dateFreqs, graphTwoData: [dateCounts, dateTestRunCounts], totalFailures, totalRuns };
};

export const updateQueryParams = function updateHistoryWithQueryParams(view, queryParams, history, location) {
    history.replace({ pathname: view, search: queryParams });
    // we do this so the api's won't be called twice (location/history updates will trigger a lifecycle hook)
    location.search = queryParams;
};

export const sortData = function sortData(data, sortBy, desc) {
  data.sort((a, b) => {
    const item1 = (desc ? b[sortBy] : a[sortBy]);
    const item2 = (desc ? a[sortBy] : b[sortBy]);

    if (item1 < item2) {
      return -1;
    }
    if (item1 > item2) {
      return 1;
    }
    return 0;
  });
  return data;
};

export const processErrorMessage = function processErrorMessage(errorMessage, status) {
  const messages = [];

  if (status === 503) {
    return [prettyErrorMessages.status503];
  }

  if (Object.keys(errorMessage).length > 0) {
    for (const [key, value] of Object.entries(errorMessage)) {
      if (prettyErrorMessages[key]) {
        messages.push(prettyErrorMessages[key]);
      } else {
        messages.push(`${key}: ${value}`);
      }
    }
  }
  return messages || [prettyErrorMessages.default];
};

export const validateQueryParams = function validateQueryParams(params, bugRequired = false) {
  const messages = [];
  const dateFormat = /\d{4}[-]\d{2}[-]\d{2}/;

  if (!params.tree) {
    messages.push(prettyErrorMessages.tree_ui);
  }
  if (!params.startday || params.startday.search(dateFormat) === -1) {
    messages.push(prettyErrorMessages.startday);
  }
  if (!params.endday || params.endday.search(dateFormat) === -1) {
    messages.push(prettyErrorMessages.endday);
  }
  if (bugRequired && (!params.bug || isNaN(params.bug))) {
    messages.push(prettyErrorMessages.bug_ui);
  }
  return messages;
};

export const getData = async function getData(url) {
  let failureStatus = null;
  const response = await fetch(url);

  if (!response.ok) {
    failureStatus = response.status;
  }

  if (response.headers.get('content-type') === 'text/html' && failureStatus) {
    return { data: { [failureStatus]: response.statusText }, failureStatus };
  }

  const data = await response.json();
  return { data, failureStatus };
};

export const tableRowStyling = function tableRowStyling(state, bug) {
  if (bug) {
    const style = { color: '#aaa' };

    if (bug.row.status === 'RESOLVED' || bug.row.status === 'VERIFIED') {
      style.textDecoration = 'line-through';
      return { style };
    }

    const disabledStrings = new RegExp('(disabled|annotated|marked)', 'i');
    if (disabledStrings.test(bug.row.whiteboard)) {
      return { style };
    }
  }
  return {};
};
