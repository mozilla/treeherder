import { getFilledBugSummary } from '../../../ui/perfherder/helpers';

const alertSummaryInput = {
  id: 12345,
  framework: 6,
  alerts: [
    {
      id: 116590,
      status: 0,
      series_signature: {
        id: 2845686,
        framework_id: 6,
        signature_hash: '1a1e2bc4aa183f250e67cb19a5abc543666fcb9c',
        machine_platform: 'macosx1014-64-qr',
        suite: 'MySuite',
        test: 'Test1',
        lower_is_better: true,
        has_subtests: false,
      },
      is_regression: false,
      amount_pct: 2.75,
      summary_id: 12345,
      related_summary_id: null,
      manually_created: false,
      title: 'MySuite Test1',
    },
    {
      id: 116590,
      status: 0,
      series_signature: {
        id: 2845686,
        framework_id: 6,
        signature_hash: '1a1e2bc4aa183f250e67cb19a5abc543666fcb9c',
        machine_platform: 'linux1014-64-qr',
        suite: 'MySuite',
        test: 'Test2',
        lower_is_better: true,
        has_subtests: false,
      },
      is_regression: false,
      amount_pct: 1.43,
      summary_id: 12345,
      related_summary_id: null,
      manually_created: false,
      title: 'MySuite Test2',
    },
    {
      id: 116590,
      status: 0,
      series_signature: {
        id: 2845686,
        framework_id: 6,
        signature_hash: '1a1e2bc4aa183f250e67cb19a5abc543666fcb9c',
        machine_platform: 'android-4-0-armv7-api15',
        suite: 'MySuite',
        test: 'Test3',
        lower_is_better: true,
        has_subtests: false,
      },
      is_regression: false,
      amount_pct: 6.35,
      summary_id: 12345,
      related_summary_id: null,
      manually_created: false,
      title: 'MySuite Test3',
    },
    {
      id: 116590,
      status: 0,
      series_signature: {
        id: 2845686,
        framework_id: 6,
        signature_hash: '1a1e2bc4aa183f250e67cb19a5abc543666fcb9c',
        machine_platform: 'windows7-64',
        suite: 'MySuite',
        test: 'Test4',
        lower_is_better: true,
        has_subtests: false,
      },
      is_regression: false,
      amount_pct: 20.12,
      summary_id: 12345,
      related_summary_id: 12346,
      manually_created: false,
      title: 'MySuite Test4',
    },
  ],
  status: 0,
};

test('getFilledBugSummary', async () => {
  const result = getFilledBugSummary(alertSummaryInput);
  expect(result).toBe(
    '6.35 - 1.43% MySuite Test3 / MySuite Test2 + 1 more (Android, Linux, OSX)',
  );
});
