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
  let dropdownMenu;

  beforeEach(async () => {
    const { getByLabelText, getByText } = timeRangeDropdown();

    dropdownMenu = await waitFor(() => getByLabelText('Time range'));
    fireEvent.click(dropdownMenu);

    const anotherItem = await waitFor(() => getByText('Last 60 days'));
    fireEvent.click(anotherItem);
  });

  test('Menu updates to new item', async () => {
    expect(dropdownMenu).toHaveTextContent('Last 60 days');
  });

  test('TimeRangeDropdown calls back with correct time range', async () => {
    expect(updateTimeRange).toHaveBeenCalledWith({
      value: 5184000,
      text: 'Last 60 days',
    });
  });
});
