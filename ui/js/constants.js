import treeFavicon from '../img/tree_open.png';
import closedTreeFavicon from '../img/tree_closed.png';

export const thPlatformMap = {
    linux32: "Linux",
    "linux32-devedition": "Linux DevEdition",
    "linux32-qr": "Linux QuantumRender",
    "linux32-nightly": "Linux Nightly",
    "linux32-stylo": "Linux Stylo",
    "linux32-stylo-disabled": "Linux Stylo Disabled",
    linux64: "Linux x64",
    "linux64-asan": "Linux x64 asan",
    "linux64-add-on-devel": "Linux x64 addon",
    "linux64-devedition": "Linux x64 DevEdition",
    "linux64-qr": "Linux x64 QuantumRender",
    "linux64-nightly": "Linux x64 Nightly",
    "linux64-stylo": "Linux x64 Stylo",
    "linux64-stylo-disabled": "Linux x64 Stylo Disabled",
    "linux64-stylo-sequential": "Linux x64 Stylo-Seq",
    "linux64-ccov": "Linux x64 CCov",
    "linux64-jsdcov": "Linux x64 JSDCov",
    "linux64-noopt": "Linux x64 NoOpt",
    "linux64-dmd": "Linux x64 DMD",
    "osx-10-6": "OS X 10.6",
    "osx-10-7": "OS X 10.7",
    "osx-10-7-add-on-devel": "OS X 10.7 addon",
    "osx-10-7-devedition": "OS X 10.7 DevEdition",
    "osx-10-8": "OS X 10.8",
    "osx-10-9": "OS X 10.9",
    "osx-10-10": "OS X 10.10",
    "osx-10-10-devedition": "OS X 10.10 DevEdition",
    "osx-10-10-dmd": "OS X 10.10 DMD",
    "osx-10-11": "OS X 10.11",
    "osx-10-7-noopt": "OS X 10.7 NoOpt",
    "osx-cross": "OS X Cross Compiled",
    "osx-cross-noopt": "OS X Cross Compiled NoOpt",
    "osx-cross-add-on-devel": "OS X Cross Compiled addon",
    "osx-cross-devedition": "OS X Cross Compiled DevEdition",
    "macosx64-qr": "OS X 10.10 QuantumRender",
    "macosx64-stylo": "OS X 10.10 Stylo",
    "macosx64-stylo-disabled": "OS X 10.10 Stylo Disabled",
    "macosx64-devedition": "OS X 10.10 DevEdition",
    "macosx64-nightly": "OS X 10.10 Nightly",
    windowsxp: "Windows XP",
    "windowsxp-devedition": "Windows XP DevEdition",
    "windows7-32": "Windows 7",
    "windows7-32-vm": "Windows 7 VM",
    "windows7-32-devedition": "Windows 7 DevEdition",
    "windows7-32-stylo-disabled": "Windows 7 Stylo Disabled",
    "windows7-32-vm-devedition": "Windows 7 VM DevEdition",
    "windows7-32-nightly": "Windows 7 VM Nightly",
    "windows7-32-stylo": "Windows 7 VM Stylo",
    "windows7-64": "Windows 7 x64",
    "windows8-32": "Windows 8",
    "windows8-64": "Windows 8 x64",
    "windows8-64-devedition": "Windows 8 x64 DevEdition",
    "windows10-32": "Windows 10",
    "windows10-64": "Windows 10 x64",
    "windows10-64-vm": "Windows 10 x64 VM",
    "windows10-64-devedition": "Windows 10 x64 DevEdition",
    "windows10-64-nightly": "Windows 10 x64 Nightly",
    "windows10-64-stylo": "Windows 10 x64 Stylo",
    "windows10-64-stylo-disabled": "Windows 10 x64 Stylo Disabled",
    "windows10-64-qr": "Windows 10 x64 QuantumRender",
    "windows2012-32": "Windows 2012",
    "windows2012-32-add-on-devel": "Windows 2012 addon",
    "windows2012-32-noopt": "Windows 2012 NoOpt",
    "windows2012-32-devedition": "Windows 2012 DevEdition",
    "windows2012-32-dmd": "Windows 2012 DMD",
    "windows2012-64": "Windows 2012 x64",
    "windows2012-64-add-on-devel": "Windows 2012 x64 addon",
    "windows2012-64-noopt": "Windows 2012 x64 NoOpt",
    "windows2012-64-devedition": "Windows 2012 x64 DevEdition",
    "windows2012-64-dmd": "Windows 2012 x64 DMD",
    "windows-mingw32": "Windows MinGW",

    "android-2-2-armv6": "Android 2.2 Armv6",
    "android-2-2": "Android 2.2",
    "android-2-3-armv6": "Android 2.3 Armv6",
    "android-2-3": "Android 2.3",
    "android-2-3-armv7-api9": "Android 2.3 API9",
    "android-4-0": "Android 4.0",
    "android-4-0-armv7-api10": "Android 4.0 API10+",
    "android-4-0-armv7-api11": "Android 4.0 API11+",
    "android-4-0-armv7-api15": "Android 4.0 API15+",
    "android-4-0-armv7-api15-old-id": "Android 4.0 API15+ OldId",
    "android-4-0-armv7-api16": "Android 4.0 API16+",
    "android-4-0-armv7-api16-old-id": "Android 4.0 API16+ OldId",
    "android-4-2-x86": "Android 4.2 x86",
    "android-4-2-x86-old-id": "Android 4.2 x86 OldId",
    "android-4-2": "Android 4.2",
    "android-4-2-armv7-api11": "Android 4.2 API11+",
    "android-4-2-armv7-api15": "Android 4.2 API15+",
    "android-4-2-armv7-api16": "Android 4.2 API16+",
    "android-4-3": "Android 4.3",
    "android-4-3-armv7-api11": "Android 4.3 API11+",
    "android-4-3-armv7-api15": "Android 4.3 API15+",
    "android-4-3-armv7-api16": "Android 4.3 API16+",
    "android-4-4": "Android 4.4",
    "android-4-4-armv7-api11": "Android 4.4 API11+",
    "android-4-4-armv7-api15": "Android 4.4 API15+",
    "android-4-4-armv7-api16": "Android 4.4 API16+",
    "android-5-0-aarch64": "Android 5.0 AArch64",
    "android-5-0-armv7-api11": "Android 5.0 API11+",
    "android-5-0-armv7-api15": "Android 5.0 API15+",
    "android-5-0-armv8-api15": "Android 5.0 API15+",
    "android-5-0-armv8-api16": "Android 5.0 API16+",
    "android-5-1-armv7-api15": "Android 5.1 API15+",
    "android-6-0-armv8-api15": "Android 6.0 API15+",
    "android-6-0-armv8-api16": "Android 6.0 API16+",
    "android-7-1-armv8-api15": "Android 7.1 API15+",
    "android-7-1-armv8-api16": "Android 7.1 API16+",
    "b2gdroid-4-0-armv7-api11": "B2GDroid 4.0 API11+",
    "b2gdroid-4-0-armv7-api15": "B2GDroid 4.0 API15+",
    "android-4-0-armv7-api11-partner1": "Android API11+ partner1",
    "android-4-0-armv7-api15-partner1": "Android API15+ partner1",
    "android-api-15-gradle": "Android API15+ Gradle",
    "android-api-16-gradle": "Android API16+ Gradle",
    Android: "Android",

    "b2g-linux32": "B2G Desktop Linux",
    "b2g-linux64": "B2G Desktop Linux x64",
    "b2g-osx": "B2G Desktop OS X",
    "b2g-win32": "B2G Desktop Windows",
    "b2g-emu-ics": "B2G ICS Emulator",
    "b2g-emu-jb": "B2G JB Emulator",
    "b2g-emu-kk": "B2G KK Emulator",
    "b2g-emu-x86-kk": "B2G KK Emulator x86",
    "b2g-emu-l": "B2G L Emulator",
    "b2g-device-image": "B2G Device Image",
    "mulet-linux32": "Mulet Linux",
    "mulet-linux64": "Mulet Linux x64",
    "mulet-osx": "Mulet OS X",
    "mulet-win32": "Mulet Windows",

    "graphene-linux64": "Graphene Linux x64",
    "graphene-osx": "Graphene OS X",
    "graphene-win64": "Graphene Windows x64",
    "horizon-linux64": "Horizon Linux x64",
    "horizon-osx": "Horizon OS X",
    "horizon-win64": "Horizon Windows x64",

    "gecko-decision": "Gecko Decision Task",
    "firefox-release": "Firefox Release Tasks",
    "devedition-release": "Devedition Release Tasks",
    "fennec-release": "Fennec Release Tasks",
    "thunderbird-release": "Thunderbird Release Tasks",
    lint: "Linting",
    "release-mozilla-release-": "Balrog Publishing",
    "taskcluster-images": "Docker Images",
    packages: "Packages",
    toolchains: "Toolchains",
    diff: "Diffoscope",
    other: "Other"
};

