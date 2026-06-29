import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import {
  clearNotificationAtIndex,
  clearExpiredTransientNotifications,
} from '../../helpers/notifications';

const MAX_STORED_NOTIFICATIONS = 40;
const LOCAL_STORAGE_KEY = 'notifications';

const getInitialStoredNotifications = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const useNotificationStore = create(
  devtools(
    (set) => ({
      notifications: [],
      storedNotifications: getInitialStoredNotifications(),

      notify: (message, severity = 'darker-info', options = {}) => {
        const notification = {
          ...options,
          message,
          severity,
          created: Date.now(),
        };

        set((state) => {
          const newStoredNotifications = [
            notification,
            ...state.storedNotifications,
          ].slice(0, MAX_STORED_NOTIFICATIONS);

          localStorage.setItem(
            LOCAL_STORAGE_KEY,
            JSON.stringify(newStoredNotifications),
          );

          return {
            notifications: [notification, ...state.notifications],
            storedNotifications: newStoredNotifications,
          };
        });
      },

      clearNotification: (index) => {
        set((state) => clearNotificationAtIndex(state.notifications, index));
      },

      clearExpiredNotifications: () => {
        set((state) => clearExpiredTransientNotifications(state.notifications));
      },

      clearAllOnScreenNotifications: () => {
        set({ notifications: [] });
      },

      clearStoredNotifications: () => {
        localStorage.setItem(LOCAL_STORAGE_KEY, '[]');
        set({ storedNotifications: [] });
      },
    }),
    { name: 'notification-store' },
  ),
);

// Export a standalone notify function for use outside React components
export const notify = (message, severity, options) => {
  useNotificationStore.getState().notify(message, severity, options);
};
