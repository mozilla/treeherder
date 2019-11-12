import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-regular-svg-icons';
import {
  faBan,
  faCheck,
  faExclamationTriangle,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';

import { shortDateFormat } from '../../helpers/display';
import { clearStoredNotifications } from '../redux/stores/notifications';

class NotificationsMenu extends React.Component {
  // eslint-disable-next-line class-methods-use-this
  getIcon(severity) {
    // TODO: Move this and the usage in NotificationsList to a shared component.
    const severityObj = {
      danger: faBan,
      warning: faExclamationTriangle,
      info: faInfoCircle,
      success: faCheck,
    };
    return severityObj[severity];
  }

  render() {
    const { storedNotifications, clearStoredNotifications } = this.props;

    return (
      <span className="dropdown">
        <button
          id="notificationLabel"
          type="button"
          title="Recent notifications"
          aria-label="Recent notifications"
          data-toggle="dropdown"
          className="btn btn-view-nav nav-menu-btn"
        >
          <FontAwesomeIcon
            icon={faBell}
            className="lightgray"
            title="Recent notifications"
          />
        </button>
        <ul
          id="notification-dropdown"
          className="dropdown-menu nav-dropdown-menu-right"
          role="menu"
          aria-labelledby="notificationLabel"
        >
          <li
            role="presentation"
            className="dropdown-header"
            title="Notifications"
          >
            Recent notifications
            {!!storedNotifications.length && (
              <button
                type="button"
                className="btn btn-xs btn-light-bordered notification-dropdown-btn"
                title="Clear all notifications"
                onClick={clearStoredNotifications}
              >
                Clear all
              </button>
            )}
          </li>
          {storedNotifications.length ? (
            storedNotifications.map(notification => (
              <li
                className="notification-dropdown-line"
                key={`${notification.created}${notification.message}`}
              >
                <span
                  title={`${notification.message} ${notification.linkText}`}
                >
                  <FontAwesomeIcon
                    icon={this.getIcon(notification.severity)}
                    className={`text-${notification.severity}`}
                    title={notification.severity}
                  />
                  &nbsp;
                  <small className="text-muted">
                    {new Date(notification.created).toLocaleString(
                      'en-US',
                      shortDateFormat,
                    )}
                  </small>
                  &nbsp;{notification.message}&nbsp;
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={notification.url}
                  >
                    {notification.linkText}
                  </a>
                </span>
              </li>
            ))
          ) : (
            <li>
              <span>No recent notifications</span>
            </li>
          )}
        </ul>
      </span>
    );
  }
}

NotificationsMenu.propTypes = {
  storedNotifications: PropTypes.array.isRequired,
  clearStoredNotifications: PropTypes.func.isRequired,
};

const mapStateToProps = ({ notifications: { storedNotifications } }) => ({
  storedNotifications,
});

export default connect(mapStateToProps, { clearStoredNotifications })(
  NotificationsMenu,
);
