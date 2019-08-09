import React from 'react';
import { fetchMock } from 'fetch-mock';
import { Provider } from 'react-redux';
import { render, cleanup, waitForElement } from '@testing-library/react';
import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';

import { replaceLocation, setUrlParam } from '../../../ui/helpers/location';
import FilterModel from '../../../ui/models/filter';
import SecondaryNavBar from '../../../ui/job-view/headerbars/SecondaryNavBar';
import { initialState } from '../../../ui/job-view/redux/stores/pushes';
import repos from '../mock/repositories';

const mockStore = configureMockStore([thunk]);
const repoName = 'autoland';

beforeEach(() => {
  fetchMock.get('https://treestatus.mozilla-releng.net/trees/autoland', {
    result: {
      message_of_the_day: '',
      reason: '',
      status: 'open',
      tree: 'autoland',
    },
  });
  setUrlParam('repo', repoName);
});

afterEach(() => {
  cleanup();
  fetchMock.reset();
  replaceLocation({});
});

describe('SecondaryNavBar', () => {
  const testSecondaryNavBar = (store, filterModel) => (
    <Provider store={store}>
      <SecondaryNavBar
        updateButtonClick={() => {}}
        serverChanged={false}
        filterModel={filterModel}
        repos={repos}
        setCurrentRepoTreeStatus={() => {}}
        duplicateJobsVisible={false}
        groupCountsExpanded={false}
        toggleFieldFilterVisible={() => {}}
      />
    </Provider>
  );

  test('should 52 unclassified', async () => {
    const store = mockStore({
      pushes: {
        ...initialState,
        allUnclassifiedFailureCount: 52,
        filteredUnclassifiedFailureCount: 0,
      },
    });
    const { getByText } = render(testSecondaryNavBar(store, new FilterModel()));

    expect(await waitForElement(() => getByText(repoName))).toBeInTheDocument();
    expect(await waitForElement(() => getByText('52'))).toBeInTheDocument();
  });

  test('should 22 unclassified and 10 filtered unclassified', async () => {
    const store = mockStore({
      pushes: {
        ...initialState,
        allUnclassifiedFailureCount: 22,
        filteredUnclassifiedFailureCount: 10,
      },
    });
    const { getByText } = render(testSecondaryNavBar(store, new FilterModel()));

    expect(await waitForElement(() => getByText(repoName))).toBeInTheDocument();
    expect(await waitForElement(() => getByText('22'))).toBeInTheDocument();
    expect(await waitForElement(() => getByText('10'))).toBeInTheDocument();
  });
});
