import React from 'react';
import { cleanup, render, waitForElement } from '@testing-library/react';

import LegendCard from '../../../ui/perfherder/graphs/LegendCard';
import { legendCardText } from '../../../ui/perfherder/constants';

const testData = [
  {
    color: ['brown', '#b87e17'],
    data: [],
    framework_id: 1,
    id: 'mozilla-central ts_paint_flex opt e10s stylo',
    lowerIsBetter: true,
    name: 'ts_paint_flex opt e10s stylo',
    parentSignature: null,
    platform: 'linux64',
    projectId: 1,
    repository_name: 'mozilla-central',
    resultSetData: [],
    signatureHash: '9c0028a9c871b51c8296485c8fc09b21fe41eec0',
    signature_id: 1647493,
    visible: true,
  },
  {
    color: ['darkorchid', '#9932cc'],
    data: [],
    framework_id: 13,
    id: 'mozilla-central raptor-tp6-amazon-firefox opt',
    lowerIsBetter: true,
    name: 'raptor-tp6-amazon-firefox opt ',
    parentSignature: null,
    platform: 'linux64',
    projectId: 1,
    repository_name: 'mozilla-central',
    resultSetData: [],
    signatureHash: '554cc85b904ede676c691b65bbe19911c7320718',
    signature_id: 2146210,
    visible: true,
  },
];

const colors = [
  ['darkorchid', '#9932cc'],
  ['blue', '#1752b8'],
];

const legendCard = (series, testData) =>
  render(
    <LegendCard
      series={series}
      testData={testData}
      frameworks={[{ id: 1, name: 'talos' }]}
      updateState={() => {}}
      updateStateParams={() => {}}
      colors={colors}
    />,
  );

afterEach(cleanup);

test('legend card displays the framework badge', async () => {
  const { queryByText } = legendCard(testData[0], testData);

  const frameworkBadge = await waitForElement(() => queryByText('talos'));
  expect(frameworkBadge).toBeInTheDocument();
});

test('legend card with incorrect framework displays the unknown framework badge message', async () => {
  const { queryByText } = legendCard(testData[1], testData);

  const frameworkBadge = await waitForElement(() =>
    queryByText(legendCardText.unknownFrameworkMessage),
  );
  expect(frameworkBadge).toBeInTheDocument();
});
