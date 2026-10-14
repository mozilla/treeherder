import alert from './kit/alert.svg';
import inquisitive from './kit/inquisitive.svg';
import sittingLookingForward from './kit/sitting-looking-forward.svg';
import sittingLookingUp from './kit/sitting-looking-up.svg';

const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

const NUMBER_WORDS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
];

export const countWord = (n) => NUMBER_WORDS[n] || String(n);

const capitalize = (s) => `${s[0].toUpperCase()}${s.slice(1)}`;

export const FEEDBACK_URL =
  'https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree%20Management&component=Treeherder&short_desc=Simple%20view%3A%20';

export const NAV = {
  logoAlt: 'Treeherder',
  home: 'Your pushes',
  fullView: 'Full view',
  darkMode: 'Dark mode',
  darkModeState: (on) => (on ? 'Dark mode on' : 'Dark mode off'),
  beta: 'Beta',
};

export const BETA = {
  note: 'This simplified view is currently in beta.',
  report: 'Report a bug or suggestion',
};

export const KIT_ALT = 'Kit, the Firefox mascot';

export const PICKER = {
  title: 'Pushes by…',
  recent: 'Recent',
  clear: 'Clear',
  placeholder: (hasRecent) => (hasRecent ? 'name@mozilla.com' : 'you@mozilla.com'),
  emailLabel: 'Author email',
  show: 'Show pushes',
  openFullView: 'Open the full view',
};

export const LIST = {
  title: (name) => (name ? `${name.split(' ')[0]}’s pushes` : 'Pushes'),
  author: (who) => `author: ${who}`,
  authorLabel: (email) => `Author ${email}, tap to change`,
  editShow: 'Show',
  editCancel: 'Cancel',
  editRecent: 'Recent',
  empty: (repo, author) => `Nothing on ${repo} from ${author}.`,
  wrongAddress: 'Wrong address? Change it',
  unreachable: "Couldn't reach Treeherder.",
  failing: (kinds) => `${capitalize(kinds.join(' and '))} failing`,
  failingKinds: { tests: 'tests', build: 'build', lint: 'lint' },
  stillRunning: (text) => `${text} · still running`,
  running: (done, total) => `Running · ${done} of ${total}`,
  onlySeenBefore: 'Only failures seen before',
  green: 'All green',
};

export const VERDICT = {
  testsBroke: (n) => `${countWord(n).toLowerCase()} ${plural(n, 'test')} broke`,
  buildsBroke: (n) => `${countWord(n).toLowerCase()} ${plural(n, 'build')} broke`,
  lintFailed: 'lint failed',
  sentence: (parts) => `${capitalize(parts.join(', '))}.`,
  soFar: (done, total) => `${done} of ${total} jobs done so far.`,
  othersSeenBefore: (n) =>
    ` ${countWord(n)} other ${plural(n, 'failure has', 'failures have')} been seen before.`,
  alsoOnParent: (n) =>
    `${n} more ${plural(n, 'test fails', 'tests fail')} on the parent too.`,
  probablyYours: "Nothing here fails on the parent, so it's probably yours.",
  nothingNewYet: (soFar, others) => `${soFar} Nothing new has broken.${others}`,
  stillRunning: 'Still running.',
  nothingNew: 'Nothing new broke.',
  likelyIntermittent: (n) =>
    `${countWord(n)} ${plural(n, 'failure has', 'failures have')} been seen before, so ${plural(n, "it's", "they're")} likely intermittent.`,
  failsOnParentToo: (n) =>
    `${countWord(n)} ${plural(n, 'test fails', 'tests fail')} here, but on the parent too.`,
  allGreen: 'All green.',
  nothingToLookAt: (total) => `${total} ${plural(total, 'job')}, nothing needs a look.`,
};

