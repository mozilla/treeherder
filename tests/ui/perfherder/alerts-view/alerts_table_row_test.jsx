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

const alertTableRowTest = ({ alert, tags, options } = { alert: testAlert }) => {
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
  const { getByTestId } = alertTableRowTest({ alert: testAlert, tags: false });
  const { suite, test } = testAlert.series_signature;

  const alertTitle = await waitFor(() =>
    getByTestId(`alert ${testAlert.id} title`),
  );

  expect(alertTitle.textContent).toBe(`${suite} ${test}`);
});

test('Tests with duplicated suite and test name appears only once in Test column', async () => {
  const { suite, test } = testAlert.series_signature;
  testAlert.series_signature.suite = 'duplicatedName';
  testAlert.series_signature.test = 'duplicatedName';

  const { getByTestId } = alertTableRowTest({
    alert: testAlert,
    tags: false,
  });

  testAlert.series_signature.suite = suite;
  testAlert.series_signature.test = test;

  const alertTitle = await waitFor(() =>
    getByTestId(`alert ${testAlert.id} title`),
  );

  expect(alertTitle.textContent).toBe('duplicatedName ');
});

test(`Platform column contains alerts's platform`, async () => {
  const { getByTestId } = alertTableRowTest({ alert: testAlert, tags: false });
  const { machine_platform: machinePlatform } = testAlert.series_signature;

  const alertPlatform = await waitFor(() => getByTestId(`alert-platform`));

  expect(alertPlatform.textContent).toBe(machinePlatform);
});

test("Alert item with no tags or options displays 'No tags or options'", async () => {
  const { getByText } = alertTableRowTest({
    alert: testAlert,
    tags: [''],
    options: [''],
  });

  const message = await waitFor(() => getByText('No tags or options'));
  expect(message).toBeInTheDocument();
});

test('Alert item with 2 tags displays 2 tags', async () => {
  const testTags = ['tag1', 'tag2'];
  const { getAllByTestId } = alertTableRowTest({
    alert: testAlert,
    tags: testTags,
  });

  const tags = await waitFor(() => getAllByTestId(`alert-tag`));

  expect(tags).toHaveLength(testTags.length);
});

test("Alert item with more than 2 tags or options displays '...' button", async () => {
  const testTags = ['tag1', 'tag2', 'tag3'];
  const testOptions = ['option1', 'option2'];
  const { getByTestId } = alertTableRowTest({
    alert: testAlert,
    tags: testTags,
    options: testOptions,
  });

  const showMoreButton = await waitFor(() =>
    getByTestId('show-more-tags-options'),
  );

  expect(showMoreButton.textContent).toBe('...');
});

test("Button '...' displays all the tags for an alert item", async () => {
  const testTags = ['tag1', 'tag2', 'tag3'];
  const { getByTestId, getAllByTestId } = alertTableRowTest({
    alert: testAlert,
    tags: testTags,
  });

  let visibleTags = await waitFor(() => getAllByTestId(`alert-tag`));

  expect(visibleTags).toHaveLength(2);

  const showMoreButton = await waitFor(() =>
    getByTestId('show-more-tags-options'),
  );

  expect(showMoreButton.textContent).toBe('...');

  fireEvent.click(showMoreButton);

  visibleTags = await waitFor(() => getAllByTestId(`alert-tag`));

  expect(visibleTags).toHaveLength(testTags.length);
});

test('Alert item with 2 options displays 2 options', async () => {
  const testOptions = ['option1', 'option2'];
  const { getAllByTestId } = alertTableRowTest({
    alert: testAlert,
    tags: [],
    options: testOptions,
  });

  const options = await waitFor(() => getAllByTestId(`alert-option`));

  expect(options).toHaveLength(testOptions.length);
});

test("Alert item with more than 2 options displays '...' button", async () => {
  const testOptions = ['option1', 'option2', 'option3'];
  const { getByTestId } = alertTableRowTest({
    alert: testAlert,
    tags: false,
    options: testOptions,
  });

  const showMoreButton = await waitFor(() =>
    getByTestId('show-more-tags-options'),
  );

  expect(showMoreButton.textContent).toBe('...');
});

test("Button '...' displays all options for an alert item", async () => {
  const testOptions = ['option1', 'option2', 'option3'];
  const { getByTestId, getAllByTestId } = alertTableRowTest({
    alert: testAlert,
    tags: [],
    options: testOptions,
  });

  let visibleOptions = await waitFor(() => getAllByTestId(`alert-option`));

  expect(visibleOptions).toHaveLength(2);

  const showMoreButton = await waitFor(() =>
    getByTestId('show-more-tags-options'),
  );

  expect(showMoreButton.textContent).toBe('...');

  fireEvent.click(showMoreButton);

  visibleOptions = await waitFor(() => getAllByTestId(`alert-option`));

  expect(visibleOptions).toHaveLength(testOptions.length);
});

test('Duplicated tags and option are displayed only once, options and tags are the same', async () => {
  const testOptions = ['cold', 'live'];
  const testTags = ['cold', 'live'];

  const { getAllByTestId } = alertTableRowTest({
    alert: testAlert,
    tags: testTags,
    options: testOptions,
  });

  const allTagsAndOptions = await waitFor(() =>
    getAllByTestId('alert-tag-and-option'),
  );

  expect(allTagsAndOptions).toHaveLength(2);
});

test('Duplicated tags and option are displayed only once, options and tags have elements in common ', async () => {
  const testOptions = ['cold', 'live', 'web'];
  const testTags = ['cold', 'live'];

  const { getByTestId } = alertTableRowTest({
    alert: testAlert,
    tags: testTags,
    options: testOptions,
  });

  const showMoreButton = await waitFor(() =>
    getByTestId('show-more-tags-options'),
  );

  expect(showMoreButton.textContent).toBe('...');

  fireEvent.click(showMoreButton);

  const allTagsAndOptions = await waitFor(() =>
    getByTestId('all-tags-and-options'),
  );

  expect(allTagsAndOptions.children).toHaveLength(3);
});

test('Documentation link is available for talos framework', async () => {
  const { getByTestId } = alertTableRowTest();
  expect(getByTestId('docs')).toHaveAttribute(
    'href',
    'https://firefox-source-docs.mozilla.org/testing/perfdocs/talos.html#tp5o',
  );
});

test('Documentation link is not available for build_metrics framework', async () => {
  const { queryByTestId } = alertTableRowTest({
    alert: testAlert2,
    tags: false,
  });
  expect(queryByTestId('docs')).toBeNull();
});

test('Chart icon opens the graph link for an alert in a new tab', async () => {
  const { getByLabelText } = alertTableRowTest({
    alert: testAlert,
    tags: false,
  });

  const graphLink = await waitFor(() => getByLabelText('graph-link'));

  expect(graphLink).toBeInTheDocument();
  expect(graphLink).toHaveAttribute(
    'href',
    './graphs?timerange=31536000&series=mozilla-inbound,1944439,1,1',
  );
  expect(graphLink).toHaveAttribute('target', '_blank');
});
