import React from 'react';
import PropTypes from 'prop-types';

import { withNotifications } from './context/Notifications';

class NotificationList extends React.Component {
  static getSeverityClass(severity) {
    switch (severity) {
      case 'danger':
        return 'fa fa-ban';
      case 'warning':
        return 'fa fa-warning';
      case 'info':
        return 'fa fa-circle';
      case 'success':
        return 'fa fa-check';
    }
  }

  render() {
    const { notifications, removeNotification } = this.props;

    return (
      <ul id="notification-box" className="list-unstyled">
        {notifications.map((notification, idx) => (
          <li key={notification.created}>
            <div className={`alert alert-${notification.severity}`}>
              <span
                className={NotificationList.getSeverityClass(notification.severity)}
              />
              <span>{notification.message}</span>
              {notification.url && notification.linkText && <span>
                <a href={notification.url}>{notification.linkText}</a>
              </span>}
              {notification.sticky && <button
                onClick={() => removeNotification(idx)}
                className="close"
              >x</button>}
            </div>
          </li>))}
      </ul>
    );
  }
}

NotificationList.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      created: PropTypes.number.isRequired,
      message: PropTypes.string.isRequired,
      severity: PropTypes.string.isRequired,
      sticky: PropTypes.bool,
    }),
  ).isRequired,
  removeNotification: PropTypes.func.isRequired,
};

export default withNotifications(NotificationList);
