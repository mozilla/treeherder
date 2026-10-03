import { fromNow } from 'taskcluster-client-web';

import {
  userSessionFromAuthResult,
  renew,
  loggedOutUser,
  RENEW_INTERVAL,
  isAuthDebugEnabled,
} from '../../helpers/auth';
import { getApiUrl } from '../../helpers/url';
import UserModel from '../../models/user';

// Verbose breadcrumbs (renewal cycle, lock contention, timer details) are
// hidden by default. Enable with `localStorage.setItem('authDebug', '1')`.
const authLog = (msg, ...args) => {
  if (isAuthDebugEnabled()) console.debug(`[Auth]`, msg, ...args);
};
const authInfo = (msg, ...args) => console.log(`[Auth]`, msg, ...args);
const authWarn = (msg, ...args) => console.warn(`[Auth]`, msg, ...args);
const authError = (msg, ...args) => console.error(`[Auth]`, msg, ...args);

// How often the heartbeat watchdog checks whether a renewal is overdue. A
// single long setTimeout is unreliable across laptop sleep: browsers suspend
// timers and resume them with their remaining delay intact, so a 15-minute
// timer set before a two-hour sleep still waits after wake, long after the
// capped backend session (AUTH_MAX_SESSION_AGE_SECONDS) has lapsed. A short
// interval bounds that gap to HEARTBEAT_CHECK_MS, and the visibility/online
// listeners close it entirely when the user returns to the tab.
const HEARTBEAT_CHECK_MS = 30 * 1000;

export default class AuthService {
  constructor(setUser) {
    this.renewalTimer = null;
    this.heartbeatWatchdog = null;
    // Wall-clock time at which the next renewal should run (renewAfter + jitter).
    this.renewAt = null;
    this.setUser = setUser;

    this._onVisibilityChange = () => {
      if (document.visibilityState === 'visible') this.checkRenewal();
    };
    this._onOnline = () => this.checkRenewal();
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('online', this._onOnline);
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
    if (this.heartbeatWatchdog) {
      clearInterval(this.heartbeatWatchdog);
      this.heartbeatWatchdog = null;
    }
    this.renewAt = null;
  }

  /**
   * Run the renewal if its scheduled time has passed. Called by the one-shot
   * timer, the watchdog interval, and the visibility/online listeners, so a
   * renewal that is overdue after a suspension runs as soon as any of them
   * fires rather than when the original timer finally elapses.
   */
  checkRenewal() {
    if (this.renewAt === null || Date.now() < this.renewAt) return;
    // Clear before renewing so concurrent triggers don't double-renew; the
    // renewal reschedules via resetRenewalTimer when it finishes.
    this.renewAt = null;
    this._renewAuth();
  }

  /**
   * Stop the heartbeat and detach the wake listeners.
   */
  destroy() {
    this._clearRenewalTimer();
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    window.removeEventListener('online', this._onOnline);
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

      // create renewal timer plus the watchdog that catches it being overdue
      this._clearRenewalTimer();
      this.renewAt = Date.now() + timeout;
      this.renewalTimer = setTimeout(() => this.checkRenewal(), timeout);
      this.heartbeatWatchdog = setInterval(
        () => this.checkRenewal(),
        HEARTBEAT_CHECK_MS,
      );
      authLog(
        'Renewal timer set: %ds from now (renewAfter=%s, interval=%s)',
        Math.round(timeout / 1000),
        userSession.renewAfter,
        RENEW_INTERVAL,
      );
    }
  }

  /**
   * Re-establish a lapsed backend session using the Auth0 refresh token.
   *
   * The Django session is capped (AUTH_MAX_SESSION_AGE_SECONDS) so it lapses
   * whenever the renewal heartbeat stops for longer than the cap (laptop
   * asleep, browser closed overnight). The refresh token usually remains
   * valid much longer, so a silent renewal can log the user back in without
   * any interaction. Returns the logged-in user on success, or null if the
   * refresh token can no longer be used (e.g. revoked SSO access), in which
   * case the caller should log the user out.
   */
  async recoverSession() {
    try {
      authLog('Attempting silent session recovery...');
      const authResult = await renew();
      if (!authResult) {
        authWarn('Silent session recovery returned no credentials');
        return null;
      }
      const user = await this.saveCredentialsFromAuthResult(authResult);
      authInfo('Session recovered silently for:', user.email);
      return user;
    } catch (err) {
      authWarn('Silent session recovery failed:', err.error || err.message);
      return null;
    }
  }

  logout() {
    authInfo('Logging out user');
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
    // Storage events only reach other tabs; tell this tab's Login component too
    // (needed when code without access to its state logs out, e.g. the http
    // helpers after a failed in-tab session recovery).
    window.dispatchEvent(new Event('auth:logout'));
  }

  async saveCredentialsFromAuthResult(authResult) {
    const userSession = userSessionFromAuthResult(authResult);
    const user = await this._fetchUser(userSession);

    localStorage.setItem('userSession', JSON.stringify(userSession));
    localStorage.setItem('user', JSON.stringify(user));

    return user;
  }
}
