import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBan,
  faCheck,
  faCircle,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';

import { withNotifications } from './context/Notifications';

class NotificationList extends React.Component {
  static getIcon(severity) {
    // TODO: Move this and the usage in NotificationsMenu to a shared component.
    switch (severity) {
      case 'danger':
        return faBan;
      case 'warning':
        return faExclamationTriangle;
      case 'info':
        return faCircle;
      case 'success':
        return faCheck;
    }
  }

  render() {
    const { notifications, removeNotification } = this.props;

    return (
      <ul id="notification-box" className="list-unstyled">
        {notifications.map((notification, idx) => (
          <li key={notification.created}>
            <div className={`alert alert-${notification.severity}`}>
              <FontAwesomeIcon
                icon={NotificationList.getIcon(notification.severity)}
                title={notification.severity}
              />
              <span>{notification.message}</span>
              {notification.url && notification.linkText && (
                <span>
                  <a href={notification.url}>{notification.linkText}</a>
                </span>
              )}
              {notification.sticky && (
                <button
                  type="button"
                  onClick={() => removeNotification(idx)}
                  className="close"
                >
                  x
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }
}

NotificationList.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      created: PropTypes.number.isRequired,
      message: PropTypes.string.isRequired,
      // TODO: Enforce specific severity strings
      severity: PropTypes.string.isRequired,
      sticky: PropTypes.bool,
    }),
  ).isRequired,
  removeNotification: PropTypes.func.isRequired,
};

export default withNotifications(NotificationList);
