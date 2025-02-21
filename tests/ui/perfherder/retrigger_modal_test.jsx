import { cleanup, render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import RetriggerModal from '../../../ui/perfherder/compare/RetriggerModal';

const retriggerRowMock = {
  originalRetriggerableJobId: 20,
  newRetriggerableJobId: 1,
};

const retriggerModal = (
  updateAndClose = () => {},
  isBaseAggregate = false,
  toggle = () => {},
  showModal = true,
  currentRetriggerRow = retriggerRowMock,
) => {
  const props = {
    showModal,
    toggle,
    updateAndClose,
    isBaseAggregate,
    currentRetriggerRow,
  };
  return render(<RetriggerModal {...props} />);
};

afterEach(cleanup);

test('clicking retrigger button sends correct values from inputs', async () => {
  const updateAndCloseMock = jest.fn();
  const { getByText } = retriggerModal(updateAndCloseMock);

  const retriggerButton = await waitFor(() => getByText('Retrigger'));

  fireEvent.click(retriggerButton);

  expect(updateAndCloseMock.mock.calls).toHaveLength(1);
  const sentParameters = updateAndCloseMock.mock.calls[0][1];

  expect(sentParameters.baseRetriggerTimes).toBe(5);
  expect(sentParameters.newRetriggerTimes).toBe(5);
});

test('If base revision is aggregate base input should be disabled', async () => {
  const updateAndCloseMock = jest.fn();
  const { getByText, getByTestId } = retriggerModal(updateAndCloseMock, true);

  const retriggerButton = await waitFor(() => getByText('Retrigger'));
  const baseInput = getByTestId('input baseRetriggerTimes');

  expect(baseInput).toBeDisabled();
  fireEvent.click(retriggerButton);

  expect(updateAndCloseMock.mock.calls).toHaveLength(1);
  const sentParameters = updateAndCloseMock.mock.calls[0][1];

  expect(sentParameters.baseRetriggerTimes).toBe(0);
  expect(sentParameters.newRetriggerTimes).toBe(5);
});

test('Invalid value disables retrigger button', async () => {
  const { getByText, getByTestId } = retriggerModal();
  const baseInput = getByTestId('input baseRetriggerTimes');
  const retriggerButton = await waitFor(() => getByText('Retrigger'));
  expect(retriggerButton).not.toBeDisabled();

  fireEvent.change(baseInput, { target: { value: 100 } });
  expect(retriggerButton).toBeDisabled();

  fireEvent.change(baseInput, { target: { value: -10 } });
  expect(retriggerButton).toBeDisabled();

  fireEvent.change(baseInput, { target: { value: '%$#%' } });
  expect(retriggerButton).toBeDisabled();
});
