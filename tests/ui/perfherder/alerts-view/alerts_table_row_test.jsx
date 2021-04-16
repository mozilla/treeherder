import React from 'react';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';

import AlertTableRow from '../../../../ui/perfherder/alerts/AlertTableRow';
import testAlertSummaries from '../../mock/alert_summaries';

const testUser = {
  username: 'mozilla-ldap/test_user@mozilla.com',
  isLoggedIn: true,
  isStaff: true,
  email: 'test_user@mozilla.com',
};
const testAlertSummary = testAlertSummaries[0];
const testAlert = testAlertSummary.alerts[0];
const frameworks = [
  {
    id: 1,
    name: 'talos',
  },
  {
    id: 2,
    name: 'build_metrics',
  },
];

const alertTableRowTest = (tags) => {
  if (tags) {
    testAlert.series_signature.tags = [...tags];
  }
  return render(
    <table>
      <tbody>
        <AlertTableRow
          alertSummary={testAlertSummary}
          frameworks={frameworks}
          user={testUser}
          alert={testAlert}
          updateSelectedAlerts={() => {}}
          selectedAlerts={[{}]}
          updateViewState={() => {}}
          modifyAlert={() => {}}
        />
      </tbody>
    </table>,
  );
};

afterEach(cleanup);

test("Alert item with no tags displays 'No tags'", async () => {
  const { getByText } = alertTableRowTest();

  const message = await waitFor(() => getByText('No tags'));
  expect(message).toBeInTheDocument();
});

test('Alert item with 2 tags displays 2 tags', async () => {
  const testTags = ['tag1', 'tag2'];
  const { getAllByTestId } = alertTableRowTest(testTags);

  const tags = await waitFor(() => getAllByTestId(`alert-tag`));

  expect(tags).toHaveLength(testTags.length);
});

test("Alert item with more than 2 tags displays '...' button", async () => {
  const testTags = ['tag1', 'tag2', 'tag3'];
  const { getByText } = alertTableRowTest(testTags);

  const showMoreButton = await waitFor(() => getByText('...'));

  expect(showMoreButton).toBeInTheDocument();
});

test("Button '...' displays all the tags for an alert item", async () => {
  const testTags = ['tag1', 'tag2', 'tag3'];
  const { getByText, getAllByTestId } = alertTableRowTest(testTags);

  let visibleTags = await waitFor(() => getAllByTestId(`alert-tag`));

  expect(visibleTags).toHaveLength(2);

  const showMoreButton = await waitFor(() => getByText('...'));
  fireEvent.click(showMoreButton);

  visibleTags = await waitFor(() => getAllByTestId(`alert-tag`));

  expect(visibleTags).toHaveLength(testTags.length);
});
