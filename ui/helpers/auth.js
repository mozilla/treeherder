import { fromNow } from 'taskcluster-client-web';
import { WebAuth } from 'auth0-js';

import { loginCallbackUrl } from './url';

export const webAuth = new WebAuth({
  clientID: 'q8fZZFfGEmSB2c5uSI8hOkKdDGXnlo5z',
  domain: 'auth.mozilla.auth0.com',
  responseType: 'id_token token',
  redirectUri: `${window.location.protocol}//${window.location.host}${loginCallbackUrl}`,
  scope: 'openid profile email',
});

export const userSessionFromAuthResult = (authResult) => {
  // Example authResult:
  // {
  //   "accessToken": "<TOKEN>",
  //   "idToken": "<TOKEN>",
  //   "idTokenPayload": {
  //     "https://sso.mozilla.com/claim/groups": [
  //       "all_scm_level_1",
  //       "all_scm_level_2",
  //       "all_scm_level_3"
  //     ],
  //     "given_name": "Firstname",
  //     "family_name": "Surname",
  //     "nickname": "Firstname Surname",
  //     "name": "Firstname Surname",
  //     "picture": "<GRAVATAR_URL>",
  //     "updated_at": "2019-02-13T17:26:19.538Z",
  //     "email": "fsurname@mozilla.com",
  //     "email_verified": true,
  //     "iss": "https://auth.mozilla.auth0.com/",
  //     "sub": "ad|Mozilla-LDAP|fsurname",
  //     "aud": "<HASH>",
  //     "iat": 1550078779,
  //     "exp": 1550683579,
  //     "at_hash": "<HASH>",
  //     "nonce": "<HASH>"
  //   },
  //   "appState": null,
  //   "refreshToken": null,
  //   "state": "<HASH>",
  //   "expiresIn": 86400,
  //   "tokenType": "Bearer",
  //   "scope": "openid profile email"
  // }
  //
  // For more details, see:
  // https://auth0.com/docs/libraries/auth0js/v9#extract-the-authresult-and-get-user-info
  //
  const userSession = {
    idToken: authResult.idToken,
    accessToken: authResult.accessToken,
    fullName: authResult.idTokenPayload.nickname,
    picture: authResult.idTokenPayload.picture,
    oidcSubject: authResult.idTokenPayload.sub,
    url: authResult.url,
    // `accessTokenexpiresAt` is the unix timestamp (in seconds) at which the access token expires.
    // It is used by the Django backend along with idToken's `exp` to determine session expiry.
    accessTokenExpiresAt: authResult.expiresIn + Math.floor(Date.now() / 1000),
    // per https://wiki.mozilla.org/Security/Guidelines/OpenID_connect#Session_handling
    renewAfter: fromNow('15 minutes'),
  };

  return userSession;
};

// Wrapper around webAuth's renewAuth
export const renew = () =>
  new Promise((resolve, reject) => {
    webAuth.renewAuth({}, (error, authResult) => {
      if (error) {
        return reject(error);
      }

      return resolve(authResult);
    });
  });

// Wrapper around webAuth's parseHash
export const parseHash = (options) =>
  new Promise((resolve, reject) => {
    webAuth.parseHash(options, (error, authResult) => {
      if (error) {
        return reject(error);
      }

      return resolve(authResult);
    });
  });

export const loggedOutUser = {
  isStaff: false,
  username: '',
  email: '',
  isLoggedIn: false,
};
