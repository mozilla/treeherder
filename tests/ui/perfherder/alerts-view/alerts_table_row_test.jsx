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
const testAlert2 = testAlertSummaries[1].alerts[0];
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

const alertTableRowTest = (tags, alert = testAlert, options) => {
  if (tags) {
    testAlert.series_signature.tags = [...tags];
  }

  if (options) {
    testAlert.series_signature.extra_options = [...options];
  }

  return render(
    <table>
      <tbody>
        <AlertTableRow
          alertSummary={testAlertSummary}
          frameworks={frameworks}
          user={testUser}
          alert={alert}
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

test('Test column contains only suite and test name', async () => {
  const { getByTestId } = alertTableRowTest(false, testAlert);
  const { suite, test } = testAlert.series_signature;

  const alertTitle = await waitFor(() =>
    getByTestId(`alert ${testAlert.id} title`),
  );

  expect(alertTitle.textContent).toBe(`${suite} ${test}`);
});

test('Tests with duplicated suite and test name appears only once in Test column', async () => {
  testAlert.series_signature.suite = 'duplicatedname';
  testAlert.series_signature.test = 'duplicatedname';
  const { getByTestId } = alertTableRowTest(false, testAlert);

  const alertTitle = await waitFor(() =>
    getByTestId(`alert ${testAlert.id} title`),
  );

  expect(alertTitle.textContent).toBe('duplicatedname ');
});

test(`Platform column contains alerts's platform`, async () => {
  const { getByTestId } = alertTableRowTest(false, testAlert);
  const { machine_platform: machinePlatform } = testAlert.series_signature;

  const alertPlatform = await waitFor(() => getByTestId(`alert-platform`));

  expect(alertPlatform.textContent).toBe(machinePlatform);
});

test("Alert item with no tags displays 'No tags'", async () => {
  const { getByText } = alertTableRowTest(['']);

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
  const { getByTestId } = alertTableRowTest(testTags);

  const showMoreButton = await waitFor(() => getByTestId('show-more-tags'));

  expect(showMoreButton.textContent).toBe('...');
});

test("Button '...' displays all the tags for an alert item", async () => {
  const testTags = ['tag1', 'tag2', 'tag3'];
  const { getByTestId, getAllByTestId } = alertTableRowTest(testTags);

  let visibleTags = await waitFor(() => getAllByTestId(`alert-tag`));

  expect(visibleTags).toHaveLength(2);

  const showMoreButton = await waitFor(() => getByTestId('show-more-tags'));

  expect(showMoreButton.textContent).toBe('...');

  fireEvent.click(showMoreButton);

  visibleTags = await waitFor(() => getAllByTestId(`alert-tag`));

  expect(visibleTags).toHaveLength(testTags.length);
});

test("Alert item with no options displays 'No options'", async () => {
  const { getByText } = alertTableRowTest(false, testAlert, ['']);

  const message = await waitFor(() => getByText('No options'));
  expect(message).toBeInTheDocument();
});

test('Alert item with 2 options displays 2 options', async () => {
  const testOptions = ['option1', 'option2'];
  const { getAllByTestId } = alertTableRowTest(false, testAlert, testOptions);

  const options = await waitFor(() => getAllByTestId(`alert-option`));

  expect(options).toHaveLength(testOptions.length);
});

test("Alert item with more than 2 options displays '...' button", async () => {
  const testOptions = ['option1', 'option2', 'option3'];
  const { getByTestId } = alertTableRowTest(false, testAlert, testOptions);

  const showMoreButton = await waitFor(() => getByTestId('show-more-options'));

  expect(showMoreButton.textContent).toBe('...');
});

test("Button '...' displays all options for an alert item", async () => {
  const testOptions = ['option1', 'option2', 'option3'];
  const { getByTestId, getAllByTestId } = alertTableRowTest(
    false,
    testAlert,
    testOptions,
  );

  let visibleOptions = await waitFor(() => getAllByTestId(`alert-option`));

  expect(visibleOptions).toHaveLength(2);

  const showMoreButton = await waitFor(() => getByTestId('show-more-options'));

  expect(showMoreButton.textContent).toBe('...');

  fireEvent.click(showMoreButton);

  visibleOptions = await waitFor(() => getAllByTestId(`alert-option`));

  expect(visibleOptions).toHaveLength(testOptions.length);
});

test('Documentation link is available for talos framework', async () => {
  const { getByTestId } = alertTableRowTest();
  expect(getByTestId('docs')).toHaveAttribute(
    'href',
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/talos.html#tp5o',
  );
});

test('Documentation link is not available for build_metrics framework', async () => {
  const { queryByTestId } = alertTableRowTest(false, testAlert2);
  expect(queryByTestId('docs')).toBeNull();
});

test('Chart icon opens the graph link for an alert in a new tab', async () => {
  const { getByLabelText } = alertTableRowTest(false, testAlert);

  const graphLink = await waitFor(() => getByLabelText('graph-link'));

  expect(graphLink).toBeInTheDocument();
  expect(graphLink).toHaveAttribute(
    'href',
    './graphs?timerange=31536000&series=mozilla-inbound,1944439,1,1',
  );
  expect(graphLink).toHaveAttribute('target', '_blank');
});
