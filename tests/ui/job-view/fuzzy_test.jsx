import React from 'react';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';
import { render, fireEvent, waitFor } from '@testing-library/react';

import fuzzyJobList from '../mock/job_list/fuzzy_jobs/fuzzyJobList.json';
import FuzzyJobFinder from '../../../ui/job-view/pushes/FuzzyJobFinder';

const mockStore = configureMockStore([thunk]);

describe('FuzzyJobFinder', () => {
  const isOpen = true;
  const decisionTaskId = 'YHKMjYZeSSmEZTrAPdRIag';
  const id = 705037;
  const currentRepo = {
    id: 77,
    repository_group: {
      name: 'development',
      description:
        'Collection of repositories where code initially lands in the development process',
    },
    name: 'autoland',
    dvcs_type: 'hg',
    url: 'https://hg.mozilla.org/integration/autoland',
    branch: null,
    codebase: 'gecko',
    description: 'The destination for automatically landed Firefox commits.',
    active_status: 'active',
    performance_alerts_enabled: true,
    expire_performance_data: false,
    is_try_repo: false,
    tc_root_url: 'https://firefox-ci-tc.services.mozilla.com',
    pushLogUrl: 'https://hg.mozilla.org/integration/autoland/pushloghtml',
    revisionHrefPrefix: 'https://hg.mozilla.org/integration/autoland/rev/',
  };
  const store = mockStore({});
  const testFuzzyJobFinder = (
    <Provider store={store}>
      <FuzzyJobFinder
        isOpen={isOpen}
        toggle={() => {}}
        jobList={fuzzyJobList}
        filteredJobList={fuzzyJobList}
        className="fuzzy-modal"
        pushId={id}
        decisionTaskId={decisionTaskId}
        currentRepo={currentRepo}
        notify={() => {}}
      />
    </Provider>
  );
  const initialJobList = [
    'addon-tps-xpi',
    'artifact-build-linux64-artifact/opt',
    'build-android-aarch64-gcp/debug',
    'build-android-aarch64-gcp/opt',
    'build-android-aarch64/debug',
    'build-android-aarch64/opt',
    'build-android-aarch64/pgo',
    'build-android-api-16-gcp/debug',
    'build-android-api-16-gcp/opt',
    'build-android-api-16/debug',
    'build-android-api-16/opt',
    'build-android-api-16/pgo',
    'build-android-geckoview-docs/opt',
    'build-android-x86-fuzzing/debug',
    'build-android-x86-gcp/opt',
    'build-android-x86/opt',
    'build-android-x86_64-asan-fuzzing/opt',
    'build-android-x86_64-gcp/debug',
    'build-android-x86_64-gcp/opt',
    'build-android-x86_64/debug',
    'build-android-x86_64/opt',
    'build-fat-aar-android-geckoview-fat-aar/opt',
    'build-linux-devedition/opt',
    'build-linux-gcp/debug',
    'build-linux-gcp/opt',
    'build-linux-reproduced/opt',
    'build-linux-rusttests/debug',
    'build-linux-rusttests/opt',
    'build-linux-shippable/opt',
    'build-linux/debug',
    'build-linux/opt',
    'build-linux64-aarch64/opt',
    'build-linux64-add-on-devel/opt',
    'build-linux64-asan-fuzzing-ccov/opt',
    'build-linux64-asan-fuzzing/opt',
    'build-linux64-asan/debug',
    'build-linux64-asan/opt',
    'build-linux64-ccov/opt',
    'build-linux64-devedition/opt',
    'build-linux64-fuzzing-ccov/opt',
    'build-linux64-fuzzing/debug',
    'build-linux64-gcp/debug',
    'build-linux64-gcp/opt',
    'build-linux64-noopt/debug',
    'build-linux64-plain/debug',
    'build-linux64-plain/opt',
    'build-linux64-rusttests/debug',
    'test-windows10-64/opt-reftest-fis-e10s-2',
    'test-windows10-64/opt-reftest-no-accel-e10s-1',
    'test-windows10-64/opt-reftest-no-accel-e10s-2',
    'test-windows10-64/opt-reftest-no-accel-e10s-3',
    'test-windows10-64/opt-reftest-no-accel-e10s-4',
    'test-windows10-64/opt-talos-bcv-e10s',
    'test-windows10-64/opt-talos-chrome-e10s',
    'test-windows10-64/opt-talos-damp-e10s',
    'test-windows10-64/opt-talos-dromaeojs-e10s',
    'test-windows10-64/opt-talos-g1-e10s',
    'test-windows10-64/opt-talos-g4-e10s',
    'test-windows10-64/opt-talos-g5-e10s',
    'test-windows10-64/opt-talos-other-e10s',
  ];
  const searchLinuxResults = [
    'build-linux-devedition/opt',
    'build-linux-gcp/debug',
    'build-linux-gcp/opt',
    'build-linux-reproduced/opt',
    'build-linux-rusttests/debug',
    'build-linux-rusttests/opt',
    'build-linux-shippable/opt',
    'build-linux/debug',
    'build-linux/opt',
    'build-linux64-aarch64/opt',
    'build-linux64-add-on-devel/opt',
    'build-linux64-asan-fuzzing-ccov/opt',
    'build-linux64-asan-fuzzing/opt',
    'build-linux64-asan/debug',
    'build-linux64-asan/opt',
    'build-linux64-ccov/opt',
    'build-linux64-devedition/opt',
    'build-linux64-fuzzing-ccov/opt',
    'build-linux64-fuzzing/debug',
    'build-linux64-gcp/debug',
    'build-linux64-gcp/opt',
    'build-linux64-noopt/debug',
    'build-linux64-plain/debug',
    'build-linux64-plain/opt',
    'build-linux64-rusttests/debug',
    'artifact-build-linux64-artifact/opt',
  ];

  test('Fuzzy search gives expected results', async () => {
    const { getByTitle, queryAllByTestId } = await render(testFuzzyJobFinder);
    const inputElement = getByTitle('Filter the list of runnable jobs');

    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList')).toHaveLength(60);
      const fuzzySearchArray = queryAllByTestId('fuzzyList').map(
        (job) => job.innerHTML,
      );
      expect(fuzzySearchArray).toStrictEqual(
        expect.arrayContaining(initialJobList),
      );
    });

    await fireEvent.change(inputElement, { target: { value: 'linux' } });
    expect(inputElement.value).toBe('linux');
    await fireEvent.keyDown(inputElement, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList')).toHaveLength(26);
      const fuzzySearchArray = queryAllByTestId('fuzzyList').map(
        (job) => job.innerHTML,
      );
      expect(fuzzySearchArray).toStrictEqual(
        expect.arrayContaining(searchLinuxResults),
      );
    });
  });
});
