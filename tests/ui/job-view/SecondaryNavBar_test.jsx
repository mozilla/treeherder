import React from 'react';
import fetchMock from 'fetch-mock';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import FilterModel from '../../../ui/models/filter';
import SecondaryNavBar from '../../../ui/job-view/headerbars/SecondaryNavBar';
import repos from '../mock/repositories';
import { usePushStore } from '../../../ui/job-view/stores/pushStore';
import { useSelectedJobStore } from '../../../ui/job-view/stores/selectedJobStore';
import { usePinnedJobsStore } from '../../../ui/job-view/stores/pinnedJobsStore';

const repoName = 'autoland';
const mockLocation = { search: `?repo=${repoName}`, pathname: '/jobs' };
const mockNavigate = jest.fn();

beforeEach(() => {
  // Reset Zustand stores
  usePushStore.setState({
    pushList: [],
    jobMap: {},
    decisionTaskMap: {},
    revisionTips: [],
    allUnclassifiedFailureCount: 0,
    filteredUnclassifiedFailureCount: 0,
  });
  useSelectedJobStore.setState({
    selectedJob: null,
  });
  usePinnedJobsStore.setState({
    pinnedJobs: {},
    isPinBoardVisible: false,
  });

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
  const testSecondaryNavBar = (props) => {
    return (
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
    );
  };

  test('should 52 unclassified', async () => {
    // Set Zustand store state
    usePushStore.setState({
      allUnclassifiedFailureCount: 52,
      filteredUnclassifiedFailureCount: 0,
    });

    render(testSecondaryNavBar());

    await waitFor(() => {
      expect(screen.getByText(repoName)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('52')).toBeInTheDocument();
    });
  });

  test('should 22 unclassified and 10 filtered unclassified', async () => {
    // Set Zustand store state
    usePushStore.setState({
      allUnclassifiedFailureCount: 22,
      filteredUnclassifiedFailureCount: 10,
    });

    render(testSecondaryNavBar());

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
    const props = {
      serverChanged: true,
      updateButtonClick: jest.fn(),
    };

    const { container } = render(testSecondaryNavBar(props));

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
