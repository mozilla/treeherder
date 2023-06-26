import {
  faHourglassStart,
  faHourglassHalf,
  faHourglassEnd,
} from '@fortawesome/free-solid-svg-icons';
import {
  faHourglass,
  faQuestionCircle,
} from '@fortawesome/free-regular-svg-icons';
import {
  faAndroid,
  faApple,
  faLinux,
  faWindows,
} from '@fortawesome/free-brands-svg-icons';

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

export const alertSummaryLimit = 30;
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

export const phPlatformsIconsMap = {
  linux: faLinux,
  macos: faApple,
  windows: faWindows,
  android: faAndroid,
  other: faQuestionCircle,
};

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
  'all regressions': 9,
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
    message: 'Sherlock: Backfilled successfully some jobs',
    icon: faHourglassEnd,
    color: '#000000',
  },
  failed: {
    message: 'Sherlock: Backfilling failed for some jobs',
    icon: faHourglassEnd,
    color: '#000000',
  },
};

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

export const timeToTriage = 3;

export const replicatesMaxLength = 250;

export const browsertimeEssentialTests = [
  'amazon',
  'bing-search',
  'cnn',
  'fandom',
  'google-slides',
  'instagram',
  'twitter',
  'wikipedia',
  'yahoo-mail',
];

/**
 * Used for building the documentation links (Perfdocs) and side-by-side links.
 * @link https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#benchmarks
 */
export const browsertimeBenchmarksTests = [
  'ares6',
  'assorted-dom',
  'jetstream2',
  'matrix-react-bench',
  'motionmark-animometer',
  'motionmark-htmlsuite',
  'raptor-speedometer-geckoview',
  'raptor-youtube-playback-av1-sfr-chrome',
  'raptor-youtube-playback-av1-sfr-fenix',
  'raptor-youtube-playback-av1-sfr-firefox',
  'raptor-youtube-playback-av1-sfr-geckoview',
  'raptor-youtube-playback-h264-1080p30-firefox',
  'raptor-youtube-playback-h264-1080p60-firefox',
  'raptor-youtube-playback-h264-full-1080p30-firefox',
  'raptor-youtube-playback-h264-full-1080p60-firefox',
  'raptor-youtube-playback-h264-sfr-chrome',
  'raptor-youtube-playback-h264-sfr-fenix',
  'raptor-youtube-playback-h264-sfr-firefox',
  'raptor-youtube-playback-h264-sfr-geckoview',
  'raptor-youtube-playback-hfr-chrome',
  'raptor-youtube-playback-hfr-fenix',
  'raptor-youtube-playback-hfr-firefox',
  'raptor-youtube-playback-hfr-geckoview',
  'raptor-youtube-playback-v9-1080p30-firefox',
  'raptor-youtube-playback-v9-1080p60-firefox',
  'raptor-youtube-playback-v9-full-1080p30-firefox',
  'raptor-youtube-playback-v9-full-1080p60-firefox',
  'raptor-youtube-playback-vp9-sfr-chrome',
  'raptor-youtube-playback-vp9-sfr-fenix',
  'raptor-youtube-playback-vp9-sfr-firefox',
  'raptor-youtube-playback-vp9-sfr-geckoview',
  'raptor-youtube-playback-widevine-h264-sfr-chrome',
  'raptor-youtube-playback-widevine-h264-sfr-fenix',
  'raptor-youtube-playback-widevine-h264-sfr-firefox',
  'raptor-youtube-playback-widevine-h264-sfr-geckoview',
  'raptor-youtube-playback-widevine-hfr-chrome',
  'raptor-youtube-playback-widevine-hfr-fenix',
  'raptor-youtube-playback-widevine-hfr-firefox',
  'raptor-youtube-playback-widevine-hfr-geckoview',
  'raptor-youtube-playback-widevine-vp9-sfr-chrome',
  'raptor-youtube-playback-widevine-vp9-sfr-fenix',
  'raptor-youtube-playback-widevine-vp9-sfr-firefox',
  'raptor-youtube-playback-widevine-vp9-sfr-geckoview',
  'speedometer',
  'stylebench',
  'sunspider',
  'unity-webgl',
  'wasm-godot',
  'wasm-godot-baseline',
  'wasm-godot-optimizing',
  'wasm-misc',
  'wasm-misc-baseline',
  'wasm-misc-optimizing',
  'webaudio',
  'youtube-playback',
  'youtube-playback-av1-sfr',
  'youtube-playback-h264-1080p30',
  'youtube-playback-h264-1080p60',
  'youtube-playback-h264-full-1080p30',
  'youtube-playback-h264-full-1080p60',
  'youtube-playback-h264-sfr',
  'youtube-playback-hfr',
  'youtube-playback-v9-1080p30',
  'youtube-playback-v9-1080p60',
  'youtube-playback-v9-full-1080p30',
  'youtube-playback-v9-full-1080p60',
  'youtube-playback-vp9-sfr',
  'youtube-playback-widevine-h264-sfr',
  'youtube-playback-widevine-hfr',
  'youtube-playback-widevine-hfr',
];

export const browsertimeId = 13;
