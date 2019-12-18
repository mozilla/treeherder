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
const failure = pushHealth.metrics[0].failures.needInvestigation[0];

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
  failure.key = 'wazzon';
});

afterEach(() => {
  cleanup();
  fetchMock.reset();
  replaceLocation({});
});

describe('TestFailure', () => {
  const testTestFailure = failure => (
    <TestFailure
      failure={failure}
      repo="autoland"
      user={{ email: 'foo' }}
      revision="abc"
      currentRepo={{ name: repoName }}
      notify={() => {}}
    />
  );

  test('should show the test name', async () => {
    const { getByText } = render(testTestFailure(failure));

    expect(
      await waitForElement(() =>
        getByText(
          'devtools/client/application/test/browser/browser_application_panel_sidebar.js',
        ),
      ),
    ).toBeInTheDocument();
  });

  test('should show small details by default', async () => {
    const { getByText } = render(testTestFailure(failure));

    expect(
      await waitForElement(() =>
        getByText(
          'A promise chain failed to handle a rejection: Connection closed, pending request to server0.conn17.child1/manifestActor19, type fetchCanonicalManifest failed',
          { exact: false },
        ),
      ),
    ).toBeInTheDocument();
    expect(
      await waitForElement(() => getByText('more...')),
    ).toBeInTheDocument();
  });

  test('should show details when click more...', async () => {
    const { getByText } = render(testTestFailure(failure));
    const moreLink = getByText('more...');
    fireEvent.click(moreLink);

    expect(
      await waitForElement(() =>
        getByText('Rejection date: Tue Sep 17 2019', { exact: false }),
      ),
    ).toBeInTheDocument();
    expect(
      await waitForElement(() => getByText('less...')),
    ).toBeInTheDocument();
  });
});
