export const tValueCareMin = 3; // Anything below this is "low" in confidence
export const tValueConfidence = 5; // Anything above this is "high" in confidence

// Backend server endpoints
export const endpoints = {
  alert: '/performance/alert/',
  alertSummary: '/performance/alertsummary/',
  frameworks: '/performance/framework/',
  issueTrackers: '/performance/issue-tracker/',
  summary: '/performance/summary/',
  validityDashboard: '/performance/validity-dashboard/',
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
export const unknownFrameworkMessage = 'unknown framework';

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
  ['dark-puce', '#4C3146'],
  ['orange', '#FFB851'],
  ['purple', '#921181'],
  ['fire-red', '#C92D2F'],
  ['cerulean', '#16BCDE'],
  ['blue-bell', '#464876'],
];

export const graphSymbols = [
  ['diamond', 'outline'],
  ['diamond', 'fill'],
  ['square', 'outline'],
  ['square', 'fill'],
  ['circle', 'outline'],
  ['circle', 'fill'],
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
