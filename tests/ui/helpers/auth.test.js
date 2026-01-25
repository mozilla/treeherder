/**
 * Unit tests for the auth helper module.
 *
 * This test suite covers:
 * - userSessionFromAuthResult: Transforms auth0 authResult to user session object
 * - loggedOutUser: Default user object for logged out state
 *
 * Note: renew and parseHash are wrappers around auth0's webAuth methods and
 * are not tested here to avoid testing third-party library behavior.
 */

import {
  userSessionFromAuthResult,
  loggedOutUser,
} from '../../../ui/helpers/auth';

// Mock taskcluster-client-web's fromNow function
jest.mock('taskcluster-client-web', () => ({
  fromNow: jest.fn(() => new Date('2024-01-15T12:45:00Z')),
}));

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
