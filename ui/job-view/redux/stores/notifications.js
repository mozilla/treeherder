import {
  clearNotificationAtIndex,
  clearExpiredTransientNotifications,
} from '../../../helpers/notifications';

const MAX_STORED_NOTIFICATIONS = 40;
const LOCAL_STORAGE_KEY = 'notifications';

// *** Event types ***
export const NOTIFY = 'NOTIFY';
export const CLEAR = 'CLEAR';
export const CLEAR_EXPIRED_TRANSIENTS = 'CLEAR_EXPIRED_TRANSIENTS';
export const CLEAR_ALL_ON_SCREEN = 'CLEAR_ALL_ON_SCREEN';
export const CLEAR_STORED = 'CLEAR_STORED';

// *** Action creators ***
export const clearAllOnScreenNotifications = () => ({
  type: CLEAR_ALL_ON_SCREEN,
});

export const clearNotification = (index) => ({
  type: CLEAR,
  index,
});

export const clearStoredNotifications = () => ({
  type: CLEAR_STORED,
});

export const notify = (message, severity, options) => ({
  type: NOTIFY,
  message,
  severity,
  options,
});

// *** Implementation ***
const doNotify = (
  { notifications, storedNotifications },
  message,
  severity = 'info',
  options = {},
) => {
  const notification = {
    ...options,
    message,
    severity,
    created: Date.now(),
  };
  const newNotifications = [notification, ...notifications];

  storedNotifications.unshift(notification);
  storedNotifications.splice(MAX_STORED_NOTIFICATIONS);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedNotifications));

  return {
    notifications: newNotifications,
    storedNotifications: [...storedNotifications],
  };
};

const doClearStoredNotifications = () => {
  const storedNotifications = [];

  localStorage.setItem(LOCAL_STORAGE_KEY, storedNotifications);
  return { storedNotifications };
};

const doClearAllOnScreenNotifications = () => {
  return { notifications: [] };
};

const initialState = {
  notifications: [],
  storedNotifications: JSON.parse(
    localStorage.getItem(LOCAL_STORAGE_KEY) || '[]',
  ),
};

export const reducer = (state = initialState, action) => {
  const { message, severity, options, index } = action;

  switch (action.type) {
    case NOTIFY:
      return { ...state, ...doNotify(state, message, severity, options) };
    case CLEAR:
      return {
        ...state,
        ...clearNotificationAtIndex(state.notifications, index),
      };
    case CLEAR_EXPIRED_TRANSIENTS:
      return {
        ...state,
        ...clearExpiredTransientNotifications(state.notifications),
      };
    case CLEAR_ALL_ON_SCREEN:
      return { ...state, ...doClearAllOnScreenNotifications() };
    case CLEAR_STORED:
      return { ...state, ...doClearStoredNotifications() };
    default:
      return state;
  }
};
