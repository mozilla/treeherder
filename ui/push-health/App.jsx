import { useState, useCallback } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';

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

const hasProps = (search) => {
  const params = new URLSearchParams(search);
  return params.get('repo') && params.get('revision');
};

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState({ isLoggedIn: false });
  const [notifications, setNotifications] = useState([]);

  const notify = useCallback((message, severity, options = {}) => {
    const notification = {
      ...options,
      message,
      severity: severity || 'darker-info',
      created: Date.now(),
    };
    setNotifications((prev) => [notification, ...prev]);
  }, []);

  const clearNotification = useCallback((index = null) => {
    if (index !== null) {
      setNotifications(
        (prev) => clearNotificationAtIndex(prev, index).notifications,
      );
    } else {
      setNotifications(
        (prev) => clearExpiredTransientNotifications(prev).notifications,
      );
    }
  }, []);

  return (
    <ErrorBoundary
      errorClasses={errorMessageClass}
      message={genericErrorMessage}
    >
      <Navigation user={user} setUser={setUser} notify={notify} />
      <NotificationList
        notifications={notifications}
        clearNotification={clearNotification}
      />
      <Routes>
        <Route
          path="/"
          element={
            <MyPushes
              user={user}
              notify={notify}
              clearNotification={clearNotification}
              location={location}
              navigate={navigate}
            />
          }
        />
        <Route
          path="push"
          element={
            hasProps(location.search) ? (
              <Health
                notify={notify}
                clearNotification={clearNotification}
                location={location}
              />
            ) : (
              <NotFound />
            )
          }
        />
        <Route path="usage" element={<Usage />} />
      </Routes>
    </ErrorBoundary>
  );
};

export default App;