// Platforms where the `opt` should be dropped from
export const thSimplePlatforms = [
    "gecko-decision",
    "firefox-release",
    "devedition-release",
    "fennec-release",
    "thunderbird-release",
    "lint",
    "release-mozilla-release-",
    "taskcluster-images",
    "packages",
    "toolchains",
    "diff",
];

export const thFailureResults = ['testfailed', 'busted', 'exception'];

export const thAllResultStates = [
  'success',
  'testfailed',
  'busted',
  'exception',
  'retry',
  'usercancel',
  'running',
  'pending',
  'superseded',
  'runnable'
];

export const thDefaultFilterResultStates = [
  'success',
  'testfailed',
  'busted',
  'exception',
  'retry',
  'usercancel',
  'running',
  'pending',
  'runnable'
];

export const thOptionOrder = {
  opt: 0,
  pgo: 1,
  asan: 2,
  tsan: 3,
  debug: 4,
  cc: 5,
  addon: 6
};

export const thTitleSuffixLimit = 70;

export const thFavicons = {
  closed: closedTreeFavicon,
  open: treeFavicon,
  "approval required": treeFavicon,
  unavailable: treeFavicon
};

export const thRepoGroupOrder = {
  development: 1,
  "release-stabilization": 2,
  "project repositories": 3,
  "comm-repositories": 4,
  "qa automation tests": 5,
  try: 6,
  taskcluster: 7
};

