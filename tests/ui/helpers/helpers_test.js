import {
  displayNumber,
  formatPushDescription,
  getAcknowledgeByDate,
  getFilledBugSummary,
  getResultsMap,
} from '../../../ui/perfherder/perf-helpers/helpers';
import { getRevisionUrl } from '../../../ui/helpers/url';
import testAlertSummaryImprovementsOnly from '../perfherder/filled_bug_alerts/alert_summary_improvements_only';
import testAlertSummaryDownstreamRegressions from '../perfherder/filled_bug_alerts/alert_summary_downstream_regressions';
import testAlertSummaryRegressionsAndImprovements from '../perfherder/filled_bug_alerts/alert_summary_regressions_and_improvements';
import testAlertSummaryInvalidRegressions from '../perfherder/filled_bug_alerts/alert_summary_invalid_regressions';
import testAlertSummaryWithOneRegression from '../perfherder/filled_bug_alerts/alert_summary_with_one_regression';
import testAlertSummaryRegressionsAndReassigned from '../perfherder/filled_bug_alerts/alert_summary_regressions_and_reassigned';
import testAlertSummaryRegressionsAndReassignedToOther from '../perfherder/filled_bug_alerts/alert_summary_regressions_and_reassigned_to_other';

const signatureWithoutValues = {
  signature_id: 2823875,
  framework_id: 1,
  signature_hash: '385945697f3b0c924647d192e73b0a697dd4d331',
  platform: 'windows10-64-shippable-qr',
  test: '',
  suite: 'pdfpaint',
  lower_is_better: true,
  has_subtests: false,
  tags: '',
  values: [],
  name: 'pdfpaint opt e10s stylo webrender',
  parent_signature: null,
  job_ids: [],
  repository_name: 'try',
  repository_id: 4,
  data: [],
  measurement_unit: 'ms',
  application: '',
};

const signatureWithValues = {
  signature_id: 4056611,
  framework_id: 1,
  signature_hash: '088cb5e753bb253b51d1ee9bfcdc7c8b93027a4e',
  platform: 'windows10-64-shippable-qr',
  test: '',
  suite: 'pdfpaint',
  lower_is_better: true,
  has_subtests: true,
  tags: '',
  values: [696.27, 689.91, 688.63, 686.25, 686.74],
  name: 'pdfpaint opt e10s stylo webrender',
  parent_signature: null,
  job_ids: [357670665, 357670679, 357670672, 357670676, 357670667],
  repository_name: 'try',
  repository_id: 4,
  data: [],
  measurement_unit: null,
  application: '',
};

const resultsMap = new Map();
resultsMap.set('pdfpaint opt e10s stylo webrender windows10-64-shippable-qr', {
  application: '',
  data: [],
  framework_id: 1,
  has_subtests: true,
  job_ids: [357670665, 357670679, 357670672, 357670676, 357670667],
  lower_is_better: true,
  measurement_unit: null,
  name: 'pdfpaint opt e10s stylo webrender',
  parent_signature: null,
  platform: 'windows10-64-shippable-qr',
  repository_id: 4,
  repository_name: 'try',
  signature_hash: '088cb5e753bb253b51d1ee9bfcdc7c8b93027a4e',
  signature_id: 4056611,
  suite: 'pdfpaint',
  tags: '',
  test: '',
  values: [696.27, 689.91, 688.63, 686.25, 686.74],
});
const result = {
  names: [
    'pdfpaint opt e10s stylo webrender',
    'pdfpaint opt e10s stylo webrender',
  ],
  platforms: ['windows10-64-shippable-qr', 'windows10-64-shippable-qr'],
  resultsMap,
  testNames: ['', ''],
};

describe('getRevisionUrl helper', () => {
  test('escapes some html symbols', () => {
    expect(getRevisionUrl('1234567890ab', 'autoland')).toBe(
      '/jobs?repo=autoland&revision=1234567890ab',
    );
  });
});

describe('displayNumber helper', () => {
  test('returns expected values', () => {
    expect(displayNumber('123.53222')).toBe('123.53');
    expect(displayNumber('123123123.53222')).toBe('123123123.53');
    expect(displayNumber(1 / 0)).toBe('Infinity');
    expect(displayNumber(Number.NaN)).toBe('N/A');
  });
});

test('getFilledBugSummary downstream regressions', async () => {
  const result = getFilledBugSummary(testAlertSummaryDownstreamRegressions);
  expect(result).toBe(
    '11% MySuite regression on 19 March 2021',
  );
});

test('getFilledBugSummary improvements only', async () => {
  const result = getFilledBugSummary(testAlertSummaryImprovementsOnly);
  expect(result).toBe(
    '11% MySuite regression on 19 March 2021',
  );
});

test('getFilledBugSummary invalid regressions', async () => {
  const result = getFilledBugSummary(testAlertSummaryInvalidRegressions);
  expect(result).toBe(
    '11% MySuite regression on 19 March 2021',
  );
});

test('getFilledBugSummary regressions and improvements', async () => {
  const result = getFilledBugSummary(
    testAlertSummaryRegressionsAndImprovements,
  );
  expect(result).toBe(
    '5% MySuite regression on 19 March 2021',
  );
});

test('getFilledBugSummary regressions and reassigned', async () => {
  const result = getFilledBugSummary(testAlertSummaryRegressionsAndReassigned);
  expect(result).toBe(
    '11% MySuite regression on 19 March 2021',
  );
});

