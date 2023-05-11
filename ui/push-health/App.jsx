import React from 'react';
import { hot } from 'react-hot-loader/root';
import { Route, Routes } from 'react-router-dom';

import {
  clearNotificationAtIndex,
  clearExpiredTransientNotifications,
} from '../helpers/notifications';
import NotificationList from '../shared/NotificationList';
import ErrorBoundary from '../shared/ErrorBoundary';
import { genericErrorMessage, errorMessageClass } from '../helpers/constants';

import NotFound from './NotFound';
import Health from './Health';
import Usage from './Usage';
import MyPushes from './MyPushes';
import Navigation from './Navigation';

import '../css/failure-summary.css';
import '../css/lazylog-custom-styles.css';
import '../css/treeherder-job-buttons.css';
import '../css/treeherder-notifications.css';
import './pushhealth.css';
import 'react-tabs/style/react-tabs.css';

function hasProps(search) {
  const params = new URLSearchParams(search);

  return params.get('repo') && params.get('revision');
}

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      user: { isLoggedIn: false },
      notifications: [],
    };
  }

  notify = (message, severity, options = {}) => {
    const { notifications } = this.state;
    const notification = {
      ...options,
      message,
      severity: severity || 'darker-info',
      created: Date.now(),
    };
    const newNotifications = [notification, ...notifications];

    this.setState({
      notifications: newNotifications,
    });
  };

  clearNotification = (index = null) => {
    const { notifications } = this.state;

    if (index) {
      this.setState(clearNotificationAtIndex(notifications, index));
    } else {
      this.setState(clearExpiredTransientNotifications(notifications));
    }
  };

  render() {
    const { user, notifications } = this.state;
    const { path } = this.props.match;

    return (
      <ErrorBoundary
        errorClasses={errorMessageClass}
        message={genericErrorMessage}
      >
        <Navigation
          user={user}
          setUser={(user) => this.setState({ user })}
          notify={this.notify}
        />
        <NotificationList
          notifications={notifications}
          clearNotification={this.clearNotification}
        />
        <Routes>
          <Route
            exact
            path={`${path}/`}
            render={(props) => (
              <MyPushes
                {...props}
                user={user}
                notify={this.notify}
                clearNotification={this.clearNotification}
              />
            )}
          />
          <Route
            path={`${path}/push`}
            render={(props) =>
              hasProps(props.location.search) ? (
                <Health
                  {...props}
                  notify={this.notify}
                  clearNotification={this.clearNotification}
                />
              ) : (
                (<NotFound />)()
              )
            }
          />
          <Route
            path={`${path}/usage`}
            render={(props) => <Usage {...props} />}
          />
        </Routes>
      </ErrorBoundary>
    );
  }
}

export default hot(App);
