import {
  displayNumber,
  getFilledBugSummary,
} from '../../../ui/perfherder/perf-helpers/helpers';
import { getRevisionUrl } from '../../../ui/helpers/url';
import testAlertSummaryImprovementsOnly from '../perfherder/filled_bug_alerts/alert_summary_improvements_only';
import testAlertSummaryDownstreamRegressions from '../perfherder/filled_bug_alerts/alert_summary_downstream_regressions';
import testAlertSummaryRegressionsAndImprovements from '../perfherder/filled_bug_alerts/alert_summary_regressions_and_improvements';
import testAlertSummaryInvalidRegressions from '../perfherder/filled_bug_alerts/alert_summary_invalid_regressions';
import testAlertSummaryWithOneRegression from '../perfherder/filled_bug_alerts/alert_summary_with_one_regression';
import testAlertSummaryRegressionsAndReassigned from '../perfherder/filled_bug_alerts/alert_summary_regressions_and_reassigned';
import testAlertSummaryRegressionsAndReassignedToOther from '../perfherder/filled_bug_alerts/alert_summary_regressions_and_reassigned_to_other';

describe('getRevisionUrl helper', () => {
  test('escapes some html symbols', () => {
    expect(getRevisionUrl('1234567890ab', 'mozilla-inbound')).toEqual(
      '/jobs?repo=mozilla-inbound&revision=1234567890ab',
    );
  });
});

describe('displayNumber helper', () => {
  test('returns expected values', () => {
    expect(displayNumber('123.53222')).toEqual('123.53');
    expect(displayNumber('123123123.53222')).toEqual('123123123.53');
    expect(displayNumber(1 / 0)).toEqual('Infinity');
    expect(displayNumber(Number.NaN)).toEqual('N/A');
  });
});

test('getFilledBugSummary downstream regressions', async () => {
  const result = getFilledBugSummary(testAlertSummaryDownstreamRegressions);
  expect(result).toBe(
    '10.67 - 2.53% MySuite Test3 / MySuite Test4 + 2 more (Android, OSX) regression on Fri March 19 2021',
  );
});

test('getFilledBugSummary improvements only', async () => {
  const result = getFilledBugSummary(testAlertSummaryImprovementsOnly);
  expect(result).toBe(
    '10.67 - 2.53% MySuite Test3 / MySuite Test4 + 3 more (Android, Linux, OSX) regression on Fri March 19 2021',
  );
});

test('getFilledBugSummary invalid regressions', async () => {
  const result = getFilledBugSummary(testAlertSummaryInvalidRegressions);
  expect(result).toBe(
    '10.67 - 2.75% MySuite Test3 / MySuite Test1 + 2 more (Linux, OSX) regression on Fri March 19 2021',
  );
});

test('getFilledBugSummary regressions and improvements', async () => {
  const result = getFilledBugSummary(
    testAlertSummaryRegressionsAndImprovements,
  );
  expect(result).toBe(
    '4.58 - 2.75% MySuite Test2 / MySuite Test1 + 1 more (Linux, OSX) regression on Fri March 19 2021',
  );
});

test('getFilledBugSummary regressions and reassigned', async () => {
  const result = getFilledBugSummary(testAlertSummaryRegressionsAndReassigned);
  expect(result).toBe(
    '10.67 - 2.53% MySuite Test3 / MySuite Test4 + 3 more (Android, Linux, OSX) regression on Fri March 19 2021',
  );
});

test('getFilledBugSummary regressions and reassigned to other summary', async () => {
  const result = getFilledBugSummary(
    testAlertSummaryRegressionsAndReassignedToOther,
  );
  expect(result).toBe(
    '4.58 - 2.53% MySuite Test2 / MySuite Test4 + 1 more (Android, Linux, OSX) regression on Fri March 19 2021',
  );
});

test('getFilledBugSummary one regression', async () => {
  const result = getFilledBugSummary(testAlertSummaryWithOneRegression);
  expect(result).toBe(
    '4.58% MySuite Test2 (Linux) regression on Fri March 19 2021',
  );
});
