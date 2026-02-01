
import fetchMock from 'fetch-mock';
import { Provider } from 'react-redux';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';
import { MemoryRouter } from 'react-router-dom';

import FilterModel from '../../../ui/models/filter';
import SecondaryNavBar from '../../../ui/job-view/headerbars/SecondaryNavBar';
import { initialState } from '../../../ui/job-view/redux/stores/pushes';
import repos from '../mock/repositories';

const mockStore = configureMockStore([thunk]);
const repoName = 'autoland';
const mockLocation = { search: `?repo=${repoName}`, pathname: '/jobs' };
const mockNavigate = jest.fn();

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
  mockNavigate.mockClear();
});

describe('SecondaryNavBar', () => {
  const testSecondaryNavBar = (store, props) => {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[`/jobs?repo=${repoName}`]}>
          <SecondaryNavBar
            updateButtonClick={() => {}}
            serverChanged={false}
            filterModel={new FilterModel(mockNavigate, mockLocation)}
            repos={repos}
            setCurrentRepoTreeStatus={() => {}}
            duplicateJobsVisible={false}
            groupCountsExpanded={false}
            toggleFieldFilterVisible={() => {}}
            {...props}
          />
        </MemoryRouter>
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
    });
    render(testSecondaryNavBar(store));

    await waitFor(() => {
      expect(screen.getByText(repoName)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('52')).toBeInTheDocument();
    });
  });

  test('should 22 unclassified and 10 filtered unclassified', async () => {
    const store = mockStore({
      pushes: {
        ...initialState,
        allUnclassifiedFailureCount: 22,
        filteredUnclassifiedFailureCount: 10,
      },
    });
    render(testSecondaryNavBar(store));

    await waitFor(() => {
      expect(screen.getByText(repoName)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('22')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  test('should call updateButtonClick, on revision changed button click', async () => {
    const store = mockStore({
      pushes: {
        ...initialState,
      },
    });

    const props = {
      serverChanged: true,
      updateButtonClick: jest.fn(),
    };

    const { container } = render(testSecondaryNavBar(store, props));

    // Wait for component to finish initial async operations
    await waitFor(() => {
      expect(screen.getByText(repoName)).toBeInTheDocument();
    });

    const el = container.querySelector('#revisionChangedLabel');
    fireEvent.click(el);

    await waitFor(() => {
      expect(props.updateButtonClick).toHaveBeenCalled();
    });
  });
});
