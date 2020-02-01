import fs from 'fs';
import path from 'path';

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
const failure = pushHealth.metrics.tests.details.needInvestigation[0];
const cssFile = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../node_modules/bootstrap/dist/css/bootstrap.css',
  ),
);

// Need to use this technique to add the CSS to the document since JSDOM doesn't
// load the Reactstrap/Bootstrap CSS.
// Credit: https://stackoverflow.com/questions/52813527/cannot-check-expectelm-not-tobevisible-for-semantic-ui-react-component
const useStyles = container => {
  const style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = cssFile;
  container.append(style);
};

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
      groupedBy="platform"
      notify={() => {}}
    />
  );

  test('should show the test name', async () => {
    const { getByText } = render(testTestFailure(failure));

    expect(
      await waitForElement(() =>
        getByText('IndexedDB/idb-explicit-commit.any.worker.html'),
      ),
    ).toBeInTheDocument();
  });

  test('should not show details by default', async () => {
    const { container, getByText } = render(testTestFailure(failure));
    useStyles(container);

    // Must use .toBeVisible() rather than .toBeInTheDocument because
    // Collapse just hides elements, doesn't remove them.
    expect(
      await waitForElement(() =>
        getByText('Transactions that explicitly commit ', {
          exact: false,
        }),
      ),
    ).not.toBeVisible();
    expect(
      await waitForElement(() => getByText('more...')),
    ).toBeInTheDocument();
  });

  test('should show details when click more...', async () => {
    const { container, getByText } = render(testTestFailure(failure));
    const moreLink = getByText('more...');

    useStyles(container);
    fireEvent.click(moreLink);

    expect(
      await waitForElement(() =>
        getByText(
          'Error in remote: uncaught exception: Error: assert_unreached',
          { exact: false },
        ),
      ),
    ).toBeVisible();
    expect(
      await waitForElement(() => getByText('less...')),
    ).toBeInTheDocument();
  });
});
