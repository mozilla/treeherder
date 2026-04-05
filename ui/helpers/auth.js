import { Auth0Client } from '@auth0/auth0-spa-js';
import { fromNow } from 'taskcluster-client-web';

import { loginCallbackUrl } from './url';

export const auth0Client = new Auth0Client({
  clientId: 'q8fZZFfGEmSB2c5uSI8hOkKdDGXnlo5z',
  domain: 'auth.mozilla.auth0.com',
  authorizationParams: {
    redirect_uri: `${window.location.protocol}//${window.location.host}${loginCallbackUrl}`,
    scope: 'openid profile email',
  },
  useRefreshTokens: true,
  cacheLocation: 'localstorage',
});

// per https://wiki.mozilla.org/Security/Guidelines/OpenID_connect#Session_handling
export const RENEW_INTERVAL = '15 minutes';

// Normalize the auth0-spa-js token response into the same shape that
// userSessionFromAuthResult expects (matching the old auth0-js authResult).
const buildAuthResult = async () => {
  const tokenResult = await auth0Client.getTokenSilently({
    detailedResponse: true,
  });
  const claims = await auth0Client.getIdTokenClaims();

  return {
    accessToken: tokenResult.access_token,
    idToken: tokenResult.id_token,
    expiresIn: tokenResult.expires_in,
    idTokenPayload: claims,
  };
};

export const userSessionFromAuthResult = (authResult) => {
  const renewInterval = RENEW_INTERVAL;
  const userSession = {
    idToken: authResult.idToken,
    accessToken: authResult.accessToken,
    fullName: authResult.idTokenPayload.nickname,
    picture: authResult.idTokenPayload.picture,
    oidcSubject: authResult.idTokenPayload.sub,
    url: authResult.url,
    // `accessTokenExpiresAt` is the unix timestamp (in seconds) at which the access token expires.
    // It is used by the Django backend along with idToken's `exp` to determine session expiry.
    accessTokenExpiresAt: authResult.expiresIn + Math.floor(Date.now() / 1000),
    // per https://wiki.mozilla.org/Security/Guidelines/OpenID_connect#Session_handling
    renewAfter: fromNow(renewInterval),
  };

  console.debug(
    `[Auth] Session created: renewAfter=${renewInterval}, accessTokenExpiresIn=${authResult.expiresIn}s, renewAt=${userSession.renewAfter}`,
  );

  return userSession;
};

// Use refresh tokens to silently get new tokens (no iframe, no 3rd-party cookies).
export const renew = async () => {
  return buildAuthResult();
};

// Handle the redirect callback after Auth0 login (Authorization Code + PKCE).
export const handleCallback = async () => {
  await auth0Client.handleRedirectCallback();
  return buildAuthResult();
};

export const loggedOutUser = {
  isStaff: false,
  username: '',
  email: '',
  isLoggedIn: false,
};
