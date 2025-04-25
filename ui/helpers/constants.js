import treeFavicon from '../img/tree_open.png';
import closedTreeFavicon from '../img/tree_closed.png';

export const thHosts = {
  production: {
    host: 'treeherder.mozilla.org',
  },
  stage: {
    host: 'treeherder.allizom.org',
  },
  prototype: {
    host: 'prototype.treeherder.nonprod.cloudops.mozgcp.net',
  },
  localhost: {
    host: 'localhost',
  },
  default: {
    host: null,
    treestatus: {
      uiUrl: 'https://lando.services.mozilla.com/treestatus/',
      apiUrl: 'https://treestatus.prod.lando.prod.cloudops.mozgcp.net/',
    },
  },
};

// TODO: This file is a handy catch-all, but we could likely move some of these
// to a specific helper or into the classes that use them.

export const thPlatformMap = {
  linux32: 'Linux',
  'linux-shippable': 'Linux Shippable',
  'linux32-devedition': 'Linux DevEdition',
  'linux-devedition': 'Linux DevEdition',
  'linux32-shippable': 'Linux Shippable',
  'linux1804-32-qr': 'Linux 18.04 WebRender',
  'linux1804-32-shippable-qr': 'Linux 18.04 WebRender Shippable',
  linux64: 'Linux x64',
  'linux64-asan': 'Linux x64 asan',
  'linux64-asan-reporter': 'Linux x64 asan reporter',
  'linux64-add-on-devel': 'Linux x64 addon',
  'linux64-devedition': 'Linux x64 DevEdition',
  'linux64-qr': 'Linux x64 WebRender',
  'linux64-shippable': 'Linux x64 Shippable',
  'linux64-ccov': 'Linux x64 CCov',
  'linux64-noopt': 'Linux x64 NoOpt',
  'linux64-aarch64': 'Linux AArch64',
  'linux64-aarch64-shippable': 'Linux AArch64 Shippable',
  'linux1804-64': 'Linux 18.04 x64',
  'linux1804-64-qr': 'Linux 18.04 x64 WebRender',
  'linux1804-64-shippable': 'Linux 18.04 x64 Shippable',
  'linux1804-64-shippable-qr': 'Linux 18.04 x64 WebRender Shippable',
  'linux1804-64-devedition-qr': 'Linux 18.04 x64 WebRender DevEdition',
  'linux1804-64-asan': 'Linux 18.04 x64 asan',
  'linux1804-64-asan-qr': 'Linux 18.04 x64 WebRender asan',
  'linux1804-64-tsan-qr': 'Linux 18.04 x64 WebRender tsan',
  'linux1804-64-ccov-qr': 'Linux 18.04 x64 CCov WebRender',
  'linux2204-64-wayland': 'Linux 22.04 x64 Wayland',
  'linux2204-64-wayland-shippable': 'Linux 22.04 x64 Wayland Shippable',
  'linux64-nightlyasrelease': 'Linux x64 NightlyAsRelease',
  'linux1804-64-nightlyasrelease-qr':
    'Linux 18.04 x64 NightlyAsRelease WebRender',
  'osx-cross': 'OS X Cross Compiled',
  'osx-cross-aarch64': 'OS X AArch64 Cross Compiled',
  'osx-shippable': 'OS X Cross Compiled Shippable',
  'osx-aarch64-shippable': 'OS X AArch64 Cross Compiled Shippable',
  'osx-aarch64-devedition': 'OS X AArch64 Cross Compiled DevEdition',
  'osx-cross-noopt': 'OS X Cross Compiled NoOpt',
  'osx-cross-add-on-devel': 'OS X Cross Compiled addon',
  'osx-cross-aarch64-add-on-devel': 'OS X AArch64 Cross Compiled addon',
  'osx-cross-ccov': 'OS X Cross Compiled CCov',
  'osx-cross-devedition': 'OS X Cross Compiled DevEdition',
  'macosx1015-64': 'OS X 10.15',
  'macosx1015-64-qr': 'OS X 10.15 WebRender',
  'macosx1015-64-shippable': 'OS X 10.15 Shippable',
  'macosx1015-64-shippable-qr': 'OS X 10.15 WebRender Shippable',
  'macosx1015-64-devedition-qr': 'OS X 10.15 WebRender DevEdition',
  'macosx1100-64-qr': 'OS X 11 WebRender',
  'macosx1100-64-shippable': 'OS X 11 Shippable',
  'macosx1100-64-shippable-qr': 'OS X 11 WebRender Shippable',
  'macosx1100-64-aarch64-qr': 'OS X 11 AArch64 WebRender',
  'macosx1100-64-aarch64-shippable-qr': 'OS X 11 AArch64 WebRender Shippable',
  'macosx1100-aarch64-qr': 'OS X 11 AArch64 WebRender',
  'macosx1100-aarch64-shippable-qr': 'OS X 11 AArch64 WebRender Shippable',
  'macosx1300-64-shippable-qr': 'macOS 13 x64 Shippable WebRender',
  'macosx1400-64-shippable-qr': 'macOS 14.00 x64 Shippable WebRender',
  'macosx1470-64': 'macOS 14.70 x64',
  'macosx1470-64-shippable': 'macOS 14.70 x64 Shippable',
  'macosx1470-64-devedition': 'macOS 14.70 x64 DevEdition',
  macosx64: 'OS X',
  osx: 'OS X',
  'macosx64-shippable': 'OS X Shippable',
  'macosx64-devedition': 'OS X DevEdition',
  'macosx64-aarch64': 'OS X AArch64',
  'osx-nightlyasrelease': 'OS X NightlyAsRelease',
  'macosx64-nightlyasrelease': 'macOS x64 NightlyAsRelease',
  'macosx1015-64-nightlyasrelease-qr':
    'OS X 10.15 x64 NightlyAsRelease WebRender',
  'macosx1470-64-nightlyasrelease': 'macOS 14.70 x64 NightlyAsRelease',
  'win32-shippable': 'Windows x86 Shippable',
  'win32-devedition': 'Windows x86 DevEdition',
  'windows7-32-qr': 'Windows 7 WebRender',
  'windows7-32-shippable-qr': 'Windows 7 WebRender Shippable',
  'windows10-32-qr': 'Windows 10 x86 WebRender',
  'windows10-32-shippable-qr': 'Windows 10 x86 WebRender Shippable',
  'windows10-32-2004-qr': 'Windows 10 x86 2004 WebRender',
  'windows10-32-2004-shippable-qr': 'Windows 10 x86 2004 WebRender Shippable',
  'windows10-32-2004-mingwclang-qr': 'Windows 10 x86 2004 MinGW WebRender',
  'windows11-32-2009-qr': 'Windows 11 x86 22H2 WebRender',
  'windows11-32-2009-shippable-qr': 'Windows 11 x86 22H2 WebRender Shippable',
  'windows11-32-2009-mingwclang-qr': 'Windows 11 x86 22H2 MinGW WebRender',
  'windows11-32-24h2': 'Windows 11 x86 24H2',
  'windows11-32-24h2-shippable': 'Windows 11 x86 24H2 Shippable',
  'windows11-32-24h2-devedition': 'Windows 11 x86 24H2 DevEdition',
  'windows11-32-24h2-mingwclang': 'Windows 11 x86 24H2 MinGW',
  'win64-shippable': 'Windows x64 Shippable',
  'win64-devedition': 'Windows x64 DevEdition',
  'windows10-64': 'Windows 10 x64',
  'windows10-64-shippable': 'Windows 10 x64 Shippable',
  'windows10-64-shippable-qr': 'Windows 10 x64 WebRender Shippable',
  'windows10-64-qr': 'Windows 10 x64 WebRender',
  'windows10-64-2009-shippable-qr': 'Windows 10 x64 2009 Shippable WebRender',
  'windows10-64-2009-qr': 'Windows 10 x64 2009 WebRender',
  'windows11-64': 'Windows 11 x64',
  'windows11-64-qr': 'Windows 11 x64 WebRender',
  'windows11-64-shippable-qr': 'Windows 11 x64 WebRender Shippable',
  'windows11-64-2009-qr': 'Windows 11 x64 22H2 WebRender',
  'windows11-64-24h2': 'Windows 11 x64 24H2',
  'windows11-64-24h2-devedition': 'Windows 11 x64 24H2 DevEdition',
  'windows11-64-24h2-shippable': 'Windows 11 x64 24H2 Shippable',
  'windows11-64-24h2-ccov': 'Windows 11 x64 24H2 CCov',
  'windows11-64-24h2-mingwclang': 'Windows 11 x64 24H2 MinGW',
  'windows11-64-2009-asan-qr': 'Windows 11 x64 22H2 asan WebRender',
  'windows11-64-2009-shippable-qr': 'Windows 11 x64 22H2 WebRender Shippable',
  'windows11-64-2009-devedition-qr': 'Windows 11 x64 22H2 WebRender DevEdition',
  'windows11-64-2009-ccov-qr': 'Windows 11 x64 22H2 CCov WebRender',
  'windows11-64-2009-mingwclang-qr': 'Windows 11 x64 22H2 MinGW WebRender',
  'windows11-64-2009-hw-ref': 'Windows 11 x64 22H2 WebRender Ref HW',
  'windows11-64-2009-hw-ref-shippable':
    'Windows 11 x64 22H2 WebRender Ref HW Shippable',
  'windows2012-32': 'Windows 2012',
  'windows2012-32-shippable': 'Windows 2012 Shippable',
  'windows2012-32-add-on-devel': 'Windows 2012 addon',
  'windows2012-32-noopt': 'Windows 2012 NoOpt',
  'windows2012-32-devedition': 'Windows 2012 DevEdition',
  'windows2012-64': 'Windows 2012 x64',
  'windows2012-64-shippable': 'Windows 2012 x64 Shippable',
  'win64-asan-reporter': 'Windows 2012 x64 asan reporter',
  'windows2012-64-add-on-devel': 'Windows 2012 x64 addon',
  'windows2012-64-noopt': 'Windows 2012 x64 NoOpt',
  'windows2012-64-devedition': 'Windows 2012 x64 DevEdition',
  'windows2012-aarch64': 'Windows 2012 AArch64',
  'windows2012-aarch64-shippable': 'Windows 2012 AArch64 Shippable',
  'windows2012-aarch64-devedition': 'Windows 2012 AArch64 DevEdition',
  'windows2022-32': 'Windows 2022',
  'windows2022-64': 'Windows 2022 x64',
  'windows-mingw32': 'Windows MinGW',
  win32: 'Windows x86',
  win64: 'Windows x64',
  'win64-aarch64-shippable': 'Windows AArch64 Shippable',
  'win64-aarch64-devedition': 'Windows AArch64 DevEdition',
  'win64-nightlyasrelease': 'Windows x64 NightlyAsRelease WebRender',
  'windows10-64-nightlyasrelease-qr':
    'Windows 10 x64 NightlyAsRelease WebRender',
  'windows11-64-nightlyasrelease-qr':
    'Windows 11 x64 NightlyAsRelease WebRender',
  'android-4-1-armv7': 'Android 4.1 ARMv7',
  'android-4-1-x86': 'Android 4.1 x86',
  'android-4-1-x86-shippable-lite': 'Android 4.1 x86 Lite Shippable',
  'android-4-1-armv7-shippable-lite': 'Android 4.1 Lite ARMv7 Shippable',
  'android-4-1-geckoview-fat-aar-shippable':
    'Android 4.1 Shippable GeckoView multi-arch fat AAR',
  'android-5-0-armv7': 'Android 5.0 ARMv7',
  'android-5-0-armv7-shippable': 'Android 5.0 ARMv7 Shippable',
  'android-5-0-aarch64': 'Android 5.0 AArch64',
  'android-5-0-aarch64-shippable': 'Android 5.0 AArch64 Shippable',
  'android-5-0-aarch64-shippable-lite': 'Android 5.0 AArch64 Lite Shippable',
  'android-5-0-x86': 'Android 5.0 x86',
  'android-5-0-x86-shippable': 'Android 5.0 x86 Shippable',
  'android-5-0-x86_64': 'Android 5.0 x86-64',
  'android-5-0-x86_64-shippable': 'Android 5.0 x86-64 Shippable',
  'android-5-0-x86_64-shippable-lite': 'Android 5.0 x86-64 Lite Shippable',
  'android-5-0-geckoview-fat-aar': 'Android 5.0 GeckoView multi-arch fat AAR',
  'android-5-0-geckoview-fat-aar-shippable':
    'Android 5.0 GeckoView multi-arch fat AAR Shippable',
  'android-em-7-0-x86': 'Android 7.0 x86',
  'android-em-7-0-x86-qr': 'Android 7.0 x86 WebRender',
  'android-em-7-0-x86_64-qr': 'Android 7.0 x86-64 WebRender',
  'android-em-7-0-x86_64-lite-qr': 'Android 7.0 x86-64 Lite WebRender',
  'android-em-7-0-x86_64-shippable-lite-qr':
    'Android 7.0 x86-64 Lite WebRender Shippable',
  'android-em-7-0-x86_64-shippable-qr':
    'Android 7.0 x86-64 Shippable WebRender',
  'android-hw-a51-11-0-aarch64-qr': 'Android 11.0 Galaxy A51 AArch64',
  'android-hw-a51-11-0-aarch64-shippable-qr':
    'Android 11.0 Galaxy A51 AArch64 Shippable',
  'android-hw-a51-11-0-aarch64-shippable':
    'Android 11.0 Galaxy A51 AArch64 Shippable',
  'android-hw-a51-11-0-arm7-qr': 'Android 11.0 Galaxy A51 ARMv7',
  'android-hw-a51-11-0-arm7': 'Android 11.0 Galaxy A51 ARMv7',
  'android-hw-p5-13-0-android-aarch64-shippable-qr':
    'Android 13.0 Pixel5 AArch64 Shippable',
  'android-hw-p5-13-0-android-aarch64-qr': 'Android 13.0 Pixel5 AArch64',
  'android-hw-p6-13-0-android-aarch64-shippable-qr':
    'Android 13.0 Pixel5 AArch64 Shippable',
  'android-hw-p5-13-0-arm7-shippable-qr': 'Android 13.0 Pixel5 ARMv7 Shippable',
  'android-hw-p5-13-0-arm7-qr': 'Android 13.0 Pixel5 ARMv7',
  'android-hw-p5-13-0-arm7': 'Android 13.0 Pixel5 ARMv7',
  'android-hw-p5-13-0-aarch64': 'Android 13.0 Pixel5 AArch64',
  'android-hw-p6-13-0-aarch64': 'Android 13.0 Pixel6 AArch64',
  'android-hw-p6-13-0-aarch64-shippable':
    'Android 13.0 Pixel6 AArch64 Shippable',
  'android-hw-a55-14-0-aarch64-shippable':
    'Android 14.0 Galaxy A55 AArch64 Shippable',
  'android-hw-a55-14-0-aarch64': 'Android 14.0 Galaxy A55 AArch64',
  'android-hw-a55-14-0-android-aarch64-shippable-qr':
    'Android 14.0 Galaxy A55 AArch64 Shippable',
  'android-hw-s24-14-0-aarch64-shippable':
    'Android 14.0 Galaxy S24 AArch64 Shippable',
  'android-hw-s24-14-0-android-aarch64-shippable-qr':
    'Android 14.0 Galaxy S24 AArch64 Shippable',
  Android: 'Android',
  'AC-android-all': 'Android Components',
  'AC-ui-test': 'Android Components UI Tests',
  'fenix-android-all': 'Fenix',
  'fenix-ui-test': 'Fenix UI Tests',
  'focus-android-all': 'Focus Android',
  'focus-ui-test': 'Focus Android UI Tests',
  ios: 'iOS',

  'gecko-decision': 'Gecko Decision Task',
  'firefox-release': 'Firefox Release Tasks',
  'devedition-release': 'Devedition Release Tasks',
  'thunderbird-release': 'Thunderbird Release Tasks',
  diff: 'Diffoscope',
  lint: 'Linting',
  doc: 'Documentation',
  fetch: 'Fetch',
  symbols: 'Symbols',
  'taskcluster-images': 'Docker Images',
  packages: 'Packages',
  toolchains: 'Toolchains',
  updatebot: 'Updatebot',
  codeql: 'codeql',
  'linux64-snap-amd64-nightly': 'Linux x64 Snap amd64 nightly',
  'linux64-snap-amd64-beta': 'Linux x64 Snap amd64 beta',
  'linux64-snap-amd64-stable': 'Linux x64 Snap amd64 stable',
  'linux64-snap-amd64-esr128': 'Linux x64 Snap amd64 esr128',
  'linux64-snap-amd64-esr': 'Linux x64 Snap amd64 esr',
  'linux64-snap-amd64-2204-nightly': 'Linux 22.04 x64 Snap amd64 nightly',
  'linux64-snap-amd64-2204-beta': 'Linux 22.04 x64 Snap amd64 beta',
  'linux64-snap-amd64-2204-stable': 'Linux 22.04 x64 Snap amd64 stable',
  'linux64-snap-amd64-2204-esr128': 'Linux 22.04 x64 Snap amd64 esr128',
  'linux64-snap-amd64-2204-esr': 'Linux 22.04 x64 Snap amd64 esr',
  'linux64-snap-amd64-2404-nightly': 'Linux 24.04 x64 Snap amd64 nightly',
  'linux64-snap-amd64-2404-beta': 'Linux 24.04 x64 Snap amd64 beta',
  'linux64-snap-amd64-2404-stable': 'Linux 24.04 x64 Snap amd64 stable',
  'linux64-snap-amd64-2404-esr128': 'Linux 24.04 x64 Snap amd64 esr128',
  'linux64-snap-amd64-2404-esr': 'Linux 24.04 x64 Snap amd64 esr',
  other: 'Other',
};

