import React from 'react';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';
import { render, fireEvent, waitFor } from '@testing-library/react';

import fuzzyJobList from '../mock/job_list/fuzzy_jobs/fuzzyJobList.json';
import initialJobList from '../mock/job_list/fuzzy_jobs/initial_job_list.json';
import searchLinuxResults from '../mock/job_list/fuzzy_jobs/search_linux_results.json';
import searchDebugResults from '../mock/job_list/fuzzy_jobs/search_debug_results.json';
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

  test('Fuzzy search gives expected results', async () => {
    const { getByTitle, queryAllByTestId } = await render(testFuzzyJobFinder, {
      legacyRoot: true,
    });
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

  test('Fuzzy search gives expected results for extended operators', async () => {
    const { getByTitle, queryAllByTestId } = await render(testFuzzyJobFinder, {
      legacyRoot: true,
    });
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

    await fireEvent.change(inputElement, { target: { value: 'debug$' } });
    expect(inputElement.value).toBe('debug$');
    await fireEvent.keyDown(inputElement, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(queryAllByTestId('fuzzyList')).toHaveLength(16);
      const fuzzySearchArray = queryAllByTestId('fuzzyList').map(
        (job) => job.innerHTML,
      );
      expect(fuzzySearchArray).toStrictEqual(
        expect.arrayContaining(searchDebugResults),
      );
    });
  });
});
