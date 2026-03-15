import {
  userSessionFromAuthResult,
  renew,
  loggedOutUser,
  cleanupAuth0Cookies,
} from '../../helpers/auth';
import { getApiUrl } from '../../helpers/url';
import UserModel from '../../models/user';

export default class AuthService {
  constructor(setUser) {
    this.renewalTimer = null;
    this.setUser = setUser;
  }

  async _fetchUser(userSession) {
    const loginUrl = getApiUrl('/auth/login/');

    const userResponse = await fetch(loginUrl, {
      headers: {
        Authorization: `Bearer ${userSession.accessToken}`,
        'Access-Token-Expires-At': userSession.accessTokenExpiresAt,
        'Id-Token': userSession.idToken,
      },
      method: 'GET',
      credentials: 'same-origin',
    });

    const user = await userResponse.json();

    if (!userResponse.ok) {
      throw new Error(user.detail || userResponse.statusText);
    }

    return new UserModel(user);
  }

  _clearRenewalTimer() {
    if (this.renewalTimer) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = null;
    }
  }

  async _renewAuth() {
    const LOCK_KEY = 'renewalLock';
    const LOCK_TTL_MS = 30000;

    try {
      const sessionStr = localStorage.getItem('userSession');
      if (!sessionStr) {
        return;
      }

      // Freshness check: if another tab already renewed, skip
      const session = JSON.parse(sessionStr);
      if (session.renewAfter && new Date(session.renewAfter) > new Date()) {
        this.resetRenewalTimer();
        return;
      }

      // Lock check: if another tab claimed the lock recently, skip
      const existingLock = localStorage.getItem(LOCK_KEY);
      if (existingLock) {
        const lockTime = parseInt(existingLock, 10);
        if (Date.now() - lockTime < LOCK_TTL_MS) {
          this.resetRenewalTimer();
          return;
        }
      }

      // Claim the lock and verify we won
      const myLockTime = Date.now().toString();
      localStorage.setItem(LOCK_KEY, myLockTime);
      if (localStorage.getItem(LOCK_KEY) !== myLockTime) {
        this.resetRenewalTimer();
        return;
      }

      // Remove stale auth0 state cookies from previous failed renewals
      // before starting a new one (Bug 1749962)
      cleanupAuth0Cookies();

      const authResult = await renew();

      localStorage.removeItem(LOCK_KEY);

      if (authResult) {
        await this.saveCredentialsFromAuthResult(authResult);

        return this.resetRenewalTimer();
      }
    } catch (err) {
      localStorage.removeItem(LOCK_KEY);

      // instance where a new scope was added and is now required in order to be logged in
      if (err.error === 'consent_required') {
        this.logout();
      }

      // if the renewal fails, only log out the user if the access token has expired
      const userSession = JSON.parse(localStorage.getItem('userSession'));
      if (new Date(userSession.accessTokenExpiresAt * 1000) < new Date()) {
        this.logout();
      }

      /* eslint-disable no-console */
      console.error('Could not renew login:', err);
    }
  }

  resetRenewalTimer() {
    const userSession = JSON.parse(localStorage.getItem('userSession'));

    // if a user has multiple treeherder tabs open and logs out from one of them,
    // we make sure to clear each tab's timer without renewing
    this._clearRenewalTimer();

    if (userSession) {
      let timeout = Math.max(0, new Date(userSession.renewAfter) - Date.now());

      // apply jitter to stagger tabs. After laptop wake (timeout === 0)
      // use a small 0-5s jitter; otherwise use up to 5 minutes.
      if (timeout === 0) {
        timeout = Math.random() * 5 * 1000;
      } else {
        timeout += Math.random() * 5 * 1000 * 60;
      }

      // create renewal timer
      this._clearRenewalTimer();
      this.renewalTimer = setTimeout(() => this._renewAuth(), timeout);
    }
  }

  logout() {
    localStorage.removeItem('userSession');
    localStorage.removeItem('renewalLock');
    cleanupAuth0Cookies();
    localStorage.setItem('user', JSON.stringify(loggedOutUser));

    if (this.setUser) this.setUser(loggedOutUser);
  }

  async saveCredentialsFromAuthResult(authResult) {
    const userSession = userSessionFromAuthResult(authResult);
    const user = await this._fetchUser(userSession);

    localStorage.setItem('userSession', JSON.stringify(userSession));
    localStorage.setItem('user', JSON.stringify(user));
  }
}
