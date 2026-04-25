import React, { useCallback, useEffect, useRef } from 'react';
import { Button, Dropdown } from 'react-bootstrap';
import isEqual from 'lodash/isEqual';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-solid-svg-icons';

import { loggedOutUser } from '../../helpers/auth';
import { getApiUrl, loginCallbackUrl } from '../../helpers/url';
import UserModel from '../../models/user';

import AuthService from './AuthService';

// This component handles user Authentication with Auth0

const Login = ({ setUser, user = { isLoggedIn: false }, notify }) => {
  const authServiceRef = useRef(null);
  if (!authServiceRef.current) {
    authServiceRef.current = new AuthService(setUser);
  }

  const setLoggedIn = useCallback(
    (newUser) => {
      const userSession = JSON.parse(localStorage.getItem('userSession'));
      setUser({
        ...newUser,
        isLoggedIn: true,
        fullName: userSession.fullName,
      });

      console.log('[Auth] Logged in as:', newUser.email); // eslint-disable-line no-console

      // start session renewal process
      if (userSession?.renewAfter) {
        authServiceRef.current.resetRenewalTimer();
      }
    },
    [setUser],
  );

  const setLoggedOut = useCallback(() => {
    authServiceRef.current.logout();
    setUser(loggedOutUser);
  }, [setUser]);

  const handleStorageEvent = useCallback(
    (e) => {
      if (e.key === 'user') {
        const oldUser = JSON.parse(e.oldValue);
        const newUser = JSON.parse(e.newValue);

        if (!!newUser && newUser.email && !isEqual(newUser, oldUser)) {
          // User was saved to local storage. Use it.
          setLoggedIn(newUser);
        } else if (newUser && !newUser.email) {
          // Show the user as logged out in all other opened tabs
          setLoggedOut();
        }
      } else if (e.key === 'userSession') {
        // Another tab renewed or cleared the session; realign our timer
        authServiceRef.current.resetRenewalTimer();
      }
    },
    [setLoggedIn, setLoggedOut],
  );

  useEffect(() => {
    window.addEventListener('storage', handleStorageEvent);

    // Ask the back-end if a user is logged in on page load
    UserModel.get().then((currentUser) => {
      if (currentUser.email && localStorage.getItem('userSession')) {
        setLoggedIn(currentUser);
      } else {
        setLoggedOut();
      }
    });

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [handleStorageEvent, setLoggedIn, setLoggedOut]);

  /**
   * Opens a popup window to handle authentication. Using a separate window
   * ensures any tabs opened during the Auth0/TC OAuth flow (like TC's
   * dashboard) stay contained in that window instead of the main window.
   * The window closes itself when authentication completes.
   */
  const login = useCallback(() => {
    window.open(loginCallbackUrl, 'auth', 'width=600,height=700,popup');
  }, []);

  const logout = useCallback(() => {
    const notifyFn = notify || ((msg) => console.error(msg)); // eslint-disable-line no-console

    // only clear taskcluster credentials when a user logs out to make it easier
    // to clear an old token and retrieve a new one
    localStorage.removeItem('userCredentials');

    fetch(getApiUrl('/auth/logout/')).then(async (resp) => {
      if (resp.ok) {
        setLoggedOut();
      } else {
        const msg = await resp.text();
        notifyFn(`Logout failed: ${msg}`, 'danger', { sticky: true });
      }
    });
  }, [notify, setLoggedOut]);

  return (
    <React.Fragment>
      {user?.isLoggedIn ? (
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
            <Dropdown.Item tag="a" onClick={logout}>
              Logout
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      ) : (
        <Button onClick={login} className="btn-view-nav nav-menu-btn">
          Login / Register
        </Button>
      )}
    </React.Fragment>
  );
};

export default Login;
