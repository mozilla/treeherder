import treeFavicon from '../img/tree_open.png';
import closedTreeFavicon from '../img/tree_closed.png';

export const thHosts = {
  production: {
    host: 'treeherder.mozilla.org',
    treestatus: {
      uiUrl: 'https://treestatus.mozilla-releng.net/static/ui/treestatus/',
      apiUrl: 'https://treestatus.mozilla-releng.net/',
    },
  },
  stage: {
    host: 'treeherder.allizom.org',
    treestatus: {
      uiUrl: 'https://ui.dev.lando.nonprod.cloudops.mozgcp.net/treestatus/',
      apiUrl: 'https://treestatus.dev.lando.nonprod.cloudops.mozgcp.net/',
    },
  },
  prototype: {
    host: 'prototype.treeherder.nonprod.cloudops.mozgcp.net',
    treestatus: {
      uiUrl: 'https://ui.dev.lando.nonprod.cloudops.mozgcp.net/treestatus/',
      apiUrl: 'https://treestatus.dev.lando.nonprod.cloudops.mozgcp.net/',
    },
  },
  localhost: {
    host: 'localhost',
    treestatus: {
      uiUrl: 'https://ui.dev.lando.nonprod.cloudops.mozgcp.net/treestatus/',
      apiUrl: 'https://treestatus.dev.lando.nonprod.cloudops.mozgcp.net/',
    },
  },
  default: {
    host: null,
    treestatus: {
      uiUrl: 'https://treestatus.mozilla-releng.net/static/ui/treestatus/',
      apiUrl: 'https://treestatus.mozilla-releng.net/',
      /*
      uiUrl: 'https://ui.dev.lando.nonprod.cloudops.mozgcp.net/treestatus/',
      apiUrl: 'https://treestatus.dev.lando.nonprod.cloudops.mozgcp.net/',
      */
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
  'linux1804-64': 'Linux 18.04 x64',
  'linux1804-64-qr': 'Linux 18.04 x64 WebRender',
  'linux1804-64-shippable': 'Linux 18.04 x64 Shippable',
  'linux1804-64-shippable-qr': 'Linux 18.04 x64 WebRender Shippable',
  'linux1804-64-devedition-qr': 'Linux 18.04 x64 WebRender DevEdition',
  'linux1804-64-asan': 'Linux 18.04 x64 asan',
  'linux1804-64-asan-qr': 'Linux 18.04 x64 WebRender asan',
  'linux1804-64-tsan-qr': 'Linux 18.04 x64 WebRender tsan',
  'linux1804-64-ccov-qr': 'Linux 18.04 x64 CCov WebRender',
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
  'macosx1014-64': 'OS X 10.14',
  'osx-1014-64': 'OS X 10.14',
  'macosx1014-64-qr': 'OS X 10.14 WebRender',
  'macosx1014-64-shippable': 'OS X 10.14 Shippable',
  'macosx1015-64': 'OS X 10.15',
  'macosx1015-64-qr': 'OS X 10.15 WebRender',
  'macosx1015-64-shippable': 'OS X 10.15 Shippable',
  'macosx1015-64-shippable-qr': 'OS X 10.15 WebRender Shippable',
  'macosx1015-64-devedition-qr': 'OS X 10.15 WebRender DevEdition',
  'macosx1100-64-qr': 'OS X 11 WebRender',
  'macosx1100-64-shippable-qr': 'OS X 11 WebRender Shippable',
  macosx64: 'OS X',
  osx: 'OS X',
  'macosx64-shippable': 'OS X Shippable',
  'macosx64-devedition': 'OS X DevEdition',
  'macosx64-aarch64': 'OS X AArch64',
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
  'win64-shippable': 'Windows x64 Shippable',
  'win64-devedition': 'Windows x64 DevEdition',
  'windows10-64-shippable': 'Windows 10 x64 Shippable',
  'windows10-64-shippable-qr': 'Windows 10 x64 WebRender Shippable',
  'windows10-64-qr': 'Windows 10 x64 WebRender',
  'windows10-64-ref-hw-2017-qr': 'Windows 10 x64 WebRender 2017 Ref HW',
  'windows10-aarch64-qr': 'Windows 10 AArch64 WebRender',
  'windows10-64-2004-ccov-qr': 'Windows 10 x64 2004 CCov WebRender',
  'windows10-64-2004-qr': 'Windows 10 x64 2004 WebRender',
  'windows10-64-2004-asan-qr': 'Windows 10 x64 2004 asan WebRender',
  'windows10-64-2004-shippable-qr': 'Windows 10 x64 2004 WebRender Shippable',
  'windows10-64-2004-devedition-qr': 'Windows 10 x64 2004 WebRender DevEdition',
  'windows10-64-2004-mingwclang-qr': 'Windows 10 x64 2004 MinGW WebRender',
  'windows11-64-2009-qr': 'Windows 11 x64 22H2 WebRender',
  'windows11-64-2009-asan-qr': 'Windows 11 x64 22H2 asan WebRender',
  'windows11-64-2009-shippable-qr': 'Windows 11 x64 22H2 WebRender Shippable',
  'windows11-64-2009-devedition-qr': 'Windows 11 x64 22H2 WebRender DevEdition',
  'windows11-64-2009-ccov-qr': 'Windows 11 x64 22H2 CCov WebRender',
  'windows11-64-2009-mingwclang-qr': 'Windows 11 x64 22H2 MinGW WebRender',
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
  'windows-mingw32': 'Windows MinGW',
  win32: 'Windows x86',
  win64: 'Windows x64',

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
  'android-5-0-geckoview-fat-aar-shippable':
    'Android 5.0 GeckoView multi-arch fat AAR Shippable',
  'android-em-7-0-x86': 'Android 7.0 x86',
  'android-em-7-0-x86_64-qr': 'Android 7.0 x86-64 WebRender',
  'android-em-7-0-x86_64-lite-qr': 'Android 7.0 x86-64 Lite WebRender',
  'android-em-7-0-x86_64-shippable-lite-qr':
    'Android 7.0 x86-64 Lite WebRender Shippable',
  'android-em-7-0-x86_64-shippable-qr':
    'Android 7.0 x86-64 Shippable WebRender',
  'android-hw-p2-8-0-arm7': 'Android 8.0 Pixel2',
  'android-hw-p2-8-0-arm7-shippable-qr':
    'Android 8.0 Pixel2 WebRender Shippable',
  'android-hw-p2-8-0-android-aarch64-qr':
    'Android 8.0 Pixel2 AArch64 WebRender',
  'android-hw-p2-8-0-android-aarch64-shippable-qr':
    'Android 8.0 Pixel2 AArch64 Shippable WebRender',
  'android-hw-a51-11-0-arm7-qr': 'Android 11.0 Samsung A51 Arm7',
  'android-hw-a51-11-0-aarch64-qr': 'Android 11.0 Samsung A51 AArch64',
  'android-hw-a51-11-0-aarch64-shippable-qr':
    'Android 11.0 Samsung A51 AArch64 Shippable',
  'android-hw-a51-11-0-arm7': 'Android 11.0 Samsung A51 Arm7',
  'android-hw-p5-13-0-android-aarch64-shippable-qr':
    'Android 13.0 Pixel5 AArch64 Shippable',
  'android-hw-p5-13-0-android-aarch64-qr': 'Android 13.0 Pixel5 AArch64',
  'android-hw-p5-13-0-arm7-shippable-qr': 'Android 13.0 Pixel5 Arm7 Shippable',
  'android-hw-p5-13-0-arm7-qr': 'Android 13.0 Pixel5 Arm7',
  'android-hw-p5-13-0-arm7': 'Android 13.0 Pixel5 Arm7',
  Android: 'Android',

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
