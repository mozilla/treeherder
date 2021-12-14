import {
  faHourglassStart,
  faHourglassHalf,
  faHourglassEnd,
} from '@fortawesome/free-solid-svg-icons';
import { faHourglass } from '@fortawesome/free-regular-svg-icons';

export const tValueCareMin = 3; // Anything below this is "low" in confidence
export const tValueConfidence = 5; // Anything above this is "high" in confidence

// Backend server endpoints
export const endpoints = {
  alert: '/performance/alert/',
  alertSummary: '/performance/alertsummary/',
  changelog: '/changelog/',
  frameworks: '/performance/framework/',
  issueTrackers: '/performance/issue-tracker/',
  summary: '/performance/summary/',
  validityDashboard: '/performance/validity-dashboard/',
  performanceTags: '/performance/tag/',
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
export const unknownFrameworkMessage = 'unknown framework';
export const noDataFoundMessage = (title) => `No Data Found for ${title}`;
export const notSupportedAlertFiltersMessage = (filters) =>
  `Some filter terms are not supported (${filters.join(
    ', ',
  )}). Expected results might not be displayed.`;

export const availablePlatforms = ['Windows', 'Linux', 'OSX', 'Android'];

export const summaryStatusMap = {
  'all statuses': -1,
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

export const alertBackfillResultStatusMap = {
  preliminary: 0,
  readyForProcessing: 1,
  backfilled: 2,
  successful: 3,
  failed: 4,
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

export const tooltipMessages = {
  harness: 'patch that updated harness and caused improvements/regressions',
  infra:
    'improvements/regressions caused by infra changes (changes not related to repository code)',
  improvement: 'patch that generated an actual improvement',
  'regression-backedout': 'patch backed out due to causing regressions',
  'regression-fix': 'patch fixing a reported regression bug',
};

export const alertBackfillResultVisual = {
  preliminary: {
    message: 'Sherlock: Not backfilled',
    icon: faHourglass,
    color: '#000000',
  },
  readyForProcessing: {
    message: 'Sherlock: Soon to be backfilled',
    icon: faHourglassStart,
    color: '#000000',
  },
  backfilled: {
    message: 'Sherlock: Backfilling in progress',
    icon: faHourglassHalf,
    color: '#000000',
  },
  successful: {
    message: 'Sherlock: Backfilled Successfully',
    icon: faHourglassEnd,
    color: '#2da745',
  },
  failed: {
    message: 'Sherlock: Failled to backfill',
    icon: faHourglassEnd,
    color: '#dc3545',
  },
};

export const visualMetrics = [
  'ContentfulSpeedIndex',
  'FirstVisualChange',
  'LastVisualChange',
  'PerceptualSpeedIndex',
  'SpeedIndex',
  'videoRecordingStart',
];

export const scrollTypes = {
  prev: 'prev',
  next: 'next',
};

export const permaLinkPrefix = 'tableLink';

export const maximumVisibleAlertSummaryRows = 26;

export const noiseProfiles = {
  SKEWED: 'Noise Profile: Samples are heavily found on one side of the mean.',
  OUTLIERS:
    'Noise Profile: There are more outliers than should be expected from a normal distribution.',
  MODAL:
    'Noise Profile: There are multiple areas where most values are found rather than only one.',
  OK: 'Noise Profile: No issues were found.',
  NA: 'Noise Profile: Could not compute a noise profile.',
};
