import NotificationList from './NotificationList';

import { useNotificationStore } from './stores/notificationStore';

const Notifications = () => {
  const notifications = useNotificationStore((state) => state.notifications);
  const clearNotification = useNotificationStore(
    (state) => state.clearNotification,
  );

  return (
    <NotificationList
      notifications={notifications}
      clearNotification={clearNotification}
    />
  );
};

export default Notifications;
