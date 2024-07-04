import {
  userSessionFromAuthResult,
  renew,
  loggedOutUser,
} from '../../helpers/auth';
import { getApiUrl } from '../../helpers/url';
import UserModel from '../../models/user';

export default class AuthService {
  constructor(setUser) {
    this.renewalTimer = null;
    this.setUser = setUser;
  }

  _fetchUser(userSession) {
    const loginUrl = getApiUrl('/auth/login/');

    return new Promise(async (resolve, reject) => {
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
        reject(new Error(user.detail || userResponse.statusText));
      }

      resolve(new UserModel(user));
    });
  }

  _clearRenewalTimer() {
    if (this.renewalTimer) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = null;
    }
  }

  async _renewAuth() {
    try {
      if (!localStorage.getItem('userSession')) {
        return;
      }

      const authResult = await renew();

      if (authResult) {
        await this.saveCredentialsFromAuthResult(authResult);

        return this.resetRenewalTimer();
      }
    } catch (err) {
      // instance where a new scope was added and is now required in order to be logged in
      if (err.error === 'consent_required') {
        this.logout();
      }

      // if the renewal fails, only log out the user if the access token has expired
      const userSession = JSON.parse(localStorage.getItem('userSession'));
      if (new Date(userSession.accessTokenExpiresAt * 1000) < new Date()) {
        this.logout();
      }

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

      // apply up to a few minutes to it randomly. This avoids
      // multiple tabs all trying to renew at the same time.
      if (timeout > 0) {
        timeout += Math.random() * 5 * 1000 * 60;
      }

      // create renewal timer
      this._clearRenewalTimer();
      this.renewalTimer = setTimeout(() => this._renewAuth(), timeout);
    }
  }

  logout() {
    localStorage.removeItem('userSession');
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
