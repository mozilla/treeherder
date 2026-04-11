import { fromNow } from 'taskcluster-client-web';

import {
  userSessionFromAuthResult,
  renew,
  loggedOutUser,
  RENEW_INTERVAL,
} from '../../helpers/auth';
import { getApiUrl } from '../../helpers/url';
import UserModel from '../../models/user';

const authLog = (msg, ...args) => console.debug(`[Auth]`, msg, ...args);
const authWarn = (msg, ...args) => console.warn(`[Auth]`, msg, ...args);
const authError = (msg, ...args) => console.error(`[Auth]`, msg, ...args);

export default class AuthService {
  constructor(setUser) {
    this.renewalTimer = null;
    this.setUser = setUser;
  }

  async _fetchUser(userSession) {
    const loginUrl = getApiUrl('/auth/login/');

    authLog('Fetching user from backend...');
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
      authError(
        'Backend login failed:',
        userResponse.status,
        user.detail || userResponse.statusText,
      );
      throw new Error(user.detail || userResponse.statusText);
    }

    authLog('Backend login succeeded for:', user.email);
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

    authLog('Renewal triggered at', new Date().toISOString());

    try {
      const sessionStr = localStorage.getItem('userSession');
      if (!sessionStr) {
        authWarn('No userSession in localStorage, skipping renewal');
        return;
      }

      // Freshness check: if another tab already renewed, skip
      const session = JSON.parse(sessionStr);
      if (session.renewAfter && new Date(session.renewAfter) > new Date()) {
        authLog(
          'Another tab already renewed. renewAfter=%s (in %ds), rescheduling',
          session.renewAfter,
          Math.round((new Date(session.renewAfter) - Date.now()) / 1000),
        );
        this.resetRenewalTimer();
        return;
      }

      authLog(
        'renewAfter=%s has passed, proceeding with renewal',
        session.renewAfter,
      );

      // Lock check: if another tab claimed the lock recently, skip
      const existingLock = localStorage.getItem(LOCK_KEY);
      if (existingLock) {
        const lockTime = parseInt(existingLock, 10);
        if (Date.now() - lockTime < LOCK_TTL_MS) {
          authLog(
            'Another tab holds the renewal lock (age=%dms), skipping',
            Date.now() - lockTime,
          );
          this.resetRenewalTimer();
          return;
        }
        authLog(
          'Stale lock found (age=%dms), proceeding',
          Date.now() - lockTime,
        );
      }

      // Claim the lock and verify we won
      const myLockTime = Date.now().toString();
      localStorage.setItem(LOCK_KEY, myLockTime);
      if (localStorage.getItem(LOCK_KEY) !== myLockTime) {
        authLog('Lost lock race to another tab, skipping');
        this.resetRenewalTimer();
        return;
      }

      authLog('Calling Auth0 getTokenSilently (refresh token)...');
      const authResult = await renew();

      localStorage.removeItem(LOCK_KEY);

      if (authResult) {
        authLog('Token refresh succeeded, saving new credentials');
        await this.saveCredentialsFromAuthResult(authResult);

        authLog('Renewal complete, resetting timer');
        return this.resetRenewalTimer();
      }

      authWarn('Token refresh returned falsy result, scheduling retry');
      this.resetRenewalTimer();
    } catch (err) {
      localStorage.removeItem(LOCK_KEY);

      authError('Renewal failed:', err.error || err.message, err);

      // instance where a new scope was added and is now required in order to be logged in
      if (err.error === 'consent_required') {
        authWarn('consent_required error, logging out');
        this.logout();
        return;
      }

      // if the renewal fails, only log out the user if the access token has expired
      const userSession = JSON.parse(localStorage.getItem('userSession'));
      if (userSession) {
        const expiresAt = new Date(userSession.accessTokenExpiresAt * 1000);
        const now = new Date();
        authLog(
          'Access token expires at %s (%s from now)',
          expiresAt.toISOString(),
          Math.round((expiresAt - now) / 1000 / 60) + ' min',
        );
        if (expiresAt < now) {
          authWarn('Access token has expired, logging out');
          this.logout();
          return;
        }
      } else {
        authWarn('No userSession found after renewal failure (unexpected)');
      }

      // Advance renewAfter so the retry waits a full interval instead of
      // spinning in a 0-5 s loop (renewAfter is still in the past on failure).
      if (userSession) {
        userSession.renewAfter = fromNow(RENEW_INTERVAL);
        localStorage.setItem('userSession', JSON.stringify(userSession));
        authLog('Advanced renewAfter to %s to avoid tight retry loop', userSession.renewAfter);
      }

      // Schedule a retry even on failure so renewal doesn't die permanently
      authLog('Scheduling renewal retry after failure');
      this.resetRenewalTimer();
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
      authLog(
        'Renewal timer set: %ds from now (renewAfter=%s, interval=%s)',
        Math.round(timeout / 1000),
        userSession.renewAfter,
        RENEW_INTERVAL,
      );
    }
  }

  logout() {
    authLog('Logging out user');
    localStorage.removeItem('userSession');
    localStorage.removeItem('renewalLock');
    // Clear auth0-spa-js SDK token cache from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('@@auth0spajs@@')) {
        localStorage.removeItem(key);
      }
    });
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