export const thDefaultRepo = "mozilla-inbound";

export const thDateFormat = "EEE MMM d, HH:mm:ss";

export const thJobNavSelectors = {
  ALL_JOBS: {
    name: "jobs",
    selector: ".job-btn, .selected-job"
  },
  UNCLASSIFIED_FAILURES: {
    name: "unclassified failures",
    selector: ".selected-job, .job-btn.btn-red, .job-btn.btn-orange, .job-btn.btn-purple, .job-btn.autoclassified"
  }
};

export const thPinboardCountError = "Max pinboard size of 500 reached.";

export const thPinboardMaxSize = 500;

export const thPerformanceBranches = ["autoland", "mozilla-inbound"];

/**
 * The set of custom Treeherder events.
 */
export const thEvents = {
  // fired (surprisingly) when a job is clicked
  jobClick: "job-click-EVT",
  // fired with a selected job on 't'
  selectNextTab: "select-next-tab-EVT",
  // fired with a selected job on spacebar
  jobPin: "job-pin-EVT",
  // fired with a selected job on ctrl/cmd-click
  toggleJobPin: "job-togglepin-EVT",
  // fired with api call to increment the pinned jobs
  pulsePinCount: "pulse-pin-count-EVT",
  // fired with a selected job on 'r'
  jobRetrigger: "job-retrigger-EVT",
  // fired when jobs are classified locally
  jobsClassified: "jobs-classified-EVT",
  // fired when bugs are associated to jobs locally
  bugsAssociated: "bugs-associated-EVT",
  // after loading a group of jobs
  jobsLoaded: "jobs-loaded-EVT",
  // when new pushes are prepended, or appended
  pushesLoaded: "pushes-loaded-EVT",
  // after deselecting a job via click outside/esc
  clearSelectedJob: "clear-selected-job-EVT",
  // fired when a global filter has changed
  globalFilterChanged: "status-filter-changed-EVT",
  // after something happened that requires the number
  // of unclassified jobs by tier to be recalculated
  recalculateUnclassified: "recalc-unclassified-EVT",
  groupStateChanged: "group-state-changed-EVT",
  duplicateJobsVisibilityChanged: "duplicate-jobs-visibility-changed-EVT",
  showRunnableJobs: "show-runnable-jobs-EVT",
  deleteRunnableJobs: "delete-runnable-jobs-EVT",
  toggleUnclassifiedFailures: "toggle-unclassified-failures-EVT",
  changeSelection: "next-previous-job-EVT",
  addRelatedBug: "add-related-bug-EVT",
  saveClassification: "save-classification-EVT",
  deleteClassification: "delete-classification-EVT",
  clearPinboard: "clear-pinboard-EVT",
  selectJob: "select-job-EVT",
  applyNewJobs: "apply-new-jobs-EVT",
  openLogviewer: "open-logviewer-EVT",
  autoclassifyVerified: "ac-verified-EVT",
  autoclassifySaveAll: "ac-save-all-EVT",
  autoclassifySave: "ac-save-EVT",
  autoclassifyIgnore: "ac-ignore-EVT",
  autoclassifySelectOption: "ac-select-EVT",
  autoclassifyChangeSelection: "ac-change-selection-EVT",
  autoclassifyToggleExpandOptions: "ac-toggle-expand-options-EVT",
  autoclassifyToggleEdit: "ac-toggle-edit-EVT",
  autoclassifyOpenLogViewer: "ac-open-log-viewer-EVT",
  selectRunnableJob: "select-runnable-job-EVT",
};

