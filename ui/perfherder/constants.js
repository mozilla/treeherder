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
  inputPlaceholder: 'linux tp5o',
};

export const noDataFoundMessage = 'No Data Found';

export const alertSummaryStatus = {
  // all is only added to statuses in alerts controller
  all: -1,
  untriaged: 0,
  downstream: 1,
  reassigned: 2,
  invalid: 3,
  improvement: 4,
  investigating: 5,
  wontfix: 6,
  fixed: 7,
  backedout: 8,
  confirming: 9,
};
