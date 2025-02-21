import React from 'react';
import { render, waitFor } from '@testing-library/react';

import testAlertSummaries from '../../mock/alert_summaries';
import Magnitude from '../../../../ui/perfherder/alerts/Magnitude';

const testAlertSummary = testAlertSummaries[0];
const testAlert = testAlertSummary.alerts[0];

testAlert.prev_value = 1383.38;
testAlert.new_value = 1211.78;

const magnitude = () => {
  return render(<Magnitude alert={testAlert} />);
};

test('Previous value is abbreviated', async () => {
  const { getByTestId } = magnitude();

  const previousValue = await waitFor(() => getByTestId('previous-value'));

  expect(previousValue.textContent).toBe('1.4K');
});

test('New value is abbreviated', async () => {
  const { getByTestId } = magnitude();

  const newValue = await waitFor(() => getByTestId('new-value'));

  expect(newValue.textContent).toBe('1.2K');
});
