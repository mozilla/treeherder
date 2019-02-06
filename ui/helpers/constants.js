import treeFavicon from '../img/tree_open.png';
import closedTreeFavicon from '../img/tree_closed.png';

// TODO: This file is a handy catch-all, but we could likely move some of these
// to a specific helper or into the classes that use them.

export const thPlatformMap = {
  linux32: 'Linux',
  'linux32-devedition': 'Linux DevEdition',
  'linux32-nightly': 'Linux Nightly',
  linux64: 'Linux x64',
  'linux64-asan': 'Linux x64 asan',
  'linux64-asan-reporter': 'Linux x64 asan reporter',
  'linux64-add-on-devel': 'Linux x64 addon',
  'linux64-devedition': 'Linux x64 DevEdition',
  'linux64-qr': 'Linux x64 QuantumRender',
  'linux64-nightly': 'Linux x64 Nightly',
  'linux64-stylo-sequential': 'Linux x64 Stylo-Seq',
  'linux64-ccov': 'Linux x64 CCov',
  'linux64-noopt': 'Linux x64 NoOpt',
  'osx-10-10': 'OS X 10.10',
  'osx-cross': 'OS X Cross Compiled',
  'osx-cross-noopt': 'OS X Cross Compiled NoOpt',
  'osx-cross-add-on-devel': 'OS X Cross Compiled addon',
  'osx-cross-ccov': 'OS X Cross Compiled CCov',
  'osx-cross-devedition': 'OS X Cross Compiled DevEdition',
  'macosx64-qr': 'OS X 10.10 QuantumRender',
  'macosx64-devedition': 'OS X 10.10 DevEdition',
  'macosx64-nightly': 'OS X 10.10 Nightly',
  'macosx64-ccov': 'OS X 10.10 Cross Compiled CCov',
  'windows7-32': 'Windows 7',
  'windows7-32-devedition': 'Windows 7 DevEdition',
  'windows7-32-nightly': 'Windows 7 VM Nightly',
  'windows10-64': 'Windows 10 x64',
  'windows10-64-ccov': 'Windows 10 x64 CCov',
  'windows10-64-devedition': 'Windows 10 x64 DevEdition',
  'windows10-64-nightly': 'Windows 10 x64 Nightly',
  'windows10-64-qr': 'Windows 10 x64 QuantumRender',
  'windows10-64-ux': 'Windows 10 x64 HW UX',
  'windows2012-32': 'Windows 2012',
  'windows2012-32-add-on-devel': 'Windows 2012 addon',
  'windows2012-32-noopt': 'Windows 2012 NoOpt',
  'windows2012-32-devedition': 'Windows 2012 DevEdition',
  'windows2012-64': 'Windows 2012 x64',
  'windows2012-aarch64': 'Windows 2012 AArch64',
  'win64-asan-reporter': 'Windows 2012 x64 asan reporter',
  'windows2012-64-add-on-devel': 'Windows 2012 x64 addon',
  'windows2012-64-noopt': 'Windows 2012 x64 NoOpt',
  'windows2012-64-devedition': 'Windows 2012 x64 DevEdition',
  'windows-mingw32': 'Windows MinGW',

  'android-4-0-armv7-api16': 'Android 4.0 API16+',
  'android-4-0-armv7-api16-ccov': 'Android 4.0 API16+ CCov',
  'android-4-2-x86': 'Android 4.2 x86',
  'android-em-4-2-x86': 'Android 4.2 x86',
  'android-em-4-3-armv7-api16': 'Android 4.3 API16+',
  'android-em-4-3-armv7-api16-ccov': 'Android 4.3 API16+ CCov',
  'android-5-0-aarch64': 'Android 5.0 AArch64',
  'android-5-0-x86_64': 'Android 5.0 x86-64',
  'android-em-7-0-x86': 'Android 7.0 x86',
  'android-em-7-0-x86_64': 'Android 7.0 x86-64',
  'android-hw-g5-7-0-arm7-api-16': 'Android 7.0 MotoG5',
  'android-hw-p2-8-0-arm7-api-16': 'Android 8.0 Pixel2',
  'android-hw-p2-8-0-arm7-api-16-nightly': 'Android 8.0 Pixel2 Nightly',
  'android-hw-p2-8-0-android-aarch64': 'Android 8.0 Pixel2 AArch64',
  'android-hw-p2-8-0-android-aarch64-nightly':
    'Android 8.0 Pixel2 AArch64 Nightly',
  Android: 'Android',

  'gecko-decision': 'Gecko Decision Task',
  'firefox-release': 'Firefox Release Tasks',
  'devedition-release': 'Devedition Release Tasks',
  'fennec-release': 'Fennec Release Tasks',
  'thunderbird-release': 'Thunderbird Release Tasks',
  lint: 'Linting',
  'taskcluster-images': 'Docker Images',
  packages: 'Packages',
  toolchains: 'Toolchains',
  other: 'Other',
};