export const phCompareDefaultOriginalRepo = "mozilla-central";

export const phCompareDefaultNewRepo = "try";

export const phTimeRanges = [
  { value: 86400, text: "Last day" },
  { value: 86400*2, text: "Last 2 days" },
  { value: 604800, text: "Last 7 days" },
  { value: 1209600, text: "Last 14 days" },
  { value: 2592000, text: "Last 30 days" },
  { value: 5184000, text: "Last 60 days" },
  { value: 7776000, text: "Last 90 days" },
  { value: 31536000, text: "Last year" }];

export const phDefaultTimeRangeValue = 1209600;

export const phTimeRangeValues = {
  "mozilla-beta": 7776000
};

export const phBlockers = {
  "cart summary": 2.0,
  "damp summary": 2.0,
  "dromaeo_css summary": 2.0,
  "dromaeo_dom summary": 2.0,
  "glterrain summary": 5.0,
  "kraken summary": 2.0,
  sessionrestore: 5.0,
  sessionrestore_no_auto_restore: 5.0,
  "tart summary": 5.0,
  "tcanvasmark summary": 5.0,
  "tp5o % Processor Time": 2.0,
  "tp5o Main_RSS": 2.0,
  "tp5o Modified Page List Bytes": 2.0,
  "tp5o Private Bytes": 2.0,
  "tp5o XRes": 2.0,
  "tp5o responsiveness": 2.0,
  "tp5o summary": 5.0,
  "tp5o_scroll summary": 2.0,
  tpaint: 5.0,
  "tps summary": 5.0,
  tresize: 5.0,
  ts_paint: 2.0,
  tscrollx: 2.0,
  "tsvgr_opacity summary": 5.0,
  "tsvgx summary": 5.0
};

export const phDefaultFramework = "talos";

export const phAlertSummaryStatusMap = {
  UNTRIAGED: { id: 0, text: "untriaged" },
  DOWNSTREAM: { id: 1, text: "downstream" },
  REASSIGNED: { id: 2, text: "reassigned" },
  INVALID: { id: 3, text: "invalid" },
  IMPROVEMENT: { id: 4, text: "improvement" },
  INVESTIGATING: { id: 5, text: "investigating" },
  WONTFIX: { id: 6, text: "wontfix" },
  FIXED: { id: 7, text: "fixed" },
  BACKEDOUT: { id: 8, text: "backedout" },
  CONFIRMING: { id: 9, text: "confirming" }
};

export const phAlertStatusMap = {
  UNTRIAGED: { id: 0, text: "untriaged" },
  DOWNSTREAM: { id: 1, text: "downstream" },
  REASSIGNED: { id: 2, text: "reassigned" },
  INVALID: { id: 3, text: "invalid" },
  ACKNOWLEDGED: { id: 4, text: "acknowledged" },
  CONFIRMING: { id: 5, text: "confirming" }
};

export const phCompareBaseLineDefaultTimeRange = 86400 * 2;

export const thBugSuggestionLimit = 20;