export const PUSH = {
  noPush: 'No push with that revision.',
  loadError: "Couldn't reach Treeherder.",
  reading: 'Reading the results',
  ringDone: 'done',
  ringJobs: (n) => plural(n, 'job'),
  elapsed: (time) => `${time} in`,
  alreadyAnswered: 'Every failure has already been rerun or marked intermittent.',
  commits: (n) => `${n} ${plural(n, 'commit')}`,
  everyJob: 'Every job, in the full view',
  sections: {
    brokenHere: 'Broken here',
    builds: 'Builds',
    lint: 'Lint',
    alsoOnParent: 'Also failing on the parent',
    seenBefore: 'Seen before',
    knownIntermittents: 'Known intermittents',
  },
  legend: {
    testfailed: 'failed',
    busted: 'busted',
    exception: 'exception',
    success: 'passed',
    running: 'running',
    pending: 'pending',
    unscheduled: 'waiting on a build',
  },
  newTag: 'New',
  failedRuns: (failed, total) =>
    `Failed ${failed} of ${total} ${plural(total, 'run')}`,
  jobCount: (n) => `${n} jobs · `,
};

export const JOB = {
  backToPush: 'This push',
  failureSummary: 'Failure summary',
  noLines: 'No failure lines were parsed for this job. The log has the rest.',
  loadError: "Couldn't load that job.",
  newInPush: 'New in this push',
  seenBefore: (n) => `Seen ${n} ${plural(n, 'time')} before`,
  internalBug: 'Internal',
  moreBugs: (n) => `${n} more ${plural(n, 'bug')}`,
  otherErrors: (n) => `${n} other log ${plural(n, 'error')}`,
  logViewer: 'Log viewer',
  rawLog: 'Raw log',
  fullView: 'Full view',
};

export const RETRIGGER = {
  idle: (n) =>
    n === 1 ? 'Rerun the failed test job' : `Rerun the ${n} failed test jobs`,
  confirm: (n) => `Tap again to rerun ${n} ${plural(n, 'job')}`,
  sending: () => 'Sending…',
  sent: () => "Sent. They'll show up here as they run.",
  signin: () => 'Approve Taskcluster in the new tab, then tap again.',
  failed: () => "Couldn't send that. Tap to try again.",
  elsewhere: () =>
    "Retrigger sends from treeherder.mozilla.org. This domain can't sign in to Taskcluster.",
};

export const ETA = {
  mostSoon: 'Most results any minute.',
  mostIn: (min) => `Most results in ~${min} min.`,
  mostLine: (most, all) => `Most by ${most} · all done around ${all}`,
  startSoon: (started) => `${started ? 'The rest start' : 'Tests start'} any minute.`,
  startIn: (started, min) =>
    `${started ? 'The rest start' : 'Tests start'} in ~${min} min.`,
  waitingOn: (n, build) =>
    `${n} ${plural(n, 'job waits', 'jobs wait')} on the ${build}`,
  buildName: (name) => `${name} build`,
};

export const TIME = {
  justNow: 'just now',
  minutesAgo: (m) => `${m}m ago`,
  hoursAgo: (h) => `${h}h ago`,
  yesterday: 'yesterday',
  daysAgo: (d) => `${d}d ago`,
  minutes: (m) => `${m} min`,
  hoursMinutes: (h, m) => `${h}h ${m}m`,
};

export const RESULT_WORDS = {
  testfailed: 'failed',
  busted: 'broke',
  exception: 'errored',
  usercancel: 'cancelled',
};

export const STORAGE_PREFIX = 'simpleView:';
export const THEME_KEY = 'simpleViewTheme';
export const FULL_VIEW_KEY = 'simpleViewFullView';

export const CACHE_LIMITS = { health: 8, summaries: 60, people: 8 };
export const MAX_REQUESTS_IN_FLIGHT = 4;

export const PUSH_LIST_COUNT = 15;
export const SHORT_REVISION_LENGTH = 12;
export const POLL_MS = { list: 90 * 1000, push: 60 * 1000 };

