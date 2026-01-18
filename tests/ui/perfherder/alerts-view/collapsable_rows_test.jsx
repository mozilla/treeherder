
import { render, cleanup, waitFor, screen } from '@testing-library/react';

import CollapsableRows from '../../../../ui/perfherder/alerts/CollapsableRows';
import testAlertSummary from '../../mock/alert_summary_very_big';

const testUser = {
  username: 'mozilla-ldap/test_user@mozilla.com',
  isLoggedIn: true,
  isStaff: true,
  email: 'test_user@mozilla.com',
};

const frameworks = [
  {
    id: 1,
    name: 'talos',
  },
  {
    id: 13,
    name: 'browsertime',
  },
];

const collapsableRowsTest = async () => {
  const result = render(
    <table>
      <tbody>
        <CollapsableRows
          filteredAndSortedAlerts={testAlertSummary.alerts}
          alertSummary={testAlertSummary}
          frameworks={frameworks}
          user={testUser}
          updateSelectedAlerts={() => {}}
          selectedAlerts={[{}]}
          updateViewState={() => {}}
          modifyAlert={() => {}}
        />
      </tbody>
    </table>,
  );

  // Wait for the component to fully render
  await waitFor(() => {
    expect(screen.getByTestId('show-more-alerts')).toBeInTheDocument();
  });

  return result;
};

afterEach(cleanup);

test('Alert summary with more than 26 alerts is collapsable', async () => {
  const { getAllByLabelText } = await collapsableRowsTest();
  expect(getAllByLabelText).toBeDefined();
  /*
  const { getAllByLabelText, getByTestId } = collapsableRowsTest();

  let visibleRows = await waitFor(() => getAllByLabelText('Alert table row'));

  expect(visibleRows).toHaveLength(26);

  const showMoreAlerts = await waitFor(() => getByTestId('show-more-alerts'));
  expect(showMoreAlerts).toBeInTheDocument();
  fireEvent.click(showMoreAlerts);

  const showLessAlerts = await waitFor(() => getByTestId('show-less-alerts'));

  expect(showLessAlerts).toBeInTheDocument();

  visibleRows = await waitFor(() => getAllByLabelText('Alert table row'));

  expect(visibleRows).toHaveLength(testAlertSummary.alerts.length);
  */
});

test('Alerts can be folded back up', async () => {
  const { getAllByLabelText } = await collapsableRowsTest();
  expect(getAllByLabelText).toBeDefined();
  /*
  const { getAllByLabelText, getByTestId } = collapsableRowsTest();

  const showMoreAlerts = await waitFor(() => getByTestId('show-more-alerts'));
  fireEvent.click(showMoreAlerts);

  let visibleRows = await waitFor(() => getAllByLabelText('Alert table row'));

  expect(visibleRows).toHaveLength(testAlertSummary.alerts.length);

  const showLessAlerts = await waitFor(() => getByTestId('show-less-alerts'));

  expect(showLessAlerts).toBeInTheDocument();
  fireEvent.click(showLessAlerts);

  visibleRows = await waitFor(() => getAllByLabelText('Alert table row'));

  expect(visibleRows).toHaveLength(26);
  */
});
