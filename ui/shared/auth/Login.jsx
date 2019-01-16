import React from 'react';
import PropTypes from 'prop-types';
import isEqual from 'lodash/isEqual';
import { faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { loggedOutUser } from '../../helpers/auth';
import taskcluster from '../../helpers/taskcluster';
import { getApiUrl, loginCallbackUrl } from '../../helpers/url';
import UserModel from '../../models/user';
import { withNotifications } from '../context/Notifications';

import AuthService from './AuthService';

/**
 * This component handles logging in to Taskcluster Authentication
 *
 * See: https://docs.taskcluster.net/manual/3rdparty
 */
class Login extends React.Component {
  constructor(props) {
    super(props);

    this.authService = new AuthService();
  }

  componentDidMount() {
    window.addEventListener('storage', this.handleStorageEvent);

    // Ask the back-end if a user is logged in on page load
    UserModel.get().then(async currentUser => {
      if (currentUser.email && localStorage.getItem('userSession')) {
        this.setLoggedIn(currentUser);
      } else {
        this.setLoggedOut();
      }
    });
  }

  componentWillUnmount() {
    window.removeEventListener('storage', this.handleStorageEvent);
  }

  setLoggedIn = newUser => {
    const { setUser } = this.props;
    const userSession = JSON.parse(localStorage.getItem('userSession'));
    newUser.isLoggedIn = true;
    newUser.fullName = userSession.fullName;
    setUser(newUser);

    // start session renewal process
    if (userSession && userSession.renewAfter) {
      this.authService.resetRenewalTimer();
    }
  };

  setLoggedOut = () => {
    const { setUser } = this.props;

    this.authService.logout();
    // logging out will not trigger a storage event since localStorage is being set by the same window
    taskcluster.updateAgent();
    setUser(loggedOutUser);
  };

  handleStorageEvent = e => {
    if (e.key === 'user') {
      const oldUser = JSON.parse(e.oldValue);
      const newUser = JSON.parse(e.newValue);

      if (!!newUser && newUser.email && !isEqual(newUser, oldUser)) {
        // User was saved to local storage. Use it.
        this.setLoggedIn(newUser);
      } else if (newUser && !newUser.email) {
        // Show the user as logged out in all other opened tabs
        this.setLoggedOut();
      }
    } else if (e.key === 'userSession') {
      // used when a different tab updates userSession,
      taskcluster.updateAgent();
    }
  };

  /**
   * Opens a new tab to handle authentication, which will get closed
   * if it's successful.
   */
  login = () => {
    // Intentionally not using `noopener` since `window.opener` used in LoginCallback.
    window.open(loginCallbackUrl, '_blank');
  };

  logout = () => {
    const { notify } = this.props;

    fetch(getApiUrl('/auth/logout/')).then(async resp => {
      if (resp.ok) {
        this.setLoggedOut();
      } else {
        const msg = await resp.text();
        notify(`Logout failed: ${msg}`, 'danger', { sticky: true });
      }
    });
  };

  render() {
    const { user } = this.props;

    return (
      <React.Fragment>
        {user.isLoggedIn && (
          <span className="dropdown">
            <button
              id="logoutLabel"
              type="button"
              title={`Logged in as: ${user.email}`}
              data-toggle="dropdown"
              className="btn btn-view-nav"
            >
              <div className="dropdown-toggle">
                <span className="nav-user-icon mr-1 rounded">
                  <FontAwesomeIcon icon={faUser} size="xs" />
                </span>
                <span>{user.fullName}</span>
              </div>
            </button>
            <ul
              className="dropdown-menu nav-dropdown-menu-right"
              role="menu"
              aria-labelledby="logoutLabel"
            >
              <li>
                <a onClick={this.logout} className="dropdown-item">
                  Logout
                </a>
              </li>
            </ul>
          </span>
        )}
        {!user.isLoggedIn && (
          <span className="btn nav-login-btn" onClick={this.login}>
            {' '}
            Login / Register
          </span>
        )}
      </React.Fragment>
    );
  }
}

Login.propTypes = {
  setUser: PropTypes.func.isRequired,
  user: PropTypes.object,
  notify: PropTypes.func,
};

Login.defaultProps = {
  user: { isLoggedIn: false },
  notify: msg => console.error(msg), // eslint-disable-line no-console
};

export default withNotifications(Login);
