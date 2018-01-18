'use strict';

import { OIDCCredentialAgent, fromNow } from 'taskcluster-client-web';

    authApp.service('thAuth', ['$window', 'angularAuth0', 'localStorageService', '$location', '$http', '$timeout',
    function ($window, angularAuth0, localStorageService, $location, $http, $timeout) {
    let renewalTimer = null;

    const _clearRenewalTimer = () => {
        if (renewalTimer) {
            $timeout.cancel(renewalTimer);
            renewalTimer = null;
        }
    };

    // Renews the accessToken
    const _renew = async () => {
        try {
            if (!localStorageService.get('userSession')) {
              return;
            }

            const authResult = await _renewAuth();

            if (authResult) {
              await saveCredentialsFromAuthResult(authResult);

              return resetRenewalTimer();
            }
        } catch (renewError) {
            throw new Error(renewError);
        }
    };

    function _userSessionFromAuthResult(authResult) {
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
    }

    function resetRenewalTimer() {
        const userSession = localStorageService.get('userSession');

        _clearRenewalTimer();

        if (userSession) {
            let timeout = Math.max(0, new Date(userSession.renewAfter) - Date.now());

            // apply up to a few minutes to it randomly. This avoids
            // multiple tabs all trying to renew at the same time.
            if (timeout > 0) {
                timeout += Math.random() * 5 * 1000 * 60;
            }

            // create renewal timer
            _clearRenewalTimer();
            renewalTimer = $timeout(_renew, timeout);
        }
    }

    // Wrapper around angularAuth0.parseHash
    function parseHash(qs) {
        return new Promise((resolve, reject) => {
            angularAuth0.parseHash(qs, (error, authResult) => {
                if (error) {
                    return reject(error);
                }

                return resolve(authResult);
            });
        });
    }

    // Wrapper around angularAuth0.renewAuth
    function _renewAuth() {
        return new Promise((resolve, reject) => {
            angularAuth0.renewAuth({}, (error, authResult) => {
                if (error) {
                    return reject(error);
                }

                return resolve(authResult);
            });
        });
    }

    function login() {
        $window.open('/login.html', '_blank');
    }

    async function saveCredentialsFromAuthResult(authResult) {
        const userSession = _userSessionFromAuthResult(authResult);
        const credentialAgent = new OIDCCredentialAgent({
            accessToken: userSession.accessToken,
            oidcProvider: 'mozilla-auth0'
        });
        const loginUrl = `${$location.protocol()}://${$location.host()}:${$location.port()}/api/auth/login/`;

        const taskclusterCredentials = await credentialAgent.getCredentials();
        const userResponse = await $http.get(loginUrl, {
            headers: {
                authorization: `Bearer ${userSession.accessToken}`,
                clientId: taskclusterCredentials.clientId,
                expiresAt: userSession.expiresAt
            }
        });
        const user = userResponse.data;

        localStorageService.set('taskcluster.credentials', taskclusterCredentials);
        localStorageService.set('userSession', userSession);
        localStorageService.set('user', user);
    }

    return {
        resetRenewalTimer,
        parseHash,
        saveCredentialsFromAuthResult,
        login
    };
}]);
