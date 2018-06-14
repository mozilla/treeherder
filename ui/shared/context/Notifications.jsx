import React from 'react';
import PropTypes from 'prop-types';

export const NotificationsContext = React.createContext({});

export class Notifications extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      notifications: [],
      storedNotifications: JSON.parse(localStorage.getItem('notifications') || '[]'),
    };
    this.value = {
      ...this.state,
      notify: this.notify,
      removeNotification: this.removeNotification,
      clearStoredNotifications: this.clearStoredNotifications,
    };
  }

  componentDidMount() {
    this.notify = this.notify.bind(this);
    this.removeNotification = this.removeNotification.bind(this);
    this.shift = this.shift.bind(this);
    this.clearStoredNotifications = this.clearStoredNotifications.bind(this);

    this.unlistenStorage = window.addEventListener('storage', (e) => {
      if (e.key === 'notifications') {
        this.setValue({
          storedNotifications: JSON.parse(localStorage.getItem('notifications') || '[]'),
        });
      }
    });

    this.value = {
      ...this.state,
      notify: this.notify,
      removeNotification: this.removeNotification,
      clearStoredNotifications: this.clearStoredNotifications,
    };
  }

  componentWillUnmount() {
    this.unlistenStorage();
  }

  setValue(newState, callback) {
    this.value = { ...this.value, ...newState };
    this.setState(newState, callback);
  }

  notify(message, severity, opts) {
    opts = opts || {};
    severity = severity || 'info';
    const { notifications, storedNotifications } = this.state;
    const maxNsNotifications = 5;
    const notification = { ...opts, message, severity, created: Date.now() };
    const newNotifications = [notification, ...notifications];

    storedNotifications.unshift(notification);
    storedNotifications.splice(40);
    localStorage.setItem('notifications', JSON.stringify(storedNotifications));

    this.setValue(
      { notifications: newNotifications, storedNotifications: [...storedNotifications] },
      () => {
        if (!opts.sticky) {
          if (notifications.length > maxNsNotifications) {
            this.shift();
            return;
          }
          setTimeout(this.shift, 4000, true);
        }
      },
    );
  }

  /*
   * remove an arbitrary element from the notifications queue
   */
  removeNotification(index, delay = 0) {
    const { notifications } = this.state;

    notifications.splice(index, 1);
    setTimeout(() => this.setValue({ notifications: [...notifications] }), delay);
  }

  /*
   * Delete the first non-sticky element from the notifications queue
   */
  shift(delay) {
    const { notifications } = this.state;

    this.removeNotification(notifications.findIndex(n => !n.sticky), delay);
  }

  /*
   * Clear the list of stored notifications
   */
  clearStoredNotifications() {
    const storedNotifications = [];

    localStorage.setItem('notifications', storedNotifications);
    this.setValue({ storedNotifications });
  }

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
          />
        )}
      </NotificationsContext.Consumer>
    );
  };
}
