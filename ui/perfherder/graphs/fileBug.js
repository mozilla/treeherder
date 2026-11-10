import { bzBaseUrl } from '../../helpers/url';
import { getFrameworkName } from '../perf-helpers/helpers';

// Bugs filed from the graphs view go to Perfherder's component, and its
// maintainer is CC'd. (Bugzilla can't pre-fill a needinfo request on a new
// bug from a link, so CC is the closest way to get them notified.)
export const BUG_PRODUCT = 'Tree Management';
export const BUG_COMPONENT = 'Perfherder';
export const BUG_CC = 'aglavic@mozilla.com';
export const SUMMARY_PREFIX = '[Perfherder graphs] ';
// Bugzilla is opened with a GET request, so keep the URL within what servers
// reliably accept; the page link in the description has every test anyway.
export const MAX_URL_LENGTH = 7500;

const yesNo = (value) => (value ? 'yes' : 'no');

// keep values from breaking the Markdown tables
const cell = (value) =>
  String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ');

const row = (values) => `| ${values.map(cell).join(' | ')} |`;

const table = (headers, rows) =>
  [row(headers), row(headers.map(() => '---')), ...rows.map(row)].join('\n');

const settingsTable = ({
  pageUrl,
  timeRange,
  highlightAlerts,
  highlightCommonAlerts,
  highlightChangelogData,
  highlightInitialDataPoints,
  showMissingJobs,
  replicates,
  showTable,
  selectedDataPoint,
  zoom,
  highlightedRevisions,
  userAgent,
}) => {
  const settings = [
    ['Page', pageUrl],
    ['Time range', timeRange.text],
    ['View', showTable ? 'table' : 'graph'],
    ['Highlight alerts', yesNo(highlightAlerts)],
    ['Highlight common alerts', yesNo(highlightCommonAlerts)],
    ['Highlight infra changes', yesNo(highlightChangelogData)],
    ['Highlight initial data points', yesNo(highlightInitialDataPoints)],
    ['Show missing jobs', yesNo(showMissingJobs)],
    ['Use replicates', yesNo(replicates)],
  ];
  if (selectedDataPoint?.signature_id) {
    settings.push([
      'Selected data point',
      `signature ${selectedDataPoint.signature_id}, data point ${selectedDataPoint.dataPointId}`,
    ]);
  }
  if (zoom?.x?.length) {
    const [from, to] = zoom.x.map((date) => new Date(date).toISOString());
    settings.push(['Zoomed to', `${from} – ${to}`]);
  }
  const revisions = highlightedRevisions.filter(Boolean);
  if (revisions.length) {
    settings.push(['Highlighted revisions', revisions.join(', ')]);
  }
  settings.push(['Browser', userAgent]);
  return table(['Setting', 'Value'], settings);
};

const testsTable = (testData, frameworks) =>
  table(
    [
      '#',
      'Repository',
      'Platform',
      'Test',
      'Application',
      'Framework',
      'Signature',
      'Visible',
    ],
    testData.map((series, i) => [
      i + 1,
      series.repository_name,
      series.platform,
      series.name,
      series.application || '',
      getFrameworkName(frameworks, series.framework_id),
      series.signatureHash
        ? `${series.signature_id} (${series.signatureHash.slice(0, 12)})`
        : series.signature_id,
      yesNo(series.visible),
    ]),
  );

// The bug's description: prompts for the reporter, then everything that
// affects what the graph shows, so whoever triages it can reproduce it.
export const buildBugDescription = (page, listedTests = page.testData.length) => {
  const { testData, frameworks } = page;
  let tests = 'No tests are plotted.';
  if (testData.length) {
    tests = testsTable(testData.slice(0, listedTests), frameworks);
    if (listedTests < testData.length) {
      tests += `\n\n…and ${testData.length - listedTests} more; see the page link above.`;
    }
  }

  return [
    '**What went wrong?**',
    '',
    '',
    '**What did you expect to happen?**',
    '',
    '',
    '---',
    '### Graph configuration',
    '_Filled in automatically by Perfherder._',
    '',
    settingsTable(page),
    '',
    `### Plotted tests (${testData.length})`,
    '',
    tests,
  ].join('\n');
};

const enterBugUrl = (description) =>
  `${bzBaseUrl}enter_bug.cgi?${new URLSearchParams({
    product: BUG_PRODUCT,
    component: BUG_COMPONENT,
    bug_type: 'defect',
    short_desc: SUMMARY_PREFIX,
    cc: BUG_CC,
    comment: description,
  })}`;

// Link to Bugzilla's "Enter Bug" form, pre-filled from the page. Opening it
// files nothing: the reporter reviews the form and submits it on Bugzilla.
export const buildBugUrl = (page) => {
  let listedTests = page.testData.length;
  let url = enterBugUrl(buildBugDescription(page, listedTests));
  // list fewer tests rather than produce a link too long to open
  while (url.length > MAX_URL_LENGTH && listedTests > 0) {
    listedTests -= 1;
    url = enterBugUrl(buildBugDescription(page, listedTests));
  }
  return url;
};
