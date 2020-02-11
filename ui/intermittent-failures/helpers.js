import moment from 'moment';

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
  const dateCounts = { color: 'blue', data: [] };
  const dateTestRunCounts = { color: 'green', data: [] };
  const dateFreqs = { color: '#dd6602', data: [] };
  let totalFailures = 0;
  let totalRuns = 0;

  for (let i = 0; i < data.length; i++) {
    const failures = data[i].failure_count;
    const testRuns = data[i].test_runs;
    const freq = testRuns < 1 || failures < 1 ? 0 : failures / testRuns;
    const date = moment(data[i].date).format('MMM DD');
    const dateObj = moment(data[i].date).toDate();

    totalFailures += failures;
    totalRuns += testRuns;
    dateCounts.data.push({
      date,
      failureCount: failures,
      x: dateObj,
      y: failures,
    });
    dateTestRunCounts.data.push({
      date,
      pushCount: testRuns,
      x: dateObj,
      y: testRuns,
    });
    dateFreqs.data.push({
      date,
      failurePerPush: freq.toFixed(2),
      x: dateObj,
      y: freq,
    });
  }

  return {
    graphOneData: [dateFreqs],
    graphTwoData: [dateCounts, dateTestRunCounts],
    totalFailures,
    totalRuns,
  };
};

export const sortData = function sortData(data, sortBy, desc) {
  data.sort((a, b) => {
    const item1 = desc ? b[sortBy] : a[sortBy];
    const item2 = desc ? a[sortBy] : b[sortBy];

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

export const validateQueryParams = function validateQueryParams(
  params,
  bugRequired = false,
) {
  const messages = [];
  const dateFormat = /\d{4}[-]\d{2}[-]\d{2}/;

  if (!params.tree) {
    messages.push(
      'tree is required and must be a valid repository or repository group.',
    );
  }
  if (!params.startday || params.startday.search(dateFormat) === -1) {
    messages.push('startday is required and must be in YYYY-MM-DD format.');
  }
  if (!params.endday || params.endday.search(dateFormat) === -1) {
    messages.push('endday is required and must be in YYYY-MM-DD format.');
  }
  if (bugRequired && (!params.bug || Number.isNaN(params.bug))) {
    messages.push('bug is required and must be a valid integer.');
  }
  return messages;
};

export const tableRowStyling = function tableRowStyling(state, bug) {
  if (bug) {
    const style = {
      color: 'rgb(117, 117, 117)',
      backgroundColor: 'rgba(0, 0, 0, 0.009)',
    };

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

export const removePath = (line = '') => line.replace(/\/?([\w\d-.]+\/)+/, '');
