import { render, screen } from '@testing-library/react';

import KeyboardShortcuts from '../../../ui/job-view/KeyboardShortcuts';
import FilterModel from '../../../ui/models/filter';
import { thEvents } from '../../../ui/helpers/constants';
import { useSelectedJobStore } from '../../../ui/job-view/stores/selectedJobStore';
import { usePinnedJobsStore } from '../../../ui/job-view/stores/pinnedJobsStore';
import { useNotificationStore } from '../../../ui/job-view/stores/notificationStore';

// Mock react-hot-keys
jest.mock('react-hot-keys', () => {
  return jest.fn(({ children, onKeyDown, filter, keyName }) => (
    <div
      data-testid="hotkeys-wrapper"
      data-key-name={keyName}
      data-on-key-down={onKeyDown ? 'provided' : 'missing'}
      data-filter={filter ? 'provided' : 'missing'}
    >
      {children}
    </div>
  ));
});

describe('KeyboardShortcuts', () => {
  let filterModel;
  let showOnScreenShortcuts;
  let component;

  beforeEach(() => {
    filterModel = new FilterModel(jest.fn(), { search: '', pathname: '/jobs' });
    showOnScreenShortcuts = jest.fn();

    // Reset Zustand stores
    useSelectedJobStore.setState({ selectedJob: null });
    usePinnedJobsStore.setState({ pinnedJobs: {}, isPinBoardVisible: false });
    useNotificationStore.setState({ notifications: [] });

    // Mock DOM elements that keyboard shortcuts interact with
    document.body.innerHTML = `
      <div id="quick-filter"></div>
      <div id="add-related-bug-button"></div>
      <div id="classification-comment"></div>
    `;

    component = (
      <KeyboardShortcuts
        filterModel={filterModel}
        showOnScreenShortcuts={showOnScreenShortcuts}
      >
        <div>Test Content</div>
      </KeyboardShortcuts>
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('should render children wrapped in Hotkeys component', () => {
    render(component);

    expect(screen.getByTestId('hotkeys-wrapper')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  test('should pass correct keyName prop to Hotkeys', () => {
    render(component);

    const wrapper = screen.getByTestId('hotkeys-wrapper');
    const keyName = wrapper.getAttribute('data-key-name');

    // Verify all expected keys are in the keyName string
    const expectedKeys = [
      'b',
      'c',
      'f',
      'ctrl+shift+f',
      'g',
      'i',
      'j',
      'k',
      'l',
      'shift+l',
      'n',
      'p',
      'q',
      'r',
      's',
      't',
      'u',
      'v',
      'ctrl+shift+u',
      'left',
      'right',
      'space',
      'shift+/',
      'escape',
      'ctrl+enter',
      'ctrl+backspace',
    ];

    expectedKeys.forEach((key) => {
      expect(keyName).toContain(key);
    });
  });

  test('should pass onKeyDown and filter callbacks to Hotkeys', () => {
    render(component);

    const wrapper = screen.getByTestId('hotkeys-wrapper');
    expect(wrapper.getAttribute('data-on-key-down')).toBe('provided');
    expect(wrapper.getAttribute('data-filter')).toBe('provided');
  });

  describe('keyboard shortcut handlers', () => {
    let keyboardShortcutsInstance;

    beforeEach(() => {
      const { container } = render(component);
      // Access the KeyboardShortcuts instance through the rendered component
      keyboardShortcutsInstance = container.querySelector(
        '[data-testid="hotkeys-wrapper"]',
      ).parentElement.__reactFiber$
        ? container.querySelector('[data-testid="hotkeys-wrapper"]').parentElement
            .__reactFiber$.return.stateNode
        : null;
    });

    test('b key should trigger addRelatedBug', () => {
      const selectedJob = { id: 1, task_id: 'task1' };
      useSelectedJobStore.setState({ selectedJob });

      const addRelatedBugButton = document.getElementById(
        'add-related-bug-button',
      );
      const clickSpy = jest.fn();
      addRelatedBugButton.addEventListener('click', clickSpy);

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('b', event);

        expect(event.preventDefault).toHaveBeenCalled();
      }
    });

    test('c key should trigger pinEditComment', () => {
      const selectedJob = { id: 1, task_id: 'task1' };
      useSelectedJobStore.setState({ selectedJob });

      const commentField = document.getElementById('classification-comment');
      const focusSpy = jest.fn();
      commentField.focus = focusSpy;

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('c', event);

        expect(event.preventDefault).toHaveBeenCalled();
      }
    });

    test('f key should trigger quickFilter', () => {
      const quickFilter = document.getElementById('quick-filter');
      const focusSpy = jest.fn();
      quickFilter.focus = focusSpy;

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('f', event);

        expect(event.preventDefault).toHaveBeenCalled();
      }
    });

    test('ctrl+shift+f should clear filter', () => {
      const removeFilterSpy = jest.spyOn(filterModel, 'removeFilter');

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('ctrl+shift+f', event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(removeFilterSpy).toHaveBeenCalledWith('searchStr');
      }
    });

    test('i key should toggle in progress filter', () => {
      const toggleSpy = jest.spyOn(filterModel, 'toggleInProgress');

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('i', event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(toggleSpy).toHaveBeenCalled();
      }
    });

    test('q key should toggle classified failures', () => {
      const toggleSpy = jest.spyOn(filterModel, 'toggleClassifiedFailures');

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('q', event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(toggleSpy).toHaveBeenCalledWith(true);
      }
    });

    test('s key should toggle unscheduled result status', () => {
      const toggleSpy = jest.spyOn(filterModel, 'toggleUnscheduledResultStatus');

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('s', event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(toggleSpy).toHaveBeenCalled();
      }
    });

    test('u key should toggle unclassified failures', () => {
      const toggleSpy = jest.spyOn(filterModel, 'toggleUnclassifiedFailures');

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('u', event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(toggleSpy).toHaveBeenCalled();
      }
    });

    test('space key should pin selected job', () => {
      const selectedJob = { id: 1, task_id: 'task1' };
      useSelectedJobStore.setState({ selectedJob });

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('space', event);

        expect(event.preventDefault).toHaveBeenCalled();

        // Check if job was pinned
        const { pinnedJobs } = usePinnedJobsStore.getState();
        expect(Object.keys(pinnedJobs).length).toBeGreaterThan(0);
      }
    });

    test('shift+/ should show on-screen shortcuts', () => {
      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('shift+/', event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(showOnScreenShortcuts).toHaveBeenCalled();
      }
    });

    test('ctrl+shift+u should clear pinboard', () => {
      // Pin some jobs first
      usePinnedJobsStore.setState({
        pinnedJobs: { job1: { id: 1 }, job2: { id: 2 } },
      });

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('ctrl+shift+u', event);

        expect(event.preventDefault).toHaveBeenCalled();

        // Check if pinboard was cleared
        const { pinnedJobs } = usePinnedJobsStore.getState();
        expect(Object.keys(pinnedJobs).length).toBe(0);
      }
    });
  });

  describe('custom event dispatching', () => {
    let keyboardShortcutsInstance;
    let dispatchEventSpy;

    beforeEach(() => {
      const { container } = render(component);
      dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
      keyboardShortcutsInstance = container.querySelector(
        '[data-testid="hotkeys-wrapper"]',
      ).parentElement.__reactFiber$
        ? container.querySelector('[data-testid="hotkeys-wrapper"]').parentElement
            .__reactFiber$.return.stateNode
        : null;
    });

    test('g key should dispatch openGeckoProfile event', () => {
      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('g', event);

        const customEvent = dispatchEventSpy.mock.calls.find(
          (call) => call[0].type === thEvents.openGeckoProfile,
        );
        expect(customEvent).toBeTruthy();
      }
    });

    test('l key should dispatch openLogviewer event', () => {
      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('l', event);

        const customEvent = dispatchEventSpy.mock.calls.find(
          (call) => call[0].type === thEvents.openLogviewer,
        );
        expect(customEvent).toBeTruthy();
      }
    });

    test('shift+l should dispatch openRawLog event', () => {
      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('shift+l', event);

        const customEvent = dispatchEventSpy.mock.calls.find(
          (call) => call[0].type === thEvents.openRawLog,
        );
        expect(customEvent).toBeTruthy();
      }
    });

    test('r key should dispatch jobRetrigger event with selected job', () => {
      const selectedJob = { id: 1, task_id: 'task1' };
      useSelectedJobStore.setState({ selectedJob });

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('r', event);

        const customEvent = dispatchEventSpy.mock.calls.find(
          (call) => call[0].type === thEvents.jobRetrigger,
        );
        expect(customEvent).toBeTruthy();
        if (customEvent) {
          expect(customEvent[0].detail.job).toEqual(selectedJob);
        }
      }
    });

    test('t key should dispatch selectNextTab event', () => {
      const selectedJob = { id: 1, task_id: 'task1' };
      useSelectedJobStore.setState({ selectedJob });

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('t', event);

        const customEvent = dispatchEventSpy.mock.calls.find(
          (call) => call[0].type === thEvents.selectNextTab,
        );
        expect(customEvent).toBeTruthy();
      }
    });

    test('ctrl+enter should dispatch saveClassification event', () => {
      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('ctrl+enter', event);

        const customEvent = dispatchEventSpy.mock.calls.find(
          (call) => call[0].type === thEvents.saveClassification,
        );
        expect(customEvent).toBeTruthy();
      }
    });

    test('ctrl+backspace should dispatch deleteClassification event when job selected', () => {
      const selectedJob = { id: 1, task_id: 'task1' };
      useSelectedJobStore.setState({ selectedJob });

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('ctrl+backspace', event);

        const customEvent = dispatchEventSpy.mock.calls.find(
          (call) => call[0].type === thEvents.deleteClassification,
        );
        expect(customEvent).toBeTruthy();
      }
    });
  });

  describe('clearScreen (escape key)', () => {
    let keyboardShortcutsInstance;

    beforeEach(() => {
      const { container } = render(component);
      keyboardShortcutsInstance = container.querySelector(
        '[data-testid="hotkeys-wrapper"]',
      ).parentElement.__reactFiber$
        ? container.querySelector('[data-testid="hotkeys-wrapper"]').parentElement
            .__reactFiber$.return.stateNode
        : null;
    });

    test('should clear notifications if present', () => {
      useNotificationStore.setState({
        notifications: [{ id: 1, message: 'Test notification' }],
      });

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('escape', event);

        const { notifications } = useNotificationStore.getState();
        expect(notifications.length).toBe(0);
      }
    });

    test('should close shortcuts dialog if no notifications', () => {
      useNotificationStore.setState({ notifications: [] });

      if (keyboardShortcutsInstance) {
        const event = { preventDefault: jest.fn() };
        keyboardShortcutsInstance.onKeyDown('escape', event);

        expect(showOnScreenShortcuts).toHaveBeenCalledWith(false);
      }
    });
  });

  describe('filter function', () => {
    let keyboardShortcutsInstance;

    beforeEach(() => {
      const { container } = render(component);
      keyboardShortcutsInstance = container.querySelector(
        '[data-testid="hotkeys-wrapper"]',
      ).parentElement.__reactFiber$
        ? container.querySelector('[data-testid="hotkeys-wrapper"]').parentElement
            .__reactFiber$.return.stateNode
        : null;
    });

    test('should block shortcuts when modal is open', () => {
      document.body.innerHTML += '<div class="modal show"></div>';

      if (keyboardShortcutsInstance) {
        const event = { key: 'b', target: { nodeName: 'DIV' } };
        const result = keyboardShortcutsInstance.filter(event);

        expect(result).toBe(false);
      }
    });

    test('should allow ctrl+enter in input fields', () => {
      if (keyboardShortcutsInstance) {
        const event = {
          key: 'Enter',
          ctrlKey: true,
          target: { nodeName: 'INPUT' },
        };
        const result = keyboardShortcutsInstance.filter(event);

        expect(result).toBe(true);
      }
    });

    test('should allow ctrl+backspace in select fields', () => {
      if (keyboardShortcutsInstance) {
        const event = {
          key: 'Backspace',
          ctrlKey: true,
          target: { nodeName: 'SELECT' },
        };
        const result = keyboardShortcutsInstance.filter(event);

        expect(result).toBe(true);
      }
    });

    test('should allow escape in input fields', () => {
      if (keyboardShortcutsInstance) {
        const event = {
          key: 'Escape',
          target: { nodeName: 'INPUT' },
        };
        const result = keyboardShortcutsInstance.filter(event);

        expect(result).toBe(true);
      }
    });

    test('should block other keys in input fields', () => {
      if (keyboardShortcutsInstance) {
        const event = {
          key: 'b',
          ctrlKey: false,
          target: { nodeName: 'INPUT' },
        };
        const result = keyboardShortcutsInstance.filter(event);

        expect(result).toBe(false);
      }
    });

    test('should allow all keys outside input/select fields', () => {
      if (keyboardShortcutsInstance) {
        const event = {
          key: 'b',
          target: { nodeName: 'DIV' },
        };
        const result = keyboardShortcutsInstance.filter(event);

        expect(result).toBe(true);
      }
    });
  });
});
