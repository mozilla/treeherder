'use strict';

import { WebAuth } from 'auth0-js';
import { fromNow } from 'taskcluster-client-web';

export const webAuth = new WebAuth({
    clientID: 'q8fZZFfGEmSB2c5uSI8hOkKdDGXnlo5z',
    domain: 'auth.mozilla.auth0.com',
    responseType: 'id_token token',
    audience: 'login.taskcluster.net',
    redirectUri: `${location.protocol}//${location.host}/login.html`,
    scope: 'full-user-credentials openid profile email'
});

export const userSessionFromAuthResult = (authResult) => {
    const expiresAt = JSON.stringify((authResult.expiresIn * 1000) + Date.now());
    const userSession = {
        accessToken: authResult.accessToken,
        fullName: authResult.idTokenPayload.nickname,
        picture: authResult.idTokenPayload.picture,
        oidcSubject: authResult.idTokenPayload.sub,
        // expiresAt is used by the django backend to expire the user session
        expiresAt,
        // per https://wiki.mozilla.org/Security/Guidelines/OpenID_connect#Session_handling
        renewAfter: fromNow('15 minutes')
    };

    return userSession;
};

// Wrapper around webAuth's renewAuth
export const renew = () => (
    new Promise((resolve, reject) => {
        webAuth.renewAuth({}, (error, authResult) => {
            if (error) {
                return reject(error);
            }

            return resolve(authResult);
        });
    })
);

// Wrapper around webAuth's parseHash
export const parseHash = qs => (
    new Promise((resolve, reject) => {
        webAuth.parseHash(qs, (error, authResult) => {
            if (error) {
                return reject(error);
            }

            return resolve(authResult);
        });
    })
);

export const loggedOutUser = { is_staff: false, username: "", email: "", loggedin: false };
