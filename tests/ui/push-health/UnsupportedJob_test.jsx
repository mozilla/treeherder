import React from 'react';
import fetchMock from 'fetch-mock';
import { render, cleanup, waitForElement } from '@testing-library/react';

import { replaceLocation, setUrlParam } from '../../../ui/helpers/location';
import UnsupportedJob from '../../../ui/push-health/UnsupportedJob';

const repoName = 'autoland';
const revision = '123abc123abc';
const unclassifiedJob = {
  id: 275146846,
  machine_platform_id: 104,
  option_collection_hash: '03abd064e50ec12b8c7309950268531d78c63f60',
  job_type_id: 32758,
  result: 'testfailed',
  failure_classification_id: 1,
  push_id: 587502,
  job_type_name: 'test-linux64-asan/opt-reftest-e10s-7',
  job_type_symbol: 'R7',
  platform: 'linux64',
  task_id: 'ZGSRdYjwQrmfTLpIK7n66A',
  run_id: 0,
};
const classifiedJob = {
  id: 275148683,
  machine_platform_id: 529,
  option_collection_hash: '102210fe594ee9b33d82058545b1ed14f4c8206e',
  job_type_id: 180381,
  result: 'testfailed',
  failure_classification_id: 4,
  push_id: 587502,
  job_type_name: 'test-android-em-7.0-x86_64/opt-geckoview-junit-e10s',
  job_type_symbol: 'gv-junit',
  platform: 'android-em-7-0-x86_64',
  task_id: 'IbqFZbxhQka3a1sYa-XPpg',
  run_id: 0,
};
const details275146846 = {
  artifacts: [
    {
      storageType: 's3',
      name: 'public/test_info//reftest_errorsummary.log',
      expires: '2020-11-06T18:58:18.579Z',
      contentType: 'text/plain',
    },
    {
      storageType: 's3',
      name: 'public/test_info//reftest_raw.log',
      expires: '2020-11-06T18:58:18.579Z',
      contentType: 'text/plain',
    },
  ],
};

const details275148683 = {
  artifacts: [
    {
      storageType: 's3',
      name: 'public/logs//localconfig.json',
      expires: '2020-11-06T18:58:09.715Z',
      contentType: 'application/json',
    },
    {
      storageType: 's3',
      name: 'public/test_info//resource-usage.json',
      expires: '2020-11-06T18:58:09.715Z',
      contentType: 'application/json',
    },
  ],
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
  fetchMock.get(
    'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/ZGSRdYjwQrmfTLpIK7n66A/runs/0/artifacts',
    details275146846,
  );
  fetchMock.get(
    'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task/IbqFZbxhQka3a1sYa-XPpg/runs/0/artifacts',
    details275148683,
  );
  setUrlParam('try', repoName);
});

afterEach(() => {
  cleanup();
  fetchMock.reset();
  replaceLocation({});
});

describe('UnsupportedJob', () => {
  const testTestFailure = (job) => (
    <UnsupportedJob
      job={job}
      jobName={job.job_type_name}
      jobSymbol={job.job_type_symbol}
      currentRepo={{
        name: 'try',
        tc_root_url: 'https://firefox-ci-tc.services.mozilla.com',
      }}
      revision={revision}
    />
  );

  test('should show the job symbol', async () => {
    const { getByText } = render(testTestFailure(unclassifiedJob));

    expect(await waitForElement(() => getByText('R7'))).toBeInTheDocument();
  });

  test('A classified job should have a star', async () => {
    const { getByTitle } = render(testTestFailure(classifiedJob));

    expect(
      await waitForElement(() => getByTitle('Classified')),
    ).toBeInTheDocument();
  });

  test('Jobs should have a log link and a bug create link', async () => {
    const { getByTitle } = render(testTestFailure(unclassifiedJob));

    expect(
      await waitForElement(() =>
        getByTitle('Open the Log Viewer for this job'),
      ),
    ).toBeInTheDocument();
    expect(
      await waitForElement(() => getByTitle('File bug')),
    ).toBeInTheDocument();
  });
});