export const RING = { ticks: 90, size: 240, weight: 3 };
export const MINI_RING = { ticks: 24, size: 38, weight: 7 };
// Failures first from twelve o'clock, so they're what the eye lands on.
export const RING_ORDER = [
  'testfailed',
  'busted',
  'exception',
  'success',
  'retry',
  'usercancel',
  'superseded',
  'other',
  'running',
  'pending',
  'unscheduled',
];
export const NAMED_RESULTS = new Set(RING_ORDER.slice(0, 7));

export const PULSE_MS = 1200;
export const COUNT_UP_MS = 900;

export const RETRIGGER_RESET_MS = {
  confirm: 4000,
  failed: 6000,
  sent: 8000,
  elsewhere: 6000,
};

export const SHOWN_BUGS = 3;
// Lines a failing test always drags along; they say nothing about why.
export const FILLER_LINE = /^(profile uploaded in |finished in \d+ms$)/;

export const FAILED_RESULTS = new Set(['testfailed', 'busted', 'exception']);
// `status` counts jobs by state and completed jobs by result, and its own
// `completed` total can disagree with the per-result counts, so finished work
// is summed from the results.
export const NOT_RESULTS = new Set([
  'completed',
  'pending',
  'running',
  'unscheduled',
  'coalesced', // an alias of superseded, kept for old API consumers
]);
export const UNCLASSIFIED_IDS = new Set([1, 6]); // "not classified", "new failure"

export const VIEWPORT_TAG = {
  name: 'viewport',
  content:
    'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content',
};
export const TOOLBAR_COLOR_VAR = '--th-navbar-bg';

// The mobileCheck pattern from mozilla/telemetry-alerts (ui/app.js).
export const MOBILE_UA =
  /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i;
export const MOBILE_UA_PREFIX =
  /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw-(n|u)|c55\/|capi|ccwa|cdm-|cell|chtm|cldc|cmd-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc-s|devi|dica|dmob|do(c|p)o|ds(12|-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(-|_)|g1 u|g560|gene|gf-5|g-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd-(m|p|t)|hei-|hi(pt|ta)|hp( i|ip)|hs-c|ht(c(-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i-(20|go|ma)|i230|iac( |-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|-[a-w])|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|-([1-8]|c))|phil|pire|pl(ay|uc)|pn-2|po(ck|rt|se)|prox|psio|pt-g|qa-a|qc(07|12|21|32|60|-[2-7]|i-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h-|oo|p-)|sdk\/|se(c(-|0|1)|47|mc|nd|ri)|sgh-|shar|sie(-|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h-|v-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl-|tdg-|tel(i|m)|tim-|t-mo|to(pl|sh)|ts(70|m-|m3|m5)|tx-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i;

export const JOB_COLUMNS = {
  id: 'id',
  state: 'state',
  result: 'result',
  symbol: 'job_type_symbol',
  classification: 'failure_classification_id',
  tier: 'tier',
  platform: 'platform',
  platformOption: 'platform_option',
  jobTypeName: 'job_type_name',
  submit: 'submit_timestamp',
  start: 'start_timestamp',
  end: 'end_timestamp',
};
export const JOB_STATES = new Set(['pending', 'running', 'completed', 'unscheduled']);
export const JOB_PAGE_SIZE = 2000;

export const ETA_MODEL = {
  fallbackMinutes: 20.8,
  mostResultsQuantile: 0.9,
  // Uncorrected, real finishes run 1.9x the predicted remaining time at the
  // median; 1.25 errs long, which is the right direction for an ETA.
  tailCalibration: 1.25,
  // Below 60% of unresolved jobs in pools with an observed wait, estimates
  // are off by about two hours, so say nothing.
  firmCoverage: 0.6,
  // The decision task has to land before there's anything to estimate.
  minimumElapsedSeconds: 8 * 60,
};

export const KIT_POSES = [
  sittingLookingUp,
  sittingLookingForward,
  inquisitive,
  alert,
];
