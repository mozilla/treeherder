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
  note: 'The simple view is new.',
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
  broke: (n, noun) => `${countWord(n).toLowerCase()} ${plural(n, noun)} broke`,
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
    "Retrigger sends from treeherder.mozilla.org. This demo can't sign in to Taskcluster.",
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
