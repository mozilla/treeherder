import React from 'react';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';

import TimeRangeDropdown from '../../../../ui/perfherder/graphs/TimeRangeDropdown';

const updateTimeRange = jest.fn();

const timeRangeDropdown = () =>
  render(
    <TimeRangeDropdown
      timeRangeText="Last 14 days"
      updateTimeRange={updateTimeRange}
    />,
  );

afterEach(() => {
  updateTimeRange.mockClear();
  cleanup();
});

describe('Selecting different dropdown items in TimeRangeDropdown', () => {
  test('Dropdown can be opened and item selected', async () => {
    const { getByText } = timeRangeDropdown();

    const dropdownToggle = await waitFor(() => getByText('Last 14 days'));
    fireEvent.click(dropdownToggle);

    const anotherItem = await waitFor(() => getByText('Last 60 days'));
    fireEvent.click(anotherItem);

    // Component is controlled, so text won't change until parent re-renders
    // Check that the callback was called with correct values
    expect(updateTimeRange).toHaveBeenCalledWith({
      value: 5184000,
      text: 'Last 60 days',
    });
  });

  test('TimeRangeDropdown calls back with correct time range', async () => {
    const { getByText } = timeRangeDropdown();

    const dropdownToggle = await waitFor(() => getByText('Last 14 days'));
    fireEvent.click(dropdownToggle);

    const anotherItem = await waitFor(() => getByText('Last 60 days'));
    fireEvent.click(anotherItem);

    expect(updateTimeRange).toHaveBeenCalledWith({
      value: 5184000,
      text: 'Last 60 days',
    });
  });
});
