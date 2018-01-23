'use strict';

import { OIDCCredentialAgent } from 'taskcluster-client-web';
import got from 'got';
import { userSessionFromAuthResult, renew, loggedOutUser } from './auth-utils';

export default class AuthService {
    constructor() {
        this.renewalTimer = null;
    }

    _clearRenewalTimer() {
        if (this.renewalTimer) {
            clearTimeout(this.renewalTimer);
            this.renewalTimer = null;
        }
    }

    async _renewAuth() {
        try {
            if (!localStorage.getItem('treeherder.userSession')) {
                return;
            }

            const authResult = await renew();

            if (authResult) {
                await this.saveCredentialsFromAuthResult(authResult);

                return this.resetRenewalTimer();
            }
        } catch (err) {
            this.logout();
            console.error('Could not renew login:', err);
        }
    }

    resetRenewalTimer() {
        const userSession = JSON.parse(localStorage.getItem('treeherder.userSession'));

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
        localStorage.removeItem('treeherder.taskcluster.credentials');
        localStorage.removeItem('treeherder.userSession');
        localStorage.setItem('treeherder.user', JSON.stringify(loggedOutUser));
    }


    async saveCredentialsFromAuthResult(authResult) {
        const userSession = userSessionFromAuthResult(authResult);
        const credentialAgent = new OIDCCredentialAgent({
            accessToken: userSession.accessToken,
            oidcProvider: 'mozilla-auth0'
        });
        const loginUrl = `${location.protocol}//${location.host}/api/auth/login/`;

        const taskclusterCredentials = await credentialAgent.getCredentials();
        const { body: user } = await got(loginUrl, {
            headers: {
                authorization: `Bearer ${userSession.accessToken}`,
                expiresAt: userSession.expiresAt
            },
            method: 'GET',
            json: true
        });

        localStorage.setItem('treeherder.taskcluster.credentials', JSON.stringify(taskclusterCredentials));
        localStorage.setItem('treeherder.userSession', JSON.stringify(userSession));
        localStorage.setItem('treeherder.user', JSON.stringify(user));
    }
}
