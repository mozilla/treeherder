import React from 'react';
import PropTypes from 'prop-types';

import { shortDateFormat } from '../../helpers/display';
import { withNotifications } from '../../shared/context/Notifications';

class NotificationsMenu extends React.Component {
  getSeverityClass(severity) {
    switch (severity) {
      case 'danger': return 'fa fa-ban text-danger';
      case 'warning': return 'fa fa-warning text-warning';
      case 'success': return 'fa fa-check text-success';
    }
    return 'fa fa-info-circle text-info';
  }

  render() {
    const { storedNotifications, clearStoredNotifications } = this.props;

    return (
      <span className="dropdown">
        <button
          id="notificationLabel"
          title="Recent notifications"
          aria-label="Recent notifications"
          data-toggle="dropdown"
          className="btn btn-view-nav nav-menu-btn"
        ><span className="fa fa-bell-o lightgray" /></button>
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
          >Recent notifications
            {!!storedNotifications.length && <button
              className="btn btn-xs btn-light-bordered notification-dropdown-btn"
              title="Clear all notifications"
              onClick={clearStoredNotifications}
            >Clear all</button>}
          </li>
          {storedNotifications.length ?
            storedNotifications.map(notification => (
              <li
                className="notification-dropdown-line"
                key={`${notification.created}${notification.message}`}
              >
                <span title={`${notification.message} ${notification.linkText}`}>
                  <span className={this.getSeverityClass(notification.severity)} />&nbsp;
                  <small className="text-muted">
                    {new Date(notification.created).toLocaleString('en-US', shortDateFormat)}
                  </small>
                  &nbsp;{notification.message}&nbsp;
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={notification.url}
                  >{notification.linkText}</a>
                </span>
              </li>
            )) :
            <li><span>No recent notifications</span></li>
          }
        </ul>
      </span>
    );
  }
}

NotificationsMenu.propTypes = {
  storedNotifications: PropTypes.array.isRequired,
  clearStoredNotifications: PropTypes.func.isRequired,
};

export default withNotifications(NotificationsMenu);
