import { useState } from 'react';
import fetchMock from 'fetch-mock';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import PrimaryNavBar from '../../../../ui/job-view/headerbars/PrimaryNavBar';
import FilterModel from '../../../../ui/models/filter';
import {
  usePushesStore,
  initialState,
} from '../../../../ui/shared/stores/pushesStore';
import repos from '../../mock/repositories';

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
  fetchMock.get('/api/user/', []);
});

afterEach(() => {
  fetchMock.reset();
  mockNavigate.mockClear();
  usePushesStore.setState({ ...initialState });
  localStorage.clear();
});

// Regression test for the PrimaryNavBar's React.memo comparator dropping
// updates to isFilterPanelOpen/classificationTypes. Without those props in
// the comparator, toggling the panel from App never re-renders the memoized
// navbar chain, so the trigger's aria-expanded (and the panel itself) would
// never reflect the new state.
describe('PrimaryNavBar', () => {
  const StatefulPrimaryNavBar = () => {
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const toggleFilterPanel = () => setIsFilterPanelOpen((prev) => !prev);

    return (
      <MemoryRouter initialEntries={[`/jobs?repo=${repoName}`]}>
        <PrimaryNavBar
          repos={repos}
          updateButtonClick={() => {}}
          serverChanged={false}
          filterModel={new FilterModel(mockNavigate, mockLocation)}
          setUser={() => {}}
          user={{ isLoggedIn: false }}
          setCurrentRepoTreeStatus={() => {}}
          getAllShownJobs={() => []}
          duplicateJobsVisible={false}
          groupCountsExpanded={false}
          isFilterPanelOpen={isFilterPanelOpen}
          toggleFilterPanel={toggleFilterPanel}
          classificationTypes={[]}
        />
      </MemoryRouter>
    );
  };

  test('re-renders the memoized navbar chain when the filter panel toggles', async () => {
    usePushesStore.setState({ ...initialState });
    render(<StatefulPrimaryNavBar />);

    const trigger = await screen.findByLabelText('Advanced filters');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
