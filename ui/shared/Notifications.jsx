import NotificationList from './NotificationList';

import { useNotificationStore } from './stores/notificationStore';

const Notifications = () => {
  const notifications = useNotificationStore((state) => state.notifications);
  const clearNotification = useNotificationStore(
    (state) => state.clearNotification,
  );
  const clearAllNotifications = useNotificationStore(
    (state) => state.clearAllOnScreenNotifications,
  );

  return (
    <NotificationList
      notifications={notifications}
      clearNotification={clearNotification}
      clearAllNotifications={clearAllNotifications}
    />
  );
};

export default Notifications;
