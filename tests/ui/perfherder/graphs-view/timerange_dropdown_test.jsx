import React from 'react';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';

import testAlertSummary from '../../mock/alert_summary_with_different_status';
import SelectAlertsDropdown from '../../../../ui/perfherder/alerts/SelectAlertsDropdown';
import { alertStatusMap } from '../../../../ui/perfherder/constants';
import { getStatus } from '../../../../ui/perfherder/helpers';
import TimeRangeDropdown from '../../../../ui/perfherder/graphs/TimeRangeDropdown';

const testUser = ({ isLoggedIn, isStaff }) => ({
  username: 'mozilla-ldap/test_user@mozilla.com',
  isLoggedIn,
  isStaff,
  email: 'test_user@mozilla.com',
});

afterEach(cleanup);

const updateTimeRange = jest.fn();

const timeRangeDropdown = () =>
  render(
    <TimeRangeDropdown
      timeRangeText="Last 14 days"
      updateTimeRange={updateTimeRange}
    />,
  );

test('Selecting different dropdown items calls back with new time range', async () => {
  const { getByLabelText, getByText } = timeRangeDropdown();

  const dropdownMenu = await waitFor(() => getByLabelText('Time range'));
  fireEvent.click(dropdownMenu);

  const anotherItem = await waitFor(() => getByText('Last 60 days'));
  fireEvent.click(anotherItem);

  expect(dropdownMenu).toHaveTextContent('Last 60 days');
  expect(updateTimeRange).toHaveBeenCalledWith({
    value: 5184000,
    text: 'Last 60 days',
  });
});
