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
  const initialJobs =
    'addon-tps-xpiartifact-build-linux64-artifact/optbuild-android-aarch64-gcp/debugbuild-android-aarch64-gcp/optbuild-android-aarch64/debugbuild-android-aarch64/optbuild-android-aarch64/pgobuild-android-api-16-gcp/debugbuild-android-api-16-gcp/optbuild-android-api-16/debugbuild-android-api-16/optbuild-android-api-16/pgobuild-android-geckoview-docs/optbuild-android-x86-fuzzing/debugbuild-android-x86-gcp/optbuild-android-x86/optbuild-android-x86_64-asan-fuzzing/optbuild-android-x86_64-gcp/debugbuild-android-x86_64-gcp/optbuild-android-x86_64/debugbuild-android-x86_64/optbuild-fat-aar-android-geckoview-fat-aar/optbuild-linux-devedition/optbuild-linux-gcp/debugbuild-linux-gcp/optbuild-linux-reproduced/optbuild-linux-rusttests/debugbuild-linux-rusttests/optbuild-linux-shippable/optbuild-linux/debugbuild-linux/optbuild-linux64-aarch64/optbuild-linux64-add-on-devel/optbuild-linux64-asan-fuzzing-ccov/optbuild-linux64-asan-fuzzing/optbuild-linux64-asan/debugbuild-linux64-asan/optbuild-linux64-ccov/optbuild-linux64-devedition/optbuild-linux64-fuzzing-ccov/optbuild-linux64-fuzzing/debugbuild-linux64-gcp/debugbuild-linux64-gcp/optbuild-linux64-noopt/debugbuild-linux64-plain/debugbuild-linux64-plain/optbuild-linux64-rusttests/debugtest-windows10-64/opt-reftest-fis-e10s-2test-windows10-64/opt-reftest-no-accel-e10s-1test-windows10-64/opt-reftest-no-accel-e10s-2test-windows10-64/opt-reftest-no-accel-e10s-3test-windows10-64/opt-reftest-no-accel-e10s-4test-windows10-64/opt-talos-bcv-e10stest-windows10-64/opt-talos-chrome-e10stest-windows10-64/opt-talos-damp-e10stest-windows10-64/opt-talos-dromaeojs-e10stest-windows10-64/opt-talos-g1-e10stest-windows10-64/opt-talos-g4-e10stest-windows10-64/opt-talos-g5-e10stest-windows10-64/opt-talos-other-e10s';
  const searchLinuxResults =
    'build-linux-devedition/optbuild-linux-gcp/debugbuild-linux-gcp/optbuild-linux-reproduced/optbuild-linux-rusttests/debugbuild-linux-rusttests/optbuild-linux-shippable/optbuild-linux/debugbuild-linux/optbuild-linux64-aarch64/optbuild-linux64-add-on-devel/optbuild-linux64-asan-fuzzing-ccov/optbuild-linux64-asan-fuzzing/optbuild-linux64-asan/debugbuild-linux64-asan/optbuild-linux64-ccov/optbuild-linux64-devedition/optbuild-linux64-fuzzing-ccov/optbuild-linux64-fuzzing/debugbuild-linux64-gcp/debugbuild-linux64-gcp/optbuild-linux64-noopt/debugbuild-linux64-plain/debugbuild-linux64-plain/optbuild-linux64-rusttests/debugartifact-build-linux64-artifact/opt';

  test('Fuzzy search gives expected results', async () => {
    const { getByTitle, getByTestId } = await render(testFuzzyJobFinder);
    const inputElement = getByTitle('Filter the list of runnable jobs');
    // fuzzyList is the select Input block where the searched jobs are displayed
    const fuzzySearchList = getByTestId('fuzzyList');

    await waitFor(() => {
      expect(fuzzySearchList).toHaveTextContent(initialJobs);
      expect(fuzzySearchList).toHaveLength(60);
      // Next line Gives error  TypeError: fuzzySearchList.map is not a function
      const fuzzySearchArray = fuzzySearchList.options.map(
        (job) => job.lastChild.innerHTML,
      );
      expect(fuzzySearchArray).toBe(expect.arrayContaining(fuzzyJobList));
    });

    await fireEvent.change(inputElement, { target: { value: 'linux' } });

    expect(inputElement.value).toBe('linux');

    await fireEvent.keyDown(inputElement, { key: 'Enter', code: 'Enter' });

    await waitFor(() =>
      expect(fuzzySearchList).toHaveTextContent(searchLinuxResults),
    );
  });
});
