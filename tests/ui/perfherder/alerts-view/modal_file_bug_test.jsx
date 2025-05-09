import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line no-unused-vars
import { getByText } from '@testing-library/dom';

import FileBugModal from '../../../../ui/perfherder/alerts/FileBugModal';
import testRegressions from '../../mock/performance_regressions';

const testUser = {
  username: 'mozilla-ldap/test_user@mozilla.com',
  isLoggedIn: true,
  isStaff: true,
  email: 'test_user@mozilla.com',
};

const testFileBugModal = (user, handleClose) => {
  const toggle = () => {};

  return render(
    <FileBugModal
      showModal
      toggle={handleClose || toggle}
      updateAndClose={() => {}}
      header="File Regression for"
      title="Bug Number"
      submitButtonText="File Bug"
      user={user || testUser}
    />,
  );
};

test('When opening the file bug modal, submit bug button label should be "File Bug"', async () => {
  const { getByText } = testFileBugModal();

  expect(await waitFor(() => getByText('File Bug'))).toBeInTheDocument();
});

test('When opening the file bug modal, File bug button should be active', async () => {
  const { getByText } = testFileBugModal();

  expect(await waitFor(() => getByText('File Bug'))).toBeInTheDocument();
  const submitButton = getByText('File Bug');
  expect(submitButton).toBeEnabled();
});

test('When entering a bug ID with non-leading zero, submit bug button label should contain the ID', async () => {
  const { getByText, getByPlaceholderText } = testFileBugModal();

  const input = getByPlaceholderText('123456');

  fireEvent.change(input, { target: { value: testRegressions[3]['Bug ID'] } });

  expect(
    await waitFor(() =>
      getByText(`File Bug for ${testRegressions[3]['Bug ID']}`),
    ),
  ).toBeInTheDocument();
});

test('Entering a bug number with non leading zero File bug button should be enabled', async () => {
  const { getByText, getByPlaceholderText } = testFileBugModal();

  const input = getByPlaceholderText('123456');

  fireEvent.change(input, { target: { value: testRegressions[0]['Bug ID'] } });

  expect(
    await waitFor(() =>
      getByText(`File Bug for ${testRegressions[0]['Bug ID']}`),
    ),
  ).toBeInTheDocument();

  const submitButton = getByText(
    `File Bug for ${testRegressions[0]['Bug ID']}`,
  );

  expect(submitButton).toBeEnabled();
});

test('Entering a bug number with leading zero(es) File bug button should be disabled and label should be "File Bug"', async () => {
  const { getByText, getByPlaceholderText } = testFileBugModal();
  const input = getByPlaceholderText('123456');

  fireEvent.change(input, { target: { value: testRegressions[2]['Bug ID'] } });

  expect(await waitFor(() => getByText('File Bug'))).toBeInTheDocument();
  const submitButton = getByText('File Bug');
  expect(submitButton).toBeDisabled();
});

test('Submit button should be disabled when user is not logged in', async () => {
  const notLoggedInUser = {
    ...testUser,
    isLoggedIn: false,
  };

  const { getByText, queryByText } = testFileBugModal(notLoggedInUser);

  expect(queryByText('File Bug')).toBeNull();
  expect(
    getByText('You need to log in to access this feature.'),
  ).toBeInTheDocument();
});

test('Submit button should be active when user is logged in', async () => {
  const { getByText } = testFileBugModal(testUser);

  expect(await waitFor(() => getByText('File Bug'))).toBeInTheDocument();
  const submitButton = getByText('File Bug');
  expect(submitButton).toBeEnabled();
});
