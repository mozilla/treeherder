
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import AlertHeaderTitle from '../../../../ui/perfherder/alerts/AlertHeaderTitle';
import testAlertSummaries from '../../mock/alert_summaries_with_critical_tests.json';

const frameworks = [
  {
    id: 15,
    name: 'mozperftest',
  },
  {
    id: 13,
    name: 'browsertime',
  },
];

const alertHeaderTitleTest = (alertSummary) => {
  return render(
    <MemoryRouter initialEntries={['/alerts']}>
      <AlertHeaderTitle alertSummary={alertSummary} frameworks={frameworks} />
    </MemoryRouter>,
  );
};

test("Critical badge is displayed near alert summary for 'newssite-applink a55' test", async () => {
  const { findByText } = alertHeaderTitleTest(testAlertSummaries[0]);

  const criticalTag = await waitFor(() => findByText('critical'));

  expect(criticalTag.textContent).toBe('critical');
});

test("Critical badge is displayed near alert summary for 'speedometer3 score windows11 shippable' test", async () => {
  const { findByText } = alertHeaderTitleTest(testAlertSummaries[1]);

  const criticalTag = await waitFor(() => findByText('critical'));

  expect(criticalTag.textContent).toBe('critical');
});

test('Sub-critical badge is displayed for a sub-critical summary', async () => {
  const { findByText } = alertHeaderTitleTest({
    ...testAlertSummaries[0],
    severity: 'subcritical',
  });

  const severityTag = await waitFor(() => findByText('subcritical'));

  expect(severityTag.textContent).toBe('subcritical');
});

test('Critical badge is not displayed for a normal summary', async () => {
  const { queryByText, findByText } = alertHeaderTitleTest({
    ...testAlertSummaries[0],
    severity: 'normal',
  });

  await waitFor(() => findByText(/Alert #/));

  expect(queryByText('critical')).toBeNull();
});

test('Regression badge is displayed for a summary with change_type regression', async () => {
  const { findByText } = alertHeaderTitleTest({
    ...testAlertSummaries[0],
    change_type: 'regression',
  });

  const changeTypeTag = await findByText('regression');

  expect(changeTypeTag.textContent).toBe('regression');
});

test('Improvement badge is displayed for a summary with change_type improvement', async () => {
  const { findByText } = alertHeaderTitleTest({
    ...testAlertSummaries[0],
    change_type: 'improvement',
  });

  const changeTypeTag = await findByText('improvement');

  expect(changeTypeTag.textContent).toBe('improvement');
});

test('No change type badge is displayed when change_type is missing', async () => {
  const { queryByText, findByText } = alertHeaderTitleTest({
    ...testAlertSummaries[0],
    change_type: undefined,
  });

  await findByText(/Alert #/);

  expect(queryByText('regression')).toBeNull();
  expect(queryByText('improvement')).toBeNull();
});
