import {
  displayNumber,
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
    '10.67 - 2.53% MySuite Test3 + 3 more (Android, OSX) regression on Fri March 19 2021',
  );
});

test('getFilledBugSummary improvements only', async () => {
  const result = getFilledBugSummary(testAlertSummaryImprovementsOnly);
  expect(result).toBe(
    '10.67 - 2.53% MySuite Test3 + 4 more (Android, Linux, OSX) regression on Fri March 19 2021',
  );
});

test('getFilledBugSummary invalid regressions', async () => {
  const result = getFilledBugSummary(testAlertSummaryInvalidRegressions);
  expect(result).toBe(
    '10.67 - 2.75% MySuite Test3 + 3 more (Linux, OSX) regression on Fri March 19 2021',
  );
});

test('getFilledBugSummary regressions and improvements', async () => {
  const result = getFilledBugSummary(
    testAlertSummaryRegressionsAndImprovements,
  );
  expect(result).toBe(
    '4.58 - 2.75% MySuite Test2 + 2 more (Linux, OSX) regression on Fri March 19 2021',
  );
});

test('getFilledBugSummary regressions and reassigned', async () => {
  const result = getFilledBugSummary(testAlertSummaryRegressionsAndReassigned);
  expect(result).toBe(
    '10.67 - 2.53% MySuite Test3 + 4 more (Android, Linux, OSX) regression on Fri March 19 2021',
  );
});

test('getFilledBugSummary regressions and reassigned to other summary', async () => {
  const result = getFilledBugSummary(
    testAlertSummaryRegressionsAndReassignedToOther,
  );
  expect(result).toBe(
    '4.58 - 2.53% MySuite Test2 + 2 more (Android, Linux, OSX) regression on Fri March 19 2021',
  );
});

test('getFilledBugSummary one regression', async () => {
  const result = getFilledBugSummary(testAlertSummaryWithOneRegression);
  expect(result).toBe(
    '4.58% MySuite Test2 (Linux) regression on Fri March 19 2021',
  );
});

test('getResultsMap returns the right signatures when the key is identical', () => {
  expect(getResultsMap([signatureWithValues, signatureWithoutValues])).toEqual(
    result,
  );
  expect(getResultsMap([signatureWithoutValues, signatureWithValues])).toEqual(
    result,
  );
});