// Platforms where the `opt` should be dropped from
export const thSimplePlatforms = [
  'gecko-decision',
  'firefox-release',
  'devedition-release',
  'fennec-beta',
  'fennec-release',
  'thunderbird-release',
  'lint',
  'doc',
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
  opt: 1,
  pgo: 2,
  asan: 3,
  tsan: 4,
  debug: 5,
  cc: 6,
  addon: 7,
  all: 8,
  'debug-isolated-process': 9,
};

export const thFavicons = {
  closed: closedTreeFavicon,
  open: treeFavicon,
  'approval required': treeFavicon,
  unavailable: treeFavicon,
};

export const thDefaultRepo = 'autoland';

export const thJobNavSelectors = {
  ALL_JOBS: {
    name: 'jobs',
    selector: '.job-btn, .selected-job, .selected-count',
  },
  UNCLASSIFIED_FAILURES: {
    name: 'unclassified failures',
    selector:
      '.selected-job, .job-btn.btn-red, .job-btn.btn-orange, .job-btn.btn-purple',
  },
};

export const thPerformanceBranches = ['autoland', 'mozilla-central'];

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
  applyNewJobs: 'apply-new-jobs-EVT',
  filtersUpdated: 'filters-updated-EVT',
  clearPinboard: 'clear-pinboard-EVT',
  internalIssueClassification: 'internal-issue-classification-EVT',
};

export const thBugSuggestionLimit = 20;

export const thMaxPushFetchSize = 100;

export const errorMessageClass = 'text-danger py-4 d-block text-center';

export const genericErrorMessage = 'Something went wrong';

// Datetime format used for pushes listed in https://hg.mozilla.org/
// e.g. Sun Feb 14 22:40:03 2021 +0000
export const mercurialDatetimeFormat = 'ddd MMM DD HH:mm:ss YYYY ZZ';

export const alertsViewDatetimeFormat = 'ddd MMM DD HH:mm YYYY';

export const sxsJobTypeName = 'perftest-linux-side-by-side';

export const sxsTaskName = 'side-by-side';

export const geckoProfileTaskName = 'geckoprofile';

// Number of internal issue classifications to open a bug in Bugzilla
export const requiredInternalOccurrences = 3;
