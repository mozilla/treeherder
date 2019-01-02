import React from 'react';
import PropTypes from 'prop-types';
import findLastIndex from 'lodash/findLastIndex';

export const NotificationsContext = React.createContext({});
const maxTransientNotifications = 5;
const maxStoredNotifications = 40;

export class Notifications extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      notifications: [],
      storedNotifications: JSON.parse(
        localStorage.getItem('notifications') || '[]',
      ),
    };
    this.value = {
      ...this.state,
      notify: this.notify,
      removeNotification: this.removeNotification,
      clearStoredNotifications: this.clearStoredNotifications,
      clearOnScreenNotifications: this.clearOnScreenNotifications,
    };
  }

  componentDidMount() {
    window.addEventListener('storage', this.handleStorageEvent);
  }

  componentWillUnmount() {
    window.removeEventListener('storage', this.handleStorageEvent);
  }

  setValue = (newState, callback) => {
    this.value = { ...this.value, ...newState };
    this.setState(newState, callback);
  };

  handleStorageEvent = e => {
    if (e.key === 'notifications') {
      this.setValue({
        storedNotifications: JSON.parse(
          localStorage.getItem('notifications') || '[]',
        ),
      });
    }
  };

  notify = (message, severity, opts) => {
    opts = opts || {};
    severity = severity || 'info';
    const { notifications, storedNotifications } = this.state;
    const notification = { ...opts, message, severity, created: Date.now() };
    const trimmedNotifications =
      notifications >= maxTransientNotifications
        ? this.withoutOldestTransient(notifications)
        : notifications;

    const newNotifications = [notification, ...trimmedNotifications];

    storedNotifications.unshift(notification);
    storedNotifications.splice(maxStoredNotifications);
    localStorage.setItem('notifications', JSON.stringify(storedNotifications));

    this.setValue(
      {
        notifications: newNotifications,
        storedNotifications: [...storedNotifications],
      },
      () => {
        if (!opts.sticky) {
          setTimeout(this.shift, 4000, true);
        }
      },
    );
  };

  /*
   * remove an arbitrary element from the notifications queue
   */
  removeNotification = (index, delay = 0) => {
    const { notifications } = this.state;

    notifications.splice(index, 1);
    setTimeout(
      () => this.setValue({ notifications: [...notifications] }),
      delay,
    );
  };

  /*
   * Delete the first non-sticky element from the notifications queue
   */
  shift = delay => {
    const { notifications } = this.state;

    this.removeNotification(notifications.findIndex(n => !n.sticky), delay);
  };

  withoutOldestTransient = notifications => {
    const last = findLastIndex(notifications, n => !n.sticky);

    if (last) {
      notifications.splice(last, 1);
    }
    return notifications;
  };

  /*
   * Clear the list of stored notifications
   */
  clearStoredNotifications = () => {
    const storedNotifications = [];

    localStorage.setItem('notifications', storedNotifications);
    this.setValue({ storedNotifications });
  };

  clearOnScreenNotifications = () => {
    this.setValue({ notifications: [] });
  };

  render() {
    return (
      <NotificationsContext.Provider value={this.value}>
        {this.props.children}
      </NotificationsContext.Provider>
    );
  }
}

Notifications.propTypes = {
  children: PropTypes.object.isRequired,
};

export function withNotifications(Component) {
  return function NotificationComponent(props) {
    return (
      <NotificationsContext.Consumer>
        {context => (
          <Component
            {...props}
            notifications={context.notifications}
            storedNotifications={context.storedNotifications}
            notify={context.notify}
            removeNotification={context.removeNotification}
            clearStoredNotifications={context.clearStoredNotifications}
            clearOnScreenNotifications={context.clearOnScreenNotifications}
          />
        )}
      </NotificationsContext.Consumer>
    );
  };
}
