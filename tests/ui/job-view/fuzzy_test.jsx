import React from 'react';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';
import { render, fireEvent, waitFor } from '@testing-library/react';

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
    const { getByTitle, getByTestId } = await render(testFuzzyJobFinder);
    const inputElement = getByTitle('Filter the list of runnable jobs');
    const number = getByTestId('number');
    const fuzzySearchList = getByTestId('fuzzyList');

    expect(number).toHaveTextContent('Runnable Jobs [');
    expect(fuzzyJobList).toHaveLength(60);
    expect(fuzzySearchList.type).toBe('select-multiple');

    fireEvent.change(inputElement, { target: { value: 'Mochitest' } });

    expect(inputElement.value).toBe('Mochitest');

    await fireEvent.keyDown(inputElement, { key: 'Enter', code: 'Enter' });

    expect(number).toHaveTextContent('Runnable Jobs [');

    waitFor(() => expect(inputElement).toBeTruthy());
    expect(fuzzySearchList.value).toBe('');
  });
});
