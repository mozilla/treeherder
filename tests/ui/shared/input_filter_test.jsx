import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';

import InputFilter from '../../../ui/shared/InputFilter';

const testPlaceholder = 'test placeholder';

const inputFilter = (
  updateOnEnter = false,
  updateFilterText = () => {},
  disabled = false,
) =>
  render(
    <InputFilter
      updateFilterText={updateFilterText}
      updateOnEnter={updateOnEnter}
      disabled={disabled}
      placeholder={testPlaceholder}
    />,
  );

afterEach(cleanup);

test('input filter updates only on enter', async () => {
  const updateFilterTextMock = jest.fn();
  const { getByPlaceholderText } = inputFilter(true, updateFilterTextMock);

  const filterInput = getByPlaceholderText(testPlaceholder);

  fireEvent.change(filterInput, { target: { value: 'test text' } });
  expect(updateFilterTextMock).toHaveBeenCalledTimes(0);

  fireEvent.change(filterInput, { target: { value: 'test text 2' } });
  expect(updateFilterTextMock).toHaveBeenCalledTimes(0);

  fireEvent.keyDown(filterInput, { key: 'Enter' });

  expect(updateFilterTextMock).toHaveBeenCalledTimes(1);
  expect(updateFilterTextMock.mock.calls[0][0]).toBe('test text 2');
});

// eslint-disable-next-line jest/no-test-callback
test('input filter updates on every change', async done => {
  const updateFilterTextMock = jest.fn();
  const { getByPlaceholderText } = inputFilter(false, updateFilterTextMock);

  const filterInput = getByPlaceholderText(testPlaceholder);

  fireEvent.change(filterInput, { target: { value: 'test text' } });
  setTimeout(async () => {
    expect(updateFilterTextMock).toHaveBeenCalledTimes(1);
    done();
  }, 1000);
});

test('input filter can be disabled', async () => {
  const { getByPlaceholderText } = inputFilter(false, () => {}, true);

  const filterInput = getByPlaceholderText(testPlaceholder);
  expect(filterInput).toBeDisabled();
});
