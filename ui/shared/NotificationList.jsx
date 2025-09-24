import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBan,
  faCheck,
  faCircle,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import { Alert, Button } from 'reactstrap';

class NotificationList extends React.Component {
  static getIcon(severity) {
    // TODO: Move this and the usage in NotificationsMenu to a shared component.
    switch (severity) {
      case 'danger':
        return faBan;
      case 'warning':
        return faExclamationTriangle;
      case 'darker-info':
        return faCircle;
      case 'success':
        return faCheck;
    }
  }

  render() {
    const { notifications, clearNotification } = this.props;

    return (
      <ul id="notification-box" className="list-unstyled">
        {notifications.map((notification, idx) => (
          <li key={notification.created}>
            <Alert color={notification.severity}>
              <FontAwesomeIcon
                icon={NotificationList.getIcon(notification.severity)}
                title={notification.severity}
              />
              <span className="ml-1">{notification.message}</span>
              {notification.url && notification.linkText && (
                <span>
                  <a href={notification.url}>{notification.linkText}</a>
                </span>
              )}
              {notification.sticky && (
                <Button
                  onClick={() => clearNotification(idx)}
                  className="close pt-1"
                >
                  x
                </Button>
              )}
            </Alert>
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
      severity: PropTypes.oneOf([
        'danger',
        'warning',
        'darker-info',
        'success',
      ]),
      sticky: PropTypes.bool,
    }),
  ).isRequired,
  clearNotification: PropTypes.func.isRequired,
};

export default NotificationList;
