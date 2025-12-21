import { cleanup } from '@testing-library/react';

import {
  useNotificationStore,
  notify,
} from '../../../../ui/job-view/stores/notificationStore';
import { MAX_TRANSIENT_AGE } from '../../../../ui/helpers/notifications';

const LOCAL_STORAGE_KEY = 'notifications';
const MAX_STORED_NOTIFICATIONS = 40;

describe('Notification Zustand store', () => {
  let originalLocalStorage;

  beforeEach(() => {
    // Mock localStorage
    originalLocalStorage = global.localStorage;
    const localStorageMock = {
      store: {},
      getItem(key) {
        return this.store[key] || null;
      },
      setItem(key, value) {
        this.store[key] = value;
      },
      clear() {
        this.store = {};
      },
    };
    global.localStorage = localStorageMock;

    // Reset store before each test
    useNotificationStore.setState({
      notifications: [],
      storedNotifications: [],
    });
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    global.localStorage = originalLocalStorage;
  });

  describe('notify', () => {
    test('should add a notification with default severity', () => {
      const message = 'Test notification';
      useNotificationStore.getState().notify(message);
      const state = useNotificationStore.getState();

      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].message).toBe(message);
      expect(state.notifications[0].severity).toBe('darker-info');
      expect(state.notifications[0].created).toBeDefined();
    });

    test('should add a notification with custom severity', () => {
      const message = 'Error occurred';
      const severity = 'danger';
      useNotificationStore.getState().notify(message, severity);
      const state = useNotificationStore.getState();

      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].message).toBe(message);
      expect(state.notifications[0].severity).toBe(severity);
    });

    test('should add a notification with custom options', () => {
      const message = 'Important message';
      const options = { sticky: true, linkText: 'Click here', url: '/test' };
      useNotificationStore.getState().notify(message, 'warning', options);
      const state = useNotificationStore.getState();

      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].sticky).toBe(true);
      expect(state.notifications[0].linkText).toBe('Click here');
      expect(state.notifications[0].url).toBe('/test');
    });

    test('should store notifications in localStorage', () => {
      const message = 'Stored notification';
      useNotificationStore.getState().notify(message);

      const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
      expect(stored).toHaveLength(1);
      expect(stored[0].message).toBe(message);
    });

    test('should add new notifications to the beginning of the list', () => {
      useNotificationStore.getState().notify('First');
      useNotificationStore.getState().notify('Second');
      useNotificationStore.getState().notify('Third');
      const state = useNotificationStore.getState();

      expect(state.notifications).toHaveLength(3);
      expect(state.notifications[0].message).toBe('Third');
      expect(state.notifications[1].message).toBe('Second');
      expect(state.notifications[2].message).toBe('First');
    });

    test('should limit stored notifications to MAX_STORED_NOTIFICATIONS', () => {
      // Add more than MAX_STORED_NOTIFICATIONS
      for (let i = 0; i < MAX_STORED_NOTIFICATIONS + 10; i++) {
        useNotificationStore.getState().notify(`Notification ${i}`);
      }

      const state = useNotificationStore.getState();
      expect(state.storedNotifications).toHaveLength(MAX_STORED_NOTIFICATIONS);

      const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY));
      expect(stored).toHaveLength(MAX_STORED_NOTIFICATIONS);
    });

    test('standalone notify function should work', () => {
      notify('Standalone notification', 'success');
      const state = useNotificationStore.getState();

      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].message).toBe('Standalone notification');
      expect(state.notifications[0].severity).toBe('success');
    });
  });

  describe('clearNotification', () => {
    test('should remove notification at specified index', () => {
      useNotificationStore.getState().notify('First');
      useNotificationStore.getState().notify('Second');
      useNotificationStore.getState().notify('Third');

      // Remove the middle notification (index 1)
      useNotificationStore.getState().clearNotification(1);
      const state = useNotificationStore.getState();

      expect(state.notifications).toHaveLength(2);
      expect(state.notifications[0].message).toBe('Third');
      expect(state.notifications[1].message).toBe('First');
    });

    test('should handle clearing first notification', () => {
      useNotificationStore.getState().notify('First');
      useNotificationStore.getState().notify('Second');

      useNotificationStore.getState().clearNotification(0);
      const state = useNotificationStore.getState();

      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].message).toBe('First');
    });

    test('should handle clearing last notification', () => {
      useNotificationStore.getState().notify('First');
      useNotificationStore.getState().notify('Second');

      useNotificationStore.getState().clearNotification(1);
      const state = useNotificationStore.getState();

      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].message).toBe('Second');
    });
  });

  describe('clearExpiredNotifications', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should remove expired transient notifications', () => {
      const now = Date.now();
      jest.setSystemTime(now);

      // Add sticky notification
      useNotificationStore.getState().notify('Sticky', 'info', { sticky: true });

      // Add old transient notification
      useNotificationStore.setState((state) => ({
        notifications: [
          ...state.notifications,
          {
            message: 'Old transient',
            severity: 'info',
            created: now - MAX_TRANSIENT_AGE - 1000,
          },
        ],
      }));

      // Add recent transient notification
      useNotificationStore.getState().notify('Recent transient');

      // Clear expired notifications
      useNotificationStore.getState().clearExpiredNotifications();
      const state = useNotificationStore.getState();

      // Should keep sticky and recent transient, remove old transient
      expect(state.notifications).toHaveLength(2);
      expect(state.notifications.find((n) => n.message === 'Sticky')).toBeDefined();
      expect(state.notifications.find((n) => n.message === 'Recent transient')).toBeDefined();
      expect(state.notifications.find((n) => n.message === 'Old transient')).toBeUndefined();
    });

    test('should keep all notifications if none are expired', () => {
      const now = Date.now();
      jest.setSystemTime(now);

      useNotificationStore.getState().notify('Recent 1');
      useNotificationStore.getState().notify('Recent 2', 'info', { sticky: true });
      useNotificationStore.getState().notify('Recent 3');

      useNotificationStore.getState().clearExpiredNotifications();
      const state = useNotificationStore.getState();

      expect(state.notifications).toHaveLength(3);
    });

    test('should handle empty notifications array', () => {
      useNotificationStore.getState().clearExpiredNotifications();
      const state = useNotificationStore.getState();

      expect(state.notifications).toEqual([]);
    });
  });

  describe('clearAllOnScreenNotifications', () => {
    test('should clear all on-screen notifications', () => {
      useNotificationStore.getState().notify('First');
      useNotificationStore.getState().notify('Second');
      useNotificationStore.getState().notify('Third');

      useNotificationStore.getState().clearAllOnScreenNotifications();
      const state = useNotificationStore.getState();

      expect(state.notifications).toEqual([]);
    });

    test('should not affect stored notifications', () => {
      useNotificationStore.getState().notify('First');
      useNotificationStore.getState().notify('Second');

      const beforeClear = useNotificationStore.getState().storedNotifications;
      useNotificationStore.getState().clearAllOnScreenNotifications();
      const afterClear = useNotificationStore.getState().storedNotifications;

      expect(afterClear).toEqual(beforeClear);
      expect(afterClear).toHaveLength(2);
    });
  });

  describe('clearStoredNotifications', () => {
    test('should clear stored notifications', () => {
      useNotificationStore.getState().notify('First');
      useNotificationStore.getState().notify('Second');

      useNotificationStore.getState().clearStoredNotifications();
      const state = useNotificationStore.getState();

      expect(state.storedNotifications).toEqual([]);
    });

    test('should clear localStorage', () => {
      useNotificationStore.getState().notify('First');
      useNotificationStore.getState().notify('Second');

      expect(localStorage.getItem(LOCAL_STORAGE_KEY)).not.toBe('[]');

      useNotificationStore.getState().clearStoredNotifications();

      expect(localStorage.getItem(LOCAL_STORAGE_KEY)).toBe('[]');
    });

    test('should not affect on-screen notifications', () => {
      useNotificationStore.getState().notify('First');
      useNotificationStore.getState().notify('Second');

      const beforeClear = useNotificationStore.getState().notifications;
      useNotificationStore.getState().clearStoredNotifications();
      const afterClear = useNotificationStore.getState().notifications;

      expect(afterClear).toEqual(beforeClear);
      expect(afterClear).toHaveLength(2);
    });
  });

  describe('initial state from localStorage', () => {
    test('should load stored notifications from localStorage on init', () => {
      const storedNotifs = [
        { message: 'Stored 1', severity: 'info', created: Date.now() },
        { message: 'Stored 2', severity: 'warning', created: Date.now() },
      ];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedNotifs));

      // Re-import to trigger initialization
      jest.resetModules();
      const {
        useNotificationStore: freshStore,
      } = require('../../../../ui/job-view/stores/notificationStore');

      const state = freshStore.getState();
      expect(state.storedNotifications).toHaveLength(2);
      expect(state.storedNotifications[0].message).toBe('Stored 1');
      expect(state.storedNotifications[1].message).toBe('Stored 2');
    });

    test('should handle invalid JSON in localStorage', () => {
      localStorage.setItem(LOCAL_STORAGE_KEY, 'invalid json');

      jest.resetModules();
      const {
        useNotificationStore: freshStore,
      } = require('../../../../ui/job-view/stores/notificationStore');

      const state = freshStore.getState();
      expect(state.storedNotifications).toEqual([]);
    });

    test('should handle missing localStorage item', () => {
      localStorage.clear();

      jest.resetModules();
      const {
        useNotificationStore: freshStore,
      } = require('../../../../ui/job-view/stores/notificationStore');

      const state = freshStore.getState();
      expect(state.storedNotifications).toEqual([]);
    });
  });
});
