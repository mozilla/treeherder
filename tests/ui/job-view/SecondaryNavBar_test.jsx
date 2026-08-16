
import { useRef, useState } from 'react';
import fetchMock from 'fetch-mock';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import FilterModel from '../../../ui/models/filter';
import SecondaryNavBar from '../../../ui/job-view/headerbars/SecondaryNavBar';
import {
  usePushesStore,
  initialState,
} from '../../../ui/shared/stores/pushesStore';
import repos from '../mock/repositories';

const repoName = 'autoland';
const mockLocation = { search: `?repo=${repoName}`, pathname: '/jobs' };
const mockNavigate = jest.fn();

beforeEach(() => {
  fetchMock.get(
    'https://lando.moz.tools/api/treestatus/trees/firefox-autoland',
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

afterEach(() => {
  usePushesStore.setState({ ...initialState });
});

afterEach(() => {
  localStorage.clear();
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
          isFilterPanelOpen={false}
          toggleFilterPanel={() => {}}
          classificationTypes={[]}
          {...props}
        />
      </MemoryRouter>
    );
  };

  test('should 52 unclassified', async () => {
    usePushesStore.setState({
      ...initialState,
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
    usePushesStore.setState({
      ...initialState,
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
    usePushesStore.setState({
      ...initialState,
    });

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

  test('shows the advanced filter trigger and opens panel on click', async () => {
    usePushesStore.setState({ ...initialState });
    const toggleFilterPanel = jest.fn();
    render(testSecondaryNavBar({ toggleFilterPanel }));

    await waitFor(() => {
      expect(screen.getByText(repoName)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Advanced filters'));
    expect(toggleFilterPanel).toHaveBeenCalled();
  });

  test('shows an active filter count badge when filters are set', async () => {
    usePushesStore.setState({ ...initialState });
    const filterModel = new FilterModel(mockNavigate, {
      search: `?repo=${repoName}&platform=linux&startdate=2026-08-01`,
      pathname: '/jobs',
    });
    render(testSecondaryNavBar({ filterModel }));

    await waitFor(() => {
      expect(screen.getByTitle('2 active filters')).toBeInTheDocument();
    });
  });

  test('shows the coach mark on first render and dismisses forever', async () => {
    usePushesStore.setState({ ...initialState });
    render(testSecondaryNavBar());

    await waitFor(() => {
      expect(screen.getByText(/New: advanced filters/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(/New: advanced filters/)).not.toBeInTheDocument();
    expect(localStorage.getItem('thAdvancedFilterCoachMarkSeen')).toBeTruthy();
  });

  test('does not show the coach mark once seen', async () => {
    localStorage.setItem('thAdvancedFilterCoachMarkSeen', '1');
    usePushesStore.setState({ ...initialState });
    render(testSecondaryNavBar());

    await waitFor(() => {
      expect(screen.getByText(repoName)).toBeInTheDocument();
    });
    expect(screen.queryByText(/New: advanced filters/)).not.toBeInTheDocument();
  });

  // Regression test: clicking the trigger while the panel is open used to
  // fire both the Overlay's rootClose (onHide -> toggle -> close) and the
  // button's own onClick (toggle -> reopen), so the two toggles canceled
  // out and the panel could never be closed by clicking the trigger again.
  test('clicking the trigger again while the panel is open closes it', async () => {
    usePushesStore.setState({ ...initialState });

    const StatefulSecondaryNavBar = () => {
      const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
      const toggleFilterPanel = () => setIsFilterPanelOpen((prev) => !prev);
      const filterModel = useRef(
        new FilterModel(mockNavigate, mockLocation),
      ).current;

      return (
        <MemoryRouter initialEntries={[`/jobs?repo=${repoName}`]}>
          <SecondaryNavBar
            updateButtonClick={() => {}}
            serverChanged={false}
            filterModel={filterModel}
            repos={repos}
            setCurrentRepoTreeStatus={() => {}}
            duplicateJobsVisible={false}
            groupCountsExpanded={false}
            isFilterPanelOpen={isFilterPanelOpen}
            toggleFilterPanel={toggleFilterPanel}
            classificationTypes={[]}
          />
        </MemoryRouter>
      );
    };

    render(<StatefulSecondaryNavBar />);

    await waitFor(() => {
      expect(screen.getByText(repoName)).toBeInTheDocument();
    });

    const trigger = screen.getByLabelText('Advanced filters');

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByText('Result status')).toBeInTheDocument();
    });

    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.queryByText('Result status')).not.toBeInTheDocument();
    });
  });
});
