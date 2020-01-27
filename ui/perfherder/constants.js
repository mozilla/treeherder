export const tValueCareMin = 3; // Anything below this is "low" in confidence
export const tValueConfidence = 5; // Anything above this is "high" in confidence

// Backend server endpoints
export const endpoints = {
  alert: '/performance/alert/',
  alertSummary: '/performance/alertsummary/',
  frameworks: '/performance/framework/',
  issueTrackers: '/performance/issue-tracker/',
  summary: '/performance/summary/',
};

export const noiseMetricTitle = 'noise metric';
export const backfillRetriggeredTitle =
  'This alert was retriggered by the backfill bot.';

export const filterText = {
  showImportant: 'Show only important changes',
  hideUncertain: 'Hide uncertain results',
  showNoise: 'Show only noise',
  hideUncomparable: 'Hide uncomparable results',
  inputPlaceholder: 'filter text e.g. linux tp5o',
};

export const legendCardText = {
  unknownFrameworkMessage: 'unknown framework',
};

export const selectorCardText = {
  invalidRevision: 'Invalid revision',
  invalidRevisionLength: 'Revision must be at least 40 characters',
  revisionPlaceHolder: 'select or enter a revision',
};

export const compareTableText = {
  retriggerButtonTitle: 'Retrigger jobs',
};

export const noResultsMessage = 'No results to show';
export const noDataFoundMessage = title => `No Data Found for ${title}`;

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
};

export const alertStatusMap = {
  untriaged: 0,
  downstream: 1,
  reassigned: 2,
  invalid: 3,
  acknowledged: 4,
};

export const graphColors = [
  ['scarlet', '#b81752'],
  ['turquoise', '#17a2b8'],
  ['green', '#19a572'],
  ['brown', '#b87e17'],
  ['darkorchid', '#9932cc'],
  ['blue', '#1752b8'],
];

export const phFrameworksWithRelatedBranches = [
  1, // talos
  10, // raptor
  11, // js-bench
  12, // devtools
];

export const phTimeRanges = [
  { value: 86400, text: 'Last day' },
  { value: 86400 * 2, text: 'Last 2 days' },
  { value: 604800, text: 'Last 7 days' },
  { value: 1209600, text: 'Last 14 days' },
  { value: 2592000, text: 'Last 30 days' },
  { value: 5184000, text: 'Last 60 days' },
  { value: 7776000, text: 'Last 90 days' },
  { value: 31536000, text: 'Last year' },
];

export const phDefaultTimeRangeValue = 1209600;

export const compareDefaultTimeRange = {
  value: 86400 * 2,
  text: 'Last 2 days',
};