// Platforms where the `opt` should be dropped from
export const thSimplePlatforms = [
  'gecko-decision',
  'firefox-release',
  'devedition-release',
  'fennec-release',
  'thunderbird-release',
  'lint',
  'taskcluster-images',
  'packages',
  'toolchains',
  'diff',
];

export const thFailureResults = ['testfailed', 'busted', 'exception'];

export const thAllResultStatuses = [
  'testfailed',
  'busted',
  'exception',
  'success',
  'retry',
  'usercancel',
  'superseded',
  'running',
  'pending',
  'runnable',
];

export const thOptionOrder = {
  opt: 0,
  pgo: 1,
  asan: 2,
  tsan: 3,
  debug: 4,
  cc: 5,
  addon: 6,
  all: 7,
};

export const thFavicons = {
  closed: closedTreeFavicon,
  open: treeFavicon,
  'approval required': treeFavicon,
  unavailable: treeFavicon,
};

export const thDefaultRepo = 'mozilla-inbound';

export const thDateFormat = 'EEE MMM d, HH:mm:ss';

export const thJobNavSelectors = {
  ALL_JOBS: {
    name: 'jobs',
    selector: '.job-btn, .selected-job, .selected-count',
  },
  UNCLASSIFIED_FAILURES: {
    name: 'unclassified failures',
    selector:
      '.selected-job, .job-btn.btn-red, .job-btn.btn-orange, .job-btn.btn-purple, .job-btn.autoclassified',
  },
};

export const thPerformanceBranches = ['autoland', 'mozilla-inbound'];

/**
 * The set of custom Treeherder events.
 */
export const thEvents = {
  // fired with a selected job on 't'
  selectNextTab: 'select-next-tab-EVT',
  // fired with a selected job on 'r'
  jobRetrigger: 'job-retrigger-EVT',
  // fired when job classifications change (created/deleted)
  classificationChanged: 'classification-changed-EVT',
  saveClassification: 'save-classification-EVT',
  deleteClassification: 'delete-classification-EVT',
  openLogviewer: 'open-logviewer-EVT',
  autoclassifyIgnore: 'ac-ignore-EVT',
  applyNewJobs: 'apply-new-jobs-EVT',
};

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

export const phTimeRangeValues = {
  'mozilla-beta': 7776000,
};

export const phDefaultFramework = 'talos';

export const phFrameworksWithRelatedBranches = [
  1, // talos
  10, // raptor
  11, // js-bench
  12, // devtools
];

export const phAlertSummaryStatusMap = {
  UNTRIAGED: { id: 0, text: 'untriaged' },
  DOWNSTREAM: { id: 1, text: 'downstream' },
  REASSIGNED: { id: 2, text: 'reassigned' },
  INVALID: { id: 3, text: 'invalid' },
  IMPROVEMENT: { id: 4, text: 'improvement' },
  INVESTIGATING: { id: 5, text: 'investigating' },
  WONTFIX: { id: 6, text: 'wontfix' },
  FIXED: { id: 7, text: 'fixed' },
  BACKEDOUT: { id: 8, text: 'backedout' },
  CONFIRMING: { id: 9, text: 'confirming' },
};

export const phAlertStatusMap = {
  UNTRIAGED: { id: 0, text: 'untriaged' },
  DOWNSTREAM: { id: 1, text: 'downstream' },
  REASSIGNED: { id: 2, text: 'reassigned' },
  INVALID: { id: 3, text: 'invalid' },
  ACKNOWLEDGED: { id: 4, text: 'acknowledged' },
  CONFIRMING: { id: 5, text: 'confirming' },
};

export const compareDefaultTimeRange = 86400 * 2;

export const thBugSuggestionLimit = 20;

export const thMaxPushFetchSize = 100;

export const errorMessageClass = 'text-danger py-4 d-block text-center';

export const genericErrorMessage = 'Something went wrong';
