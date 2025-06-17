import React from 'react';
import fetchMock from 'fetch-mock';
import { Provider } from 'react-redux';
import { render, waitFor, fireEvent } from '@testing-library/react';
import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';
import { createBrowserHistory } from 'history';
import { BrowserRouter } from 'react-router-dom';

import FilterModel from '../../../ui/models/filter';
import SecondaryNavBar from '../../../ui/job-view/headerbars/SecondaryNavBar';
import { initialState } from '../../../ui/job-view/redux/stores/pushes';
import repos from '../mock/repositories';

const mockStore = configureMockStore([thunk]);
const repoName = 'autoland';
const history = createBrowserHistory();
const router = { location: history.location };

beforeEach(() => {
  fetchMock.get(
    'https://treestatus.prod.lando.prod.cloudops.mozgcp.net/trees/firefox-autoland',
    {
      result: {
        message_of_the_day: '',
        reason: '',
        status: 'open',
        tree: 'firefox-autoland',
      },
    },
  );
});

afterEach(() => {
  fetchMock.reset();
  history.push('/');
});

describe('SecondaryNavBar', () => {
  const testSecondaryNavBar = (store, props) => {
    return (
      <Provider store={store}>
        <BrowserRouter>
          <SecondaryNavBar
            updateButtonClick={() => {}}
            serverChanged={false}
            filterModel={
              new FilterModel({
                pushRoute: history.push,
                router,
              })
            }
            repos={repos}
            setCurrentRepoTreeStatus={() => {}}
            duplicateJobsVisible={false}
            groupCountsExpanded={false}
            toggleFieldFilterVisible={() => {}}
            {...props}
          />
        </BrowserRouter>
      </Provider>
    );
  };

  test('should 52 unclassified', async () => {
    const store = mockStore({
      pushes: {
        ...initialState,
        allUnclassifiedFailureCount: 52,
        filteredUnclassifiedFailureCount: 0,
      },
      router,
    });
    const { getByText } = render(testSecondaryNavBar(store));

    expect(await waitFor(() => getByText(repoName))).toBeInTheDocument();
    expect(await waitFor(() => getByText('52'))).toBeInTheDocument();
  });

  test('should 22 unclassified and 10 filtered unclassified', async () => {
    const store = mockStore({
      pushes: {
        ...initialState,
        allUnclassifiedFailureCount: 22,
        filteredUnclassifiedFailureCount: 10,
      },
      router,
    });
    const { getByText } = render(testSecondaryNavBar(store));

    expect(await waitFor(() => getByText(repoName))).toBeInTheDocument();
    expect(await waitFor(() => getByText('22'))).toBeInTheDocument();
    expect(await waitFor(() => getByText('10'))).toBeInTheDocument();
  });

  test('should call updateButtonClick, on revision changed button click', async () => {
    const store = mockStore({
      pushes: {
        ...initialState,
      },
      router,
    });

    const props = {
      serverChanged: true,
      updateButtonClick: jest.fn(),
    };

    const { container } = render(testSecondaryNavBar(store, props));
    const el = container.querySelector('#revisionChangedLabel');
    fireEvent.click(el);
    expect(props.updateButtonClick).toHaveBeenCalled();
  });
});
