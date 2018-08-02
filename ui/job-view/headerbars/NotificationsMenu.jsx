import React from 'react';
import PropTypes from 'prop-types';

import { toShortDateStr } from '../../helpers/display';

export default class NotificationsMenu extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.thNotify = $injector.get('thNotify');

    this.state = {
      notifications: [],
    };
  }

  componentDidMount() {
    this.unlistenStorage = window.addEventListener('storage', (e) => {
      if (e.key === 'notifications') {
        this.changeCallback(JSON.parse(localStorage.getItem('notifications') || '[]'));
      }
    });

    this.changeCallback = this.changeCallback.bind(this);
    this.thNotify.setChangeCallback(this.changeCallback);
    this.changeCallback(this.thNotify.storedNotifications);
  }

  componentWillUnmount() {
    this.unlistenStorage();
  }

  getSeverityClass(severity) {
    switch (severity) {
      case 'danger': return 'fa fa-ban text-danger';
      case 'warning': return 'fa fa-warning text-warning';
      case 'success': return 'fa fa-check text-success';
    }
    return 'fa fa-info-circle text-info';
  }

  changeCallback(notifications) {
    this.setState({ notifications });
  }

  render() {
    const { notifications } = this.state;

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
            {!!notifications.length && <button
              className="btn btn-xs btn-light-bordered notification-dropdown-btn"
              title="Clear all notifications"
              onClick={this.thNotify.clear}
            >Clear all</button>}
          </li>
          {notifications.length ?
            notifications.map(notification => (
              <li
                className="notification-dropdown-line"
                key={notification.created}
              >
                <span title={`${notification.message} ${notification.linkText}`}>
                  <span className={this.getSeverityClass(notification.severity)} />&nbsp;
                  <small className="text-muted">{toShortDateStr(notification.created)}</small>
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
  $injector: PropTypes.object.isRequired,
};
