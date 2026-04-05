/**
 * Unit tests for the auth helper module.
 *
 * This test suite covers:
 * - userSessionFromAuthResult: Transforms auth result to user session object
 * - loggedOutUser: Default user object for logged out state
 * - renew: Gets fresh tokens via Auth0 SPA SDK (refresh tokens)
 * - handleCallback: Handles Auth0 redirect callback
 *
 * Note: The Auth0 SPA SDK client methods (getTokenSilently, getIdTokenClaims,
 * handleRedirectCallback) are mocked to avoid testing third-party library behavior.
 */

// Mock @auth0/auth0-spa-js before importing auth module.
// The mock methods are accessed via the shared mock instance after import.
jest.mock('@auth0/auth0-spa-js', () => {
  const methods = {
    getTokenSilently: jest.fn(),
    getIdTokenClaims: jest.fn(),
    handleRedirectCallback: jest.fn(),
    loginWithRedirect: jest.fn(),
  };
  return {
    Auth0Client: jest.fn(() => methods),
    __mockMethods: methods,
  };
});

// Mock taskcluster-client-web's fromNow function
jest.mock('taskcluster-client-web', () => ({
  fromNow: jest.fn(() => new Date('2024-01-15T12:45:00Z')),
}));

import {
  userSessionFromAuthResult,
  loggedOutUser,
  renew,
  handleCallback,
} from '../../../ui/helpers/auth';

// eslint-disable-next-line import/no-extraneous-dependencies
const { __mockMethods: mockAuth0Methods } = require('@auth0/auth0-spa-js');

