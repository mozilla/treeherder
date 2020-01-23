import React from 'react';
import { render, waitForElement } from '@testing-library/react';

import pushHealth from '../mock/push_health';
import GroupedTests from '../../../ui/push-health/GroupedTests';

const tests = pushHealth.metrics.tests.details.needInvestigation;
const repoName = 'autoland';

describe('GroupedTests', () => {
  const testGroupedTests = (tests, path, count, searchStr) => (
    <GroupedTests
      group={tests}
      repo={repoName}
      revision={pushHealth.revision}
      user={{ email: 'foo' }}
      groupedBy={path}
      orderedBy={count}
      currentRepo={{ name: repoName }}
      notify={() => {}}
      searchStr={searchStr}
    />
  );

  test('should group by test path', async () => {
    const { getAllByTestId } = render(
      testGroupedTests(tests, 'path', 'count', ''),
    );

    expect(
      await waitForElement(() => getAllByTestId('test-grouping')),
    ).toHaveLength(32);
  });

  test('should filter when grouped by test path', async () => {
    const { getAllByTestId, getByText } = render(
      testGroupedTests(tests, 'path', 'count', 'point'),
    );

    expect(
      await waitForElement(() => getAllByTestId('test-grouping')),
    ).toHaveLength(8);
    expect(
      await waitForElement(() =>
        getByText(
          'devtools/client/webreplay/mochitest/browser_dbg_rr_breakpoints-01.js',
          {
            exact: false,
          },
        ),
      ),
    ).toBeInTheDocument();
  });

  test('should group by platform', async () => {
    const { getAllByTestId } = render(
      testGroupedTests(tests, 'platform', 'count', ''),
    );

    expect(
      await waitForElement(() => getAllByTestId('test-grouping')),
    ).toHaveLength(15);
  });

  test('should filter when grouped by platform', async () => {
    const { getAllByTestId, getByText } = render(
      testGroupedTests(tests, 'platform', 'count', 'point'),
    );

    expect(
      await waitForElement(() => getAllByTestId('test-grouping')),
    ).toHaveLength(2);
    expect(
      await waitForElement(() =>
        getByText('macosx1014-64-shippable opt', {
          exact: false,
        }),
      ),
    ).toBeInTheDocument();
  });
});
