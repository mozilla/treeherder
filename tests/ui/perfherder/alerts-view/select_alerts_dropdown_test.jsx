import React from 'react';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';

import testAlertSummary from '../../mock/alert_summary_with_different_status';
import SelectAlertsDropdown from '../../../../ui/perfherder/alerts/SelectAlertsDropdown';
import { alertStatusMap } from '../../../../ui/perfherder/perf-helpers/constants';
import { getStatus } from '../../../../ui/perfherder/perf-helpers/helpers';

const testUser = ({ isLoggedIn, isStaff }) => ({
  username: 'mozilla-ldap/test_user@mozilla.com',
  isLoggedIn,
  isStaff,
  email: 'test_user@mozilla.com',
});

afterEach(cleanup);

const setSelectedAlertsHandler = jest.fn();

const selectAlertsDropdown = (user) => {
  return render(
    <SelectAlertsDropdown
      setSelectedAlerts={setSelectedAlertsHandler}
      user={user}
      filteredAlerts={testAlertSummary.alerts}
      allSelected={false}
      alertSummary={testAlertSummary}
    />,
    { legacyRoot: true },
  );
};

test('Select alerts dropdown toggle is disabled when user is not staff', async () => {
  const { getByLabelText } = selectAlertsDropdown(
    testUser({ isLoggedIn: true, isStaff: false }),
  );

  const dropdownToggle = await waitFor(() =>
    getByLabelText('alert selection options'),
  );

  expect(dropdownToggle).toBeDisabled();
});

test('Select alerts dropdown toggle is enabled when user is staff', async () => {
  const { getByLabelText } = selectAlertsDropdown(
    testUser({ isLoggedIn: true, isStaff: true }),
  );

  const dropdownToggle = await waitFor(() =>
    getByLabelText('alert selection options'),
  );

  expect(dropdownToggle).toBeEnabled();
});

test("Selecting 'All' option from dropdown checks all the visible alerts", async () => {
  const { getByLabelText, getByText } = selectAlertsDropdown(
    testUser({ isLoggedIn: true, isStaff: true }),
  );

  const dropdownToggle = await waitFor(() =>
    getByLabelText('alert selection options'),
  );

  fireEvent.click(dropdownToggle);

  const option = await waitFor(() => getByText('All'));

  fireEvent.click(option);

  const selectedAlerts = [...testAlertSummary.alerts];
  const state = { selectedAlerts, allSelected: true };

  expect(setSelectedAlertsHandler).toHaveBeenCalledTimes(1);

  expect(setSelectedAlertsHandler).toHaveBeenCalledWith(state);
});

test("Selecting 'None' option from dropdown unchecks all checked alerts from the visible alerts", async () => {
  const { getByLabelText, getByText } = selectAlertsDropdown(
    testUser({ isLoggedIn: true, isStaff: true }),
  );

  const dropdownToggle = await waitFor(() =>
    getByLabelText('alert selection options'),
  );

  fireEvent.click(dropdownToggle);

  let option = await waitFor(() => getByText('All'));

  fireEvent.click(option);

  option = await waitFor(() => getByText('None'));

  fireEvent.click(option);

  const selectedAlerts = [];
  const state = { selectedAlerts, allSelected: false };

  expect(setSelectedAlertsHandler).toHaveBeenCalledWith(state);
});

test("Selecting 'Triaged' option from dropdown checks the visible alerts that are triaged", async () => {
  const { getByLabelText, getByText } = selectAlertsDropdown(
    testUser({ isLoggedIn: true, isStaff: true }),
  );

  const dropdownToggle = await waitFor(() =>
    getByLabelText('alert selection options'),
  );

  fireEvent.click(dropdownToggle);

  const option = await waitFor(() => getByText('Triaged'));

  fireEvent.click(option);

  const selectedAlerts = testAlertSummary.alerts.filter(
    (alert) => getStatus(alert.status, alertStatusMap) !== 'untriaged',
  );
  const state = { selectedAlerts, allSelected: false };

  expect(setSelectedAlertsHandler).toHaveBeenCalledWith(state);
});

test("Selecting 'Untriaged' option from dropdown checks the visible alerts that are untriaged", async () => {
  const { getByLabelText, getByText } = selectAlertsDropdown(
    testUser({ isLoggedIn: true, isStaff: true }),
  );

  const dropdownToggle = await waitFor(() =>
    getByLabelText('alert selection options'),
  );

  fireEvent.click(dropdownToggle);

  const option = await waitFor(() => getByText('Untriaged'));

  fireEvent.click(option);

  const selectedAlerts = testAlertSummary.alerts.filter(
    (alert) => getStatus(alert.status, alertStatusMap) === 'untriaged',
  );
  const state = { selectedAlerts, allSelected: false };

  expect(setSelectedAlertsHandler).toHaveBeenCalledWith(state);
});
