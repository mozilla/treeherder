export const MAX_TRANSIENT_AGE = 4000;

/*
 * Clear any expired transient notifications
 */
export const clearExpiredTransientNotifications = (notifications) => {
  const cleanedNotifications = notifications.reduce((acc, note) => {
    return note.sticky || Date.now() - note.created < MAX_TRANSIENT_AGE
      ? [...acc, note]
      : acc;
  }, []);

  return cleanedNotifications.length !== notifications.length
    ? { notifications: cleanedNotifications }
    : { notifications };
};

export const clearNotificationAtIndex = (notifications, index) => {
  notifications.splice(index, 1);

  return { notifications: [...notifications] };
};
