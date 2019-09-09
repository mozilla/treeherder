export const tValueCareMin = 3; // Anything below this is "low" in confidence
export const tValueConfidence = 5; // Anything above this is "high" in confidence

// Backend server endpoints
export const endpoints = {
  issueTrackers: '/performance/issue-tracker/',
  frameworks: '/performance/framework/',
  alertSummary: '/performance/alertsummary/',
  alert: '/performance/alert/',
};

export const noiseMetricTitle = 'noise metric';

export const filterText = {
  showImportant: 'Show only important changes',
  hideUncertain: 'Hide uncertain results',
  showNoise: 'Show only noise',
  hideUncomparable: 'Hide uncomparable results',
  inputPlaceholder: 'filter text e.g. linux tp5o',
};

export const selectorCardText = {
  invalidRevision: 'Invalid revision',
  invalidRevisionLength: 'Revision must be at least 40 characters',
  revisionPlaceHolder: 'select or enter a revision',
};

export const noDataFoundMessage = 'No Data Found';

export const summaryStatusMap = {
  all: -1,
  untriaged: 0,
  downstream: 1,
  // Reassigned is in the performance_alert_summary model but it isn't a valid status parameter
  // with get requests
  reassigned: 2,
  invalid: 3,
  improvement: 4,
  investigating: 5,
  wontfix: 6,
  fixed: 7,
  backedout: 8,
  confirming: 9,
};

export const alertStatusMap = {
  untriaged: 0,
  downstream: 1,
  reassigned: 2,
  invalid: 3,
  acknowledged: 4,
  confirming: 5,
};

export const graphColors = [
  ['scarlet', '#b81752'],
  ['turquoise', '#17a2b8'],
  ['green', '#19a572'],
  ['brown', '#b87e17'],
  ['darkorchid', '#9932cc'],
  ['blue', '#1752b8'],
];
