import React from 'react';
import PropTypes from 'prop-types';
import isEqual from 'lodash/isEqual';

import AuthService from '../js/auth/AuthService';
import { loggedOutUser } from '../js/auth/auth-utils';
import thTaskcluster from '../js/services/taskcluster';
import { getApiUrl } from '../helpers/url';
import UserModel from '../models/user';

/**
 * This component handles logging in to Taskcluster Authentication
 *
 * See: https://docs.taskcluster.net/manual/3rdparty
 */
export default class Login extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = props;
    this.thNotify = $injector.get('thNotify');

    this.authService = new AuthService();
  }

  componentDidMount() {
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);

    window.addEventListener('storage', (e) => {
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
        thTaskcluster.updateAgent();
      }
    });

    // Ask the back-end if a user is logged in on page load
    UserModel.get().then(async (currentUser) => {
      if (currentUser.email && localStorage.getItem('userSession')) {
        this.setLoggedIn(currentUser);
      } else {
        this.setLoggedOut();
      }
    });
  }

  setLoggedIn(newUser) {
    const { setUser } = this.props;
    const userSession = JSON.parse(localStorage.getItem('userSession'));
    newUser.isLoggedIn = true;
    newUser.fullName = userSession.fullName;
    setUser(newUser);

    // start session renewal process
    if (userSession && userSession.renewAfter) {
      this.authService.resetRenewalTimer();
    }
  }

  setLoggedOut() {
    const { setUser } = this.props;

    this.authService.logout();
    // logging out will not trigger a storage event since localStorage is being set by the same window
    thTaskcluster.updateAgent();
    setUser(loggedOutUser);
  }

  logout() {
    fetch(getApiUrl('/auth/logout/'))
      .then(async (resp) => {
        if (resp.ok) {
          this.setLoggedOut();
        } else {
          const msg = await resp.json();
          this.thNotify.send(`Logout failed: ${msg}`, 'danger', { sticky: true });
        }
      });
  }

  /**
   * Opens a new tab to handle authentication, which will get closed
   * if it's successful.
   */
  login() {
    // Intentionally not using `noopener` since `window.opener` used in LoginCallback.
    window.open('/login.html', '_blank');
  }

  render() {
    const { user } = this.props;

    return (
      <React.Fragment>
        {user.isLoggedIn && <span className="dropdown">
          <button
            id="logoutLabel"
            title="Logged in as: {{$this.user.email}}"
            data-toggle="dropdown"
            className="btn btn-view-nav"
          >
            <div className="dropdown-toggle">
              <div className="nav-user-icon">
                <span className="fa fa-user pull-left" />
              </div>
              <div className="nav-user-name">
                <span>{user.fullName}</span>
              </div>
            </div>
          </button>
          <ul
            className="dropdown-menu nav-dropdown-menu-right"
            role="menu"
            aria-labelledby="logoutLabel"
          >
            <li><a onClick={this.logout} className="dropdown-item">Logout</a></li>
          </ul>
        </span>}
        {!user.isLoggedIn && <span
          className="btn nav-login-btn"
          onClick={this.login}
        > Login / Register</span>}
      </React.Fragment>
    );
  }
}

Login.propTypes = {
  user: PropTypes.object.isRequired,
  setUser: PropTypes.func.isRequired,
  $injector: PropTypes.object.isRequired,
};
