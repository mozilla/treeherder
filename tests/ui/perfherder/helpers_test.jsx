import { getTitle } from '../../../ui/perfherder/helpers';

const alertSummaryInput = {
  id: 29117,
  repository: 'autoland',
  status: 0,
  alerts: [
    {
      id: 114629,
      status: 0,
      series_signature: {
        id: 2845628,
        machine_platform: 'windows7-64',
        suite: 'MySuite',
        test: 'Test1',
      },
      is_regression: true,
      amount_pct: 13.23,
      summary_id: 29117,
    },
    {
      id: 114630,
      status: 0,
      series_signature: {
        id: 2845628,
        machine_platform: 'windows7-64',
        suite: 'MySuite',
        test: 'Test2',
      },
      is_regression: true,
      amount_pct: 17.9,
      summary_id: 29117,
    },
    {
      id: 114631,
      status: 0,
      series_signature: {
        id: 2845628,
        machine_platform: 'android-4-0-armv7-api15',
        suite: 'MySuite',
        test: 'Test3',
      },
      is_regression: true,
      amount_pct: 1.03,
      summary_id: 29117,
    },
    {
      id: 114632,
      status: 0,
      series_signature: {
        id: 2845632,
        machine_platform: 'macosx1014-64-qr',
        suite: 'MySuite',
        test: 'Test4',
      },
      is_regression: true,
      amount_pct: 3.02,
      summary_id: 29117,
    },
  ],
};

test('getTitle', async () => {
  const result = getTitle(alertSummaryInput);
  expect(result).toBe(
    '17.9 - 1.03% MySuite Test2 / MySuite Test3 + 2 more (Android, OSX, Windows)',
  );
});
