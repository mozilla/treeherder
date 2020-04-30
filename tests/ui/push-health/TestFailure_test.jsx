import React from 'react';
import fetchMock from 'fetch-mock';
import {
  render,
  cleanup,
  waitForElement,
  fireEvent,
} from '@testing-library/react';

import { replaceLocation, setUrlParam } from '../../../ui/helpers/location';
import TestFailure from '../../../ui/push-health/TestFailure';
import pushHealth from '../mock/push_health';

const repoName = 'autoland';
const crashFailure = pushHealth.metrics.tests.details.knownIssues[0];
const testFailure = pushHealth.metrics.tests.details.needInvestigation[2];

beforeEach(() => {
  fetchMock.get('https://treestatus.mozilla-releng.net/trees/autoland', {
    result: {
      message_of_the_day: '',
      reason: '',
      status: 'open',
      tree: 'autoland',
    },
  });
  setUrlParam('repo', repoName);
  testFailure.key = 'wazzon';
});

afterEach(() => {
  cleanup();
  fetchMock.reset();
  replaceLocation({});
});

describe('TestFailure', () => {
  const testTestFailure = (failure) => (
    <TestFailure
      failure={failure}
      repo="autoland"
      user={{ email: 'foo' }}
      revision="abc"
      currentRepo={{ name: repoName }}
      groupedBy="platform"
      notify={() => {}}
    />
  );

  test('should show the test name', async () => {
    const { getByText } = render(testTestFailure(testFailure));

    expect(
      await waitForElement(() =>
        getByText(
          'layout/reftests/high-contrast/backplate-bg-image-006.html == layout/reftests/high-contrast/backplate-bg-image-006-ref.html',
        ),
      ),
    ).toBeInTheDocument();
  });

  test('should not show details by default', async () => {
    const { getByText, getByTestId } = render(testTestFailure(testFailure));
    const logLineToggle = await waitForElement(() => getByTestId('log-lines'));

    // For collapsible components, you must check for 'collapse' (hidden) or 'collapse show' (visible)
    // or aria-expanded attribute because collapse just hides elements, doesn't remove them.
    expect(logLineToggle).toHaveClass('collapse');
    expect(logLineToggle).toHaveAttribute(
      'aria-expanded',
      expect.stringMatching('false'),
    );
    expect(
      await waitForElement(() => getByText('more...')),
    ).toBeInTheDocument();
  });

  test('should show details when click more...', async () => {
    const { getByText } = render(testTestFailure(testFailure));
    const moreLink = getByText('more...');

    fireEvent.click(moreLink);

    expect(
      await waitForElement(() =>
        getByText(
          'image comparison, max difference: 15, number of differing pixels: 3200',
          { exact: false },
        ),
      ),
    ).toBeVisible();
    expect(
      await waitForElement(() => getByText('less...')),
    ).toBeInTheDocument();
  });

  test('should show crash stack and signature when click more...', async () => {
    const { getByText, getAllByText } = render(testTestFailure(crashFailure));
    const moreLink = getByText('more...');

    fireEvent.click(moreLink);

    expect(
      await waitForElement(
        () => getAllByText('@ __abort_with_payload + 0xa')[0],
      ),
    ).toBeVisible();
    expect(
      await waitForElement(() =>
        getByText('Operating system: Mac OS X', { exact: false }),
      ),
    ).toBeVisible();
    expect(
      await waitForElement(() => getByText('less...')),
    ).toBeInTheDocument();
  });
});