describe('userSessionFromAuthResult', () => {
  const mockAuthResult = {
    idToken: 'mock-id-token',
    accessToken: 'mock-access-token',
    idTokenPayload: {
      nickname: 'John Doe',
      picture: 'https://gravatar.com/avatar/123',
      sub: 'ad|Mozilla-LDAP|jdoe',
    },
    url: 'https://example.com/callback',
    expiresIn: 86400, // 24 hours in seconds
  };

  beforeEach(() => {
    // Mock Date.now to return a consistent timestamp
    jest.spyOn(Date, 'now').mockReturnValue(1705321845000); // 2024-01-15 12:30:45 UTC
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('extracts idToken from authResult', () => {
    const session = userSessionFromAuthResult(mockAuthResult);

    expect(session.idToken).toBe('mock-id-token');
  });

  it('extracts accessToken from authResult', () => {
    const session = userSessionFromAuthResult(mockAuthResult);

    expect(session.accessToken).toBe('mock-access-token');
  });

  it('extracts fullName from idTokenPayload.nickname', () => {
    const session = userSessionFromAuthResult(mockAuthResult);

    expect(session.fullName).toBe('John Doe');
  });

  it('extracts picture from idTokenPayload.picture', () => {
    const session = userSessionFromAuthResult(mockAuthResult);

    expect(session.picture).toBe('https://gravatar.com/avatar/123');
  });

  it('extracts oidcSubject from idTokenPayload.sub', () => {
    const session = userSessionFromAuthResult(mockAuthResult);

    expect(session.oidcSubject).toBe('ad|Mozilla-LDAP|jdoe');
  });

  it('extracts url from authResult', () => {
    const session = userSessionFromAuthResult(mockAuthResult);

    expect(session.url).toBe('https://example.com/callback');
  });

  it('calculates accessTokenExpiresAt correctly', () => {
    const session = userSessionFromAuthResult(mockAuthResult);

    // Date.now() / 1000 = 1705321845000 / 1000 = 1705321845
    // accessTokenExpiresAt = expiresIn + floor(Date.now() / 1000)
    // = 86400 + 1705321845 = 1705408245
    expect(session.accessTokenExpiresAt).toBe(1705408245);
  });

  it('sets renewAfter from taskcluster fromNow function', () => {
    const session = userSessionFromAuthResult(mockAuthResult);

    // fromNow is mocked to return a specific date
    expect(session.renewAfter).toEqual(new Date('2024-01-15T12:45:00Z'));
  });

  it('returns an object with all required session properties', () => {
    const session = userSessionFromAuthResult(mockAuthResult);

    expect(session).toHaveProperty('idToken');
    expect(session).toHaveProperty('accessToken');
    expect(session).toHaveProperty('fullName');
    expect(session).toHaveProperty('picture');
    expect(session).toHaveProperty('oidcSubject');
    expect(session).toHaveProperty('url');
    expect(session).toHaveProperty('accessTokenExpiresAt');
    expect(session).toHaveProperty('renewAfter');
  });

  it('handles authResult without url property', () => {
    const authResultWithoutUrl = { ...mockAuthResult };
    delete authResultWithoutUrl.url;

    const session = userSessionFromAuthResult(authResultWithoutUrl);

    expect(session.url).toBeUndefined();
  });
});

describe('loggedOutUser', () => {
  it('has isStaff set to false', () => {
    expect(loggedOutUser.isStaff).toBe(false);
  });

  it('has empty username', () => {
    expect(loggedOutUser.username).toBe('');
  });

  it('has empty email', () => {
    expect(loggedOutUser.email).toBe('');
  });

  it('has isLoggedIn set to false', () => {
    expect(loggedOutUser.isLoggedIn).toBe(false);
  });

  it('contains all required properties for logged out state', () => {
    expect(loggedOutUser).toEqual({
      isStaff: false,
      username: '',
      email: '',
      isLoggedIn: false,
    });
  });
});

describe('renew', () => {
  beforeEach(() => {
    mockAuth0Methods.getTokenSilently.mockReset();
    mockAuth0Methods.getIdTokenClaims.mockReset();
  });

  it('calls getTokenSilently with detailedResponse and returns normalized auth result', async () => {
    mockAuth0Methods.getTokenSilently.mockResolvedValue({
      access_token: 'new-access-token',
      id_token: 'new-id-token',
      expires_in: 86400,
    });
    mockAuth0Methods.getIdTokenClaims.mockResolvedValue({
      nickname: 'Jane Doe',
      picture: 'https://gravatar.com/avatar/456',
      sub: 'ad|Mozilla-LDAP|jdoe',
    });

    const result = await renew();

    expect(mockAuth0Methods.getTokenSilently).toHaveBeenCalledWith({
      detailedResponse: true,
    });
    expect(mockAuth0Methods.getIdTokenClaims).toHaveBeenCalled();
    expect(result).toEqual({
      accessToken: 'new-access-token',
      idToken: 'new-id-token',
      expiresIn: 86400,
      idTokenPayload: {
        nickname: 'Jane Doe',
        picture: 'https://gravatar.com/avatar/456',
        sub: 'ad|Mozilla-LDAP|jdoe',
      },
    });
  });

  it('propagates errors from getTokenSilently', async () => {
    mockAuth0Methods.getTokenSilently.mockRejectedValue(
      new Error('Token refresh failed'),
    );

    await expect(renew()).rejects.toThrow('Token refresh failed');
  });
});

describe('handleCallback', () => {
  beforeEach(() => {
    mockAuth0Methods.handleRedirectCallback.mockReset();
    mockAuth0Methods.getTokenSilently.mockReset();
    mockAuth0Methods.getIdTokenClaims.mockReset();
  });

  it('calls handleRedirectCallback and returns normalized auth result', async () => {
    mockAuth0Methods.handleRedirectCallback.mockResolvedValue({ appState: null });
    mockAuth0Methods.getTokenSilently.mockResolvedValue({
      access_token: 'cb-access-token',
      id_token: 'cb-id-token',
      expires_in: 86400,
    });
    mockAuth0Methods.getIdTokenClaims.mockResolvedValue({
      nickname: 'Callback User',
      picture: 'https://gravatar.com/avatar/789',
      sub: 'ad|Mozilla-LDAP|cbuser',
    });

    const result = await handleCallback();

    expect(mockAuth0Methods.handleRedirectCallback).toHaveBeenCalled();
    expect(result).toEqual({
      accessToken: 'cb-access-token',
      idToken: 'cb-id-token',
      expiresIn: 86400,
      idTokenPayload: {
        nickname: 'Callback User',
        picture: 'https://gravatar.com/avatar/789',
        sub: 'ad|Mozilla-LDAP|cbuser',
      },
    });
  });

  it('propagates errors from handleRedirectCallback', async () => {
    mockAuth0Methods.handleRedirectCallback.mockRejectedValue(
      new Error('Invalid state'),
    );

    await expect(handleCallback()).rejects.toThrow('Invalid state');
  });
});
