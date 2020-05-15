import React from 'react';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';
import { render, fireEvent } from '@testing-library/react';

import fuzzyJobList from '../mock/job_list/fuzzy_jobs/fuzzyJobList.json';
import filteredFuzzyList from '../mock/job_list/fuzzy_jobs/filteredFuzzyList.json';
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
  const store = mockStore({ fuzzyList: [] });
  const testFuzzyJobFinder = (
    <Provider store={store}>
      <FuzzyJobFinder
        isOpen={isOpen}
        toggle={() => {}}
        jobList={fuzzyJobList}
        filteredJobList={filteredFuzzyList}
        className="fuzzy-modal"
        pushId={id}
        decisionTaskId={decisionTaskId}
        currentRepo={currentRepo}
        notify={() => {}}
      />
    </Provider>
  );

  test('Fuzzy search gives expected results', async () => {
    const { getByTitle, getByTestId } = render(testFuzzyJobFinder);
    const inputElement = getByTitle('Filter the list of runnable jobs');
    const fuzzySearchList = getByTestId('fuzzyList');
    fireEvent.change(inputElement, { target: { value: 'Mochitest' } });
    expect(inputElement.value).toBe('Mochitest');
    fireEvent.keyDown(inputElement, { key: 'Enter', code: 'Enter' });
    expect(fuzzySearchList.value).toBe('');
  });
});
