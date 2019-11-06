import React from 'react';
import { render, cleanup, waitForElement } from '@testing-library/react';

import { noResultsMessage } from '../../../ui/perfherder/constants';
import HealthTable from '../../../ui/perfherder/health/HealthTable';

const results = [
  {
    framework: 'awsy',
    test_suite: 'Base Content Explicit',
    test: 'test1',
    platforms: ['linux64', 'linux64-nightly', 'osx-10-10', 'windows10-64'],
    repositories: [
      'ash',
      'autoland',
      'birch',
      'cedar',
      'mozilla-beta',
      'mozilla-central',
      'mozilla-inbound',
      'try',
    ],
    total_alerts: 202,
  },
  {
    framework: 'awsy',
    test_suite: 'Base Content Heap Unclassified',
    test: 'test2',
    platforms: ['linux64'],
    repositories: ['try'],
    total_alerts: 97,
  },
];

const healthTable = data => render(<HealthTable results={data} />);

afterEach(cleanup);

test('health table with no data should show message', async () => {
  const { getByText } = healthTable();

  const message = await waitForElement(() => getByText(noResultsMessage));

  expect(message).toBeInTheDocument();
});

test('health table should show data', async () => {
  const { getByText } = healthTable(results);

  const result1 = await waitForElement(() => getByText(results[0].test));
  const result2 = await waitForElement(() => getByText(results[1].test));

  expect(result1).toBeInTheDocument();
  expect(result2).toBeInTheDocument();
});
