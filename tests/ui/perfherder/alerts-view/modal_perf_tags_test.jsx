import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';

import TagsModal from '../../../../ui/perfherder/alerts/TagsModal';
import testPerformanceTags from '../../mock/performance_tags';
import testAlertSummaries from '../../mock/alert_summaries';

const testAlertSummary = testAlertSummaries[0];

const testTagsModal = (handleClose) => {
  const toggle = () => {};

  return render(
    <TagsModal
      alertSummary={testAlertSummary}
      performanceTags={testPerformanceTags}
      showModal
      toggle={handleClose || toggle}
      updateAndClose={() => {}}
    />,
  );
};

test('When the modal is open, tags list has the same number of items passed in performanceTags props', async () => {
  const { queryAllByTestId } = testTagsModal();

  const list = await waitFor(() => queryAllByTestId(/modal-perf-tag/));

  expect(list).toHaveLength(testPerformanceTags.length);
});

test('If an alert summary already has one active tag it should appear checked', async () => {
  testAlertSummary.performance_tags = ['harness'];

  const { getByTestId } = testTagsModal();
  const activeTag = await waitFor(() => getByTestId('modal-perf-tag harness'));

  expect(activeTag.checked).toBeTruthy();
});

test('An active/checked tag can be unchecked', async () => {
  testAlertSummary.performance_tags = ['harness'];

  const { getByTestId } = testTagsModal();
  let activeTag = await waitFor(() => getByTestId('modal-perf-tag harness'));

  expect(activeTag.checked).toBeTruthy();

  fireEvent.change(activeTag, { target: { checked: false } });
  activeTag = await waitFor(() => getByTestId('modal-perf-tag harness'));

  expect(activeTag.checked).toBeFalsy();
});

test('Modal closes on X', async () => {
  const handleClose = jest.fn();
  const { getByText } = testTagsModal(handleClose);

  const closeButton = await waitFor(() => getByText('×'));

  expect(closeButton).toBeInTheDocument();

  fireEvent.click(closeButton);

  expect(handleClose).toHaveBeenCalledTimes(1);
});

test('Modal does not keep unsaved changes', async () => {
  testAlertSummary.performance_tags = ['harness'];

  const handleClose = jest.fn();
  const { getByText, getByTestId } = testTagsModal(handleClose);

  let activeTag = await waitFor(() => getByTestId('modal-perf-tag harness'));

  expect(activeTag.checked).toBeTruthy();

  fireEvent.change(activeTag, { target: { checked: false } });
  expect(activeTag.checked).toBeFalsy();

  const closeButton = await waitFor(() => getByText('×'));
  fireEvent.click(closeButton);

  expect(handleClose).toHaveBeenCalledTimes(1);

  activeTag = await waitFor(() => getByTestId('modal-perf-tag harness'));

  expect(activeTag.checked).toBeTruthy();
});
