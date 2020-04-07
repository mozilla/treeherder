import React from 'react';
import { render, cleanup, waitForElement } from '@testing-library/react';

import ReplicatesGraph from '../../../ui/perfherder/compare/ReplicatesGraph';
import { noDataFoundMessage } from '../../../ui/perfherder/constants';

// TODO addtional tests:
const TEST_SUITE_NAME = 'testSuiteName';
const SUBTEST_NAME = 'subtestName';
const mockedReplicateData = {
  framework: {
    name: 'perf_testing_framework',
  },
  suites: [
    {
      alertThreshold: 5,
      extraOptions: ['e10s', 'stylo'],
      lowerIsBetter: true,
      name: TEST_SUITE_NAME,
      subtests: [
        {
          alertThreshold: 5,
          lowerIsBetter: true,
          name: SUBTEST_NAME,
          replicates: [
            500,
            345,
            366,
            358,
            355,
            365,
            354,
            354,
            363,
            360,
            389,
            357,
            273,
            376,
            350,
            381,
            373,
            356,
            351,
            348,
            271,
            354,
            351,
            360,
            385,
          ],
          shouldAlert: false,
          unit: 'ms',
          value: 356.5,
        },
        {
          alertThreshold: 5,
          lowerIsBetter: true,
          name: 'tablemutation.html',
          replicates: [
            89,
            88,
            90,
            83,
            87,
            87,
            88,
            86,
            85,
            84,
            85,
            88,
            102,
            83,
            100,
            86,
            100,
            80,
            87,
            88,
            82,
            85,
            84,
            83,
            86,
          ],
          shouldAlert: false,
          unit: 'ms',
          value: 86,
        },
      ],
      value: 175.35900884275807,
    },
    {
      extraOptions: ['e10s', 'stylo'],
      name: 'ts_paint',
      subtests: [
        {
          name: 'ts_paint',
          replicates: [
            844,
            832,
            842,
            825,
            849,
            816,
            857,
            841,
            849,
            840,
            846,
            872,
            864,
            837,
            830,
            843,
            841,
            854,
            841,
            858,
          ],
          value: 842,
        },
      ],
    },
    {
      alertThreshold: 2,
      extraOptions: ['e10s', 'stylo'],
      lowerIsBetter: true,
      name: 'tpaint',
      subtests: [
        {
          alertThreshold: 2,
          lowerIsBetter: true,
          name: '',
          replicates: [
            552.9000000000001,
            561.6599999999999,
            558.1199999999999,
            565.0799999999999,
            554.94,
            599.9399999999998,
            600.9200000000001,
            559.22,
            552.0600000000002,
            559.4000000000001,
            603.0999999999999,
            586.4199999999998,
            587.3200000000002,
            606.3800000000001,
            587.1000000000001,
            592.9200000000001,
            542.9199999999998,
            553.98,
            556.4200000000001,
            576.0999999999999,
          ],
          shouldAlert: false,
          unit: 'ms',
          value: 586.4199999999998,
        },
      ],
    },
  ],
};
const mockedGetData = async () => ({
  data: [
    {
      signature_id: 1883394,
      framework_id: 1,
      signature_hash: 'a54f0eb771d5806051afd123685808802abc53f0',
      platform: 'linux64-pgo-qr',
      test: 'dhtml.html',
      suite: 'a11yr',
      lower_is_better: true,
      has_subtests: false,
      values: [356.5],
      name: 'a11yr dhtml.html opt e10s stylo',
      parent_signature: '1883393',
      job_ids: [232368236],
    },
  ],
  failureStatus: null,
});
const successfulGetReplicateData = () =>
  Promise.resolve({ failureStatus: null, data: mockedReplicateData });
const failingGetReplicateData = () =>
  Promise.resolve({ failureStatus: true, data: ['error message'] });

afterEach(cleanup);

const replicatesGraph = (mockedGetData, mockedGetReplicateData) =>
  render(
    <ReplicatesGraph
      title="Test"
      project={{ name: 'test-project' }}
      revision="bfe72a7c57bde0d1825ba43cbd9afa34d03ed00d"
      subtestSignature="11222"
      filters={{ testSuite: TEST_SUITE_NAME, subtest: SUBTEST_NAME }}
      getData={mockedGetData}
      getReplicateData={mockedGetReplicateData}
    />,
  );

test('graph with available data displays properly', async () => {
  const { getByText } = replicatesGraph(
    mockedGetData,
    successfulGetReplicateData,
  );

  const graphHeader = await waitForElement(() =>
    getByText('Test replicates over 1 run'),
  );
  const yAxisLegendUpperValue = await waitForElement(() => getByText('400'));

  expect(graphHeader).toBeInTheDocument();
  expect(yAxisLegendUpperValue).toBeInTheDocument();

  const numRuns = mockedReplicateData.suites[0].subtests[0].replicates.length;
  const expectedIndexes = Array.from(Array(numRuns).keys());

  const xAxisUpperValue = await waitForElement(() =>
    // 0 isn't listed as an x axis index
    getByText(expectedIndexes.length.toString()),
  );

  expect(xAxisUpperValue).toBeInTheDocument();
});

test('graph with no data displays a message', async () => {
  const { getByText, queryByText } = replicatesGraph(
    mockedGetData,
    failingGetReplicateData,
  );

  const noDataMsg = await waitForElement(() =>
    getByText(noDataFoundMessage('Test replicates')),
  );
  const legendNumbers = queryByText(/[0-9]+/);

  expect(noDataMsg).toBeInTheDocument();
  expect(legendNumbers).toBeNull();
});
