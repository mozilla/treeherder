import React from 'react';
import PropTypes from 'prop-types';
import isEqual from 'lodash/isEqual';
import {
  UncontrolledButtonDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Button,
} from 'reactstrap';

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
      <span id="auth-menu">
        {user.isLoggedIn && (
          <UncontrolledButtonDropdown>
            <DropdownToggle
              caret
              id="logoutLabel"
              title={`Logged in as: ${user.email}`}
              className="btn-view-nav"
            >
              <div className="nav-user-icon">
                <span className="fa fa-user pull-left" />
              </div>
              <div className="nav-user-name">
                <span>{user.fullName}</span>
              </div>
            </DropdownToggle>
            <DropdownMenu aria-labelledby="logoutLabel">
              <DropdownItem onClick={this.logout}>
                <span className="dropdown-item">
                  <span className="fa fa-times-circle" /> Logout
                </span>
              </DropdownItem>
            </DropdownMenu>
          </UncontrolledButtonDropdown>
        )}
        {!user.isLoggedIn && (
          <Button
            className="btn btn-view-nav nav-login-btn"
            onClick={this.login}
          >
            <span className="fa fa-user-plus" /> Login / Register
          </Button>
        )}
      </span>
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