test('getFilledBugSummary regressions and reassigned to other summary', async () => {
  const result = getFilledBugSummary(
    testAlertSummaryRegressionsAndReassignedToOther,
  );
  expect(result).toBe(
    '5% MySuite regression on 19 March 2021',
  );
});

test('getFilledBugSummary one regression', async () => {
  const result = getFilledBugSummary(testAlertSummaryWithOneRegression);
  expect(result).toBe(
    '5% MySuite regression on 19 March 2021',
  );
});

test('getFilledBugSummary rounds like the comment 0 table', () => {
  const alertSummary = JSON.parse(JSON.stringify(testAlertSummaryWithOneRegression));
  const regression = alertSummary.alerts.find((alert) => alert.is_regression);
  // rounds to 0%, so it keeps two decimals like the table does
  regression.amount_pct = 0.4;

  expect(getFilledBugSummary(alertSummary)).toBe(
    '0.40% MySuite regression on 19 March 2021',
  );
});

describe('getAcknowledgeByDate', () => {
  // noon local time, so the day never shifts with the timezone
  const filedOn = (day) => new Date(`${day}T12:00:00`);

  test('is three business days after the bug is filed', () => {
    expect(getAcknowledgeByDate(filedOn('2026-09-21'))).toBe(
      'Thu September 24 2026',
    );
  });

  test('skips the weekend', () => {
    // Wednesday and Friday filings run over a weekend
    expect(getAcknowledgeByDate(filedOn('2026-09-23'))).toBe(
      'Mon September 28 2026',
    );
    expect(getAcknowledgeByDate(filedOn('2026-09-25'))).toBe(
      'Wed September 30 2026',
    );
    // filed over the weekend, it counts from Monday
    expect(getAcknowledgeByDate(filedOn('2026-09-26'))).toBe(
      'Wed September 30 2026',
    );
    expect(getAcknowledgeByDate(filedOn('2026-09-27'))).toBe(
      'Wed September 30 2026',
    );
  });
});

describe('formatPushDescription', () => {
  const revision = '99f6d3d31f06a8a7c9e1b2d3e4f5a6b7c8d9e0f1';
  const pushLog = 'https://hg.mozilla.org/integration/autoland/pushloghtml?changeset=99f6d3d31f06';
  const commit = (title, rev = `${title.length}`.padEnd(40, '0')) => ({
    revision: rev,
    comments: `${title}\n\nDifferential Revision: https://phabricator.services.mozilla.com/D1`,
  });
  const tipCommit = commit('Bug 2072102 - Update application-services', revision);

  test('lists a single commit under a bullet point', () => {
    expect(formatPushDescription(revision, pushLog, [tipCommit])).toBe(
      `[push 99f6d3d31f06](${pushLog}), which contains 1 commit:\n\n` +
        '- Bug 2072102 - Update application-services',
    );
  });

  test('lists every commit title when the push has several', () => {
    expect(
      formatPushDescription(revision, pushLog, [
        commit('Bug 2071389 - Fix MozAdsEnvironment names, r=mconley'),
        tipCommit,
      ]),
    ).toBe(
      `[push 99f6d3d31f06](${pushLog}), which contains 2 commits:\n\n` +
        '- Bug 2072102 - Update application-services\n' +
        '- Bug 2071389 - Fix MozAdsEnvironment names, r=mconley',
    );
  });

  test('lists at most ten commits and links the rest to the push log', () => {
    const commits = [
      tipCommit,
      ...Array.from({ length: 12 }, (_, i) =>
        commit(`Bug ${i + 1} - Change ${i + 1}`, `${i}`.padEnd(40, 'a')),
      ),
    ];
    const lines = formatPushDescription(revision, pushLog, commits).split('\n');

    expect(lines[0]).toBe(
      `[push 99f6d3d31f06](${pushLog}), which contains 13 commits:`,
    );
    expect(lines.filter((line) => line.startsWith('- Bug'))).toHaveLength(10);
    expect(lines[lines.length - 1]).toBe(
      `- _... and 3 more commits in the [push log](${pushLog})_`,
    );
  });

  test('lists all commits when there are ten or fewer', () => {
    const commits = [
      tipCommit,
      ...Array.from({ length: 8 }, (_, i) =>
        commit(`Bug ${i + 1} - Change ${i + 1}`, `${i}`.padEnd(40, 'a')),
      ),
    ];
    const lines = formatPushDescription(revision, pushLog, commits).split('\n');

    expect(lines.filter((line) => line.startsWith('- Bug'))).toHaveLength(9);
    expect(lines.some((line) => line.includes('more commit'))).toBe(false);
  });

  test('falls back to the revision when commits are unavailable', () => {
    expect(formatPushDescription(revision, pushLog)).toBe(
      `push [${revision}](${pushLog}).`,
    );
    expect(
      formatPushDescription(revision, pushLog, [{ revision, comments: '' }]),
    ).toBe(`push [${revision}](${pushLog}).`);
  });
});

test('getResultsMap returns the right signatures when the key is identical', () => {
  expect(getResultsMap([signatureWithValues, signatureWithoutValues])).toEqual(
    result,
  );
  expect(getResultsMap([signatureWithoutValues, signatureWithValues])).toEqual(
    result,
  );
});
