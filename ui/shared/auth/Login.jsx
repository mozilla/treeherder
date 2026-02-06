import React from 'react';
import PropTypes from 'prop-types';
import { Button, Dropdown } from 'react-bootstrap';
import isEqual from 'lodash/isEqual';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-solid-svg-icons';

import { loggedOutUser } from '../../helpers/auth';
import { getApiUrl, loginCallbackUrl } from '../../helpers/url';
import UserModel from '../../models/user';

import AuthService from './AuthService';

// This component handles user Authentication with Auth0

class Login extends React.Component {
  constructor(props) {
    super(props);

    this.authService = new AuthService(this.props.setUser);
  }

  componentDidMount() {
    window.addEventListener('storage', this.handleStorageEvent);

    // Ask the back-end if a user is logged in on page load
    UserModel.get().then(async (currentUser) => {
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

  setLoggedIn = (newUser) => {
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
    setUser(loggedOutUser);
  };

  handleStorageEvent = (e) => {
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
    const { notify = (msg) => console.error(msg) } = this.props; // eslint-disable-line no-console

    // only clear taskcluster credentials when a user logs out to make it easier
    // to clear an old token and retrieve a new one
    localStorage.removeItem('userCredentials');

    fetch(getApiUrl('/auth/logout/')).then(async (resp) => {
      if (resp.ok) {
        this.setLoggedOut();
      } else {
        const msg = await resp.text();
        notify(`Logout failed: ${msg}`, 'danger', { sticky: true });
      }
    });
  };

  render() {
    const { user = { isLoggedIn: false } } = this.props;

    return (
      <React.Fragment>
        {user && user.isLoggedIn ? (
          <Dropdown>
            <Dropdown.Toggle
              variant="transparent"
              className="navbar-link nav-menu-btn"
            >
              <span
                className="bg-info px-1 me-1 rounded text-light"
                aria-label={`Logged in as: ${user.email}`}
              >
                <FontAwesomeIcon icon={faUser} size="xs" />
              </span>
              <span>{user.fullName}</span>
            </Dropdown.Toggle>
            <Dropdown.Menu right>
              <Dropdown.Item tag="a" onClick={this.logout}>
                Logout
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        ) : (
          <Button onClick={this.login} className="btn-view-nav nav-menu-btn">
            Login / Register
          </Button>
        )}
      </React.Fragment>
    );
  }
}

Login.propTypes = {
  setUser: PropTypes.func.isRequired,
  user: PropTypes.shape({
    email: PropTypes.string,
    isLoggedIn: PropTypes.bool,
    fullName: PropTypes.string,
  }),
  notify: PropTypes.func,
};

export default Login;
