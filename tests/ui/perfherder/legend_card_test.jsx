import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

import LegendCard from '../../../ui/perfherder/graphs/LegendCard';
import {
  graphSymbols,
  unknownFrameworkMessage,
} from '../../../ui/perfherder/perf-helpers/constants';

const testData = [
  {
    color: ['brown', '#b87e17'],
    data: [],
    framework_id: 1,
    id: 'mozilla-central ts_paint_flex opt e10s stylo',
    lowerIsBetter: true,
    name: 'ts_paint_flex opt e10s stylo',
    parentSignature: null,
    platform: 'linux64',
    projectId: 1,
    repository_name: 'mozilla-central',
    application: 'firefox',
    resultSetData: [],
    signatureHash: '9c0028a9c871b51c8296485c8fc09b21fe41eec0',
    signature_id: 1647493,
    visible: true,
    suite: 'tp5o_webext',
    shouldAlert: null,
    alertChangeType: 1,
    alertThreshold: 2.0,
  },
  {
    color: ['darkorchid', '#9932cc'],
    data: [],
    framework_id: 13,
    id: 'mozilla-central raptor-tp6-amazon-firefox opt',
    lowerIsBetter: true,
    name: 'raptor-tp6-amazon-firefox opt ',
    parentSignature: null,
    platform: 'linux64',
    projectId: 1,
    repository_name: 'mozilla-central',
    resultSetData: [],
    signatureHash: '554cc85b904ede676c691b65bbe19911c7320718',
    signature_id: 2146210,
    visible: true,
    suite: 'tp5o_webext',
    shouldAlert: null,
    alertChangeType: 1,
    alertThreshold: 2.0,
  },
];

const colors = [
  ['darkorchid', '#9932cc'],
  ['blue', '#1752b8'],
];

const legendCard = (
  series,
  testData,
  updateState = () => {},
  updateStateParams = () => {},
) =>
  render(
    <LegendCard
      series={series}
      testData={testData}
      frameworks={[{ id: 1, name: 'talos' }]}
      updateState={updateState}
      updateStateParams={updateStateParams}
      colors={colors}
      symbols={graphSymbols}
    />,
  );

afterEach(cleanup);

test('legend card displays the framework badge', async () => {
  const { queryByText } = legendCard(testData[0], testData);

  const frameworkBadge = await waitFor(() => queryByText('talos'));
  expect(frameworkBadge).toBeInTheDocument();
});

test('legend card with incorrect framework displays the unknown framework badge message', async () => {
  const { queryByText } = legendCard(testData[1], testData);

  const frameworkBadge = await waitFor(() =>
    queryByText(unknownFrameworkMessage),
  );
  expect(frameworkBadge).toBeInTheDocument();
});

test('legend card displays the application badge', async () => {
  const updateStateMock = jest.fn();
  const { queryByText } = legendCard(testData[0], testData, updateStateMock);

  const applicationBtn = await waitFor(() => queryByText('firefox'));
  expect(applicationBtn).toBeInTheDocument();
});

test('click on legend card displays the Test Data Modal', async () => {
  const updateStateMock = jest.fn();
  const { queryByText } = legendCard(testData[0], testData, updateStateMock);

  const applicationBtn = await waitFor(() => queryByText('firefox'));
  fireEvent.click(applicationBtn);

  expect(updateStateMock.mock.calls).toHaveLength(1);
  expect(updateStateMock.mock.calls[0][0]).toStrictEqual({
    options: { option: 'addRelatedApplications', relatedSeries: testData[0] },
    showModal: true,
  });
});

test('legend card displays the shouldAlert value', async () => {
  const { queryByText } = legendCard(testData[0], testData);

  const shouldAlert = await waitFor(() => queryByText('should_alert: true'));
  const alertChangeType = await waitFor(() =>
    queryByText('alert_change_type: absolute'),
  );
  const alertThreshold = await waitFor(() => queryByText('alert_threshold: 2'));

  expect(shouldAlert).toBeInTheDocument();
  expect(alertChangeType).toBeInTheDocument();
  expect(alertThreshold).toBeInTheDocument();
});

test('legend card closes when pressing x', async () => {
  const updateStateMock = jest.fn();
  const updateStateParamsMock = jest.fn();
  const { getByTestId } = legendCard(
    testData[0],
    testData,
    updateStateMock,
    updateStateParamsMock,
  );

  const closeButton = await waitFor(() => getByTestId('remove-test-button'));

  fireEvent.click(closeButton);
  expect(updateStateParamsMock).toHaveBeenCalled();
});

test('legend card checkbox can be unchecked to hide series', async () => {
  const updateStateMock = jest.fn();
  const updateStateParamsMock = jest.fn();
  const { getByTitle } = legendCard(
    testData[0],
    testData,
    updateStateMock,
    updateStateParamsMock,
  );

  const input = await waitFor(() => getByTitle('Show/Hide series'));

  expect(input).toHaveProperty('checked', true);

  fireEvent.click(input);

  expect(updateStateParamsMock).toHaveBeenCalled();
});
