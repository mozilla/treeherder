/**
 * Unit tests for AuthService class.
 *
 * This test suite covers:
 * - _fetchUser: Fetching and validating user data from the API
 * - Error handling for failed authentication responses
 * - Proper async/await behavior (no async-promise-executor anti-pattern)
 * - Tab renewal deduplication (_renewAuth freshness check and lock)
 * - resetRenewalTimer jitter behavior
 * - logout clearing renewalLock and auth0-spa-js cache
 */
import AuthService from '../../../ui/shared/auth/AuthService';
import UserModel from '../../../ui/models/user';

const mockRenew = jest.fn();
const mockFromNow = jest.fn(
  () => new Date(Date.now() + 15 * 60 * 1000).toISOString(),
);

jest.mock('taskcluster-client-web', () => ({
  fromNow: (...args) => mockFromNow(...args),
}));

// Mock dependencies
jest.mock('../../../ui/helpers/url', () => ({
  getApiUrl: jest.fn((path) => `https://api.test.com${path}`),
}));

jest.mock('../../../ui/helpers/auth', () => ({
  userSessionFromAuthResult: jest.fn(),
  renew: (...args) => mockRenew(...args),
  loggedOutUser: { isLoggedIn: false },
  RENEW_INTERVAL: '15 minutes',
}));

jest.mock('../../../ui/models/user');

describe('AuthService', () => {
  let authService;
  let mockSetUser;
  let originalFetch;

  beforeEach(() => {
    mockSetUser = jest.fn();
    authService = new AuthService(mockSetUser);

    // Mock global fetch
    originalFetch = global.fetch;
    global.fetch = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
    mockRenew.mockReset();
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('initializes with null renewalTimer', () => {
      expect(authService.renewalTimer).toBeNull();
    });

    it('stores the setUser callback', () => {
      expect(authService.setUser).toBe(mockSetUser);
    });
  });

  describe('_fetchUser', () => {
    const mockUserSession = {
      accessToken: 'test-access-token',
      accessTokenExpiresAt: 1234567890,
      idToken: 'test-id-token',
    };

    const mockUserData = {
      email: 'test@mozilla.com',
      username: 'testuser',
      is_staff: false,
    };

    it('successfully fetches and returns a UserModel instance', async () => {
      const mockUserModel = { email: 'test@mozilla.com' };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUserData),
      });

      UserModel.mockImplementation(() => mockUserModel);

      const result = await authService._fetchUser(mockUserSession);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/auth/login/',
        {
          headers: {
            Authorization: 'Bearer test-access-token',
            'Access-Token-Expires-At': 1234567890,
            'Id-Token': 'test-id-token',
          },
          method: 'GET',
          credentials: 'same-origin',
        },
      );

      expect(UserModel).toHaveBeenCalledWith(mockUserData);
      expect(result).toEqual(mockUserModel);
    });

    it('includes correct headers in the fetch request', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUserData),
      });

      UserModel.mockImplementation(() => ({}));

      await authService._fetchUser(mockUserSession);

      const fetchCall = global.fetch.mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers.Authorization).toBe('Bearer test-access-token');
      expect(headers['Access-Token-Expires-At']).toBe(1234567890);
      expect(headers['Id-Token']).toBe('test-id-token');
    });

    it('throws an error when response is not ok with detail message', async () => {
      const errorDetail = 'Invalid authentication credentials';

      global.fetch.mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue({ detail: errorDetail }),
      });

      await expect(authService._fetchUser(mockUserSession)).rejects.toThrow(
        errorDetail,
      );
    });

    it('throws an error with statusText when no detail is provided', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(authService._fetchUser(mockUserSession)).rejects.toThrow(
        'Internal Server Error',
      );
    });

    it('handles fetch network errors', async () => {
      const networkError = new Error('Network request failed');
      global.fetch.mockRejectedValue(networkError);

      await expect(authService._fetchUser(mockUserSession)).rejects.toThrow(
        'Network request failed',
      );
    });

    it('handles JSON parsing errors', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      await expect(authService._fetchUser(mockUserSession)).rejects.toThrow(
        'Invalid JSON',
      );
    });

    it('properly returns Promise that resolves to UserModel on success', async () => {
      const mockUserModel = { email: 'test@mozilla.com', isLoggedIn: true };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUserData),
      });

      UserModel.mockImplementation(() => mockUserModel);

      // Test that it returns a proper Promise
      const promise = authService._fetchUser(mockUserSession);
      expect(promise).toBeInstanceOf(Promise);

      const result = await promise;
      expect(result).toEqual(mockUserModel);
    });

    it('properly throws Error on failure (not wrapped in Promise)', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        statusText: 'Forbidden',
        json: jest.fn().mockResolvedValue({ detail: 'Access denied' }),
      });

      // Test that the error is properly thrown, not returned as a rejected Promise constructor
      let caughtError;
      try {
        await authService._fetchUser(mockUserSession);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError.message).toBe('Access denied');
    });
  });

  describe('_renewAuth tab deduplication', () => {
    const futureDate = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 1000).toISOString();

    const freshSession = JSON.stringify({
      renewAfter: futureDate,
      accessToken: 'tok',
      accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      idToken: 'id',
    });

    const expiredSession = JSON.stringify({
      renewAfter: pastDate,
      accessToken: 'tok',
      accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      idToken: 'id',
    });

    it('skips renewal when renewAfter is in the future', async () => {
      localStorage.setItem('userSession', freshSession);

      await authService._renewAuth();

      expect(mockRenew).not.toHaveBeenCalled();
    });

    it('skips renewal when another tab holds a fresh lock', async () => {
      localStorage.setItem('userSession', expiredSession);
      localStorage.setItem('renewalLock', Date.now().toString());

      await authService._renewAuth();

      expect(mockRenew).not.toHaveBeenCalled();
    });

    it('proceeds when lock is stale (>30s old)', async () => {
      localStorage.setItem('userSession', expiredSession);
      localStorage.setItem(
        'renewalLock',
        (Date.now() - 31000).toString(),
      );
      mockRenew.mockResolvedValue(null);

      await authService._renewAuth();

      expect(mockRenew).toHaveBeenCalled();
    });

    it('clears lock on successful renewal', async () => {
      localStorage.setItem('userSession', expiredSession);
      mockRenew.mockResolvedValue({ accessToken: 'new' });
      authService.saveCredentialsFromAuthResult = jest.fn();
      authService.resetRenewalTimer = jest.fn();

      await authService._renewAuth();

      expect(localStorage.getItem('renewalLock')).toBeNull();
    });

    it('clears lock on renewal failure', async () => {
      localStorage.setItem('userSession', expiredSession);
      mockRenew.mockRejectedValue(new Error('network'));

      // suppress expected console.error
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await authService._renewAuth();

      expect(localStorage.getItem('renewalLock')).toBeNull();
      console.error.mockRestore();
    });

    it('advances renewAfter on failure to prevent tight retry loop', async () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      const session = {
        renewAfter: pastDate,
        accessToken: 'tok',
        accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 3600,
        idToken: 'id',
      };
      localStorage.setItem('userSession', JSON.stringify(session));
      mockRenew.mockRejectedValue(new Error('network'));

      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'debug').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      await authService._renewAuth();

      const updated = JSON.parse(localStorage.getItem('userSession'));
      // renewAfter should now be in the future, not still in the past
      expect(new Date(updated.renewAfter).getTime()).toBeGreaterThan(Date.now());

      console.error.mockRestore();
      console.debug.mockRestore();
      console.warn.mockRestore();
    });

    it('does not call renew when no userSession exists', async () => {
      await authService._renewAuth();

      expect(mockRenew).not.toHaveBeenCalled();
    });
  });

  describe('resetRenewalTimer', () => {
    it('applies small jitter (0-5s) when timeout is 0 or negative', () => {
      const pastDate = new Date(Date.now() - 1000).toISOString();
      localStorage.setItem(
        'userSession',
        JSON.stringify({ renewAfter: pastDate }),
      );

      // Mock Math.random to return a known value
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      authService.resetRenewalTimer();

      // With Math.random() = 0.5, jitter = 0.5 * 5 * 1000 = 2500ms
      expect(authService.renewalTimer).not.toBeNull();
      randomSpy.mockRestore();
    });

    it('applies larger jitter (up to 5min) when timeout is positive', () => {
      const futureDate = new Date(Date.now() + 60000).toISOString();
      localStorage.setItem(
        'userSession',
        JSON.stringify({ renewAfter: futureDate }),
      );

      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      authService.resetRenewalTimer();

      expect(authService.renewalTimer).not.toBeNull();
      randomSpy.mockRestore();
    });

    it('clears timer and does not set a new one when no session', () => {
      authService.renewalTimer = setTimeout(() => {}, 1000);

      authService.resetRenewalTimer();

      expect(authService.renewalTimer).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears renewalLock from localStorage', () => {
      localStorage.setItem('renewalLock', Date.now().toString());

      authService.logout();

      expect(localStorage.getItem('renewalLock')).toBeNull();
    });

    it('clears userSession from localStorage', () => {
      localStorage.setItem('userSession', '{}');

      authService.logout();

      expect(localStorage.getItem('userSession')).toBeNull();
    });

    it('clears auth0-spa-js SDK cache keys from localStorage', () => {
      localStorage.setItem(
        '@@auth0spajs@@::q8fZZFfGEmSB2c5uSI8hOkKdDGXnlo5z::@@user@@',
        '{}',
      );
      localStorage.setItem(
        '@@auth0spajs@@::q8fZZFfGEmSB2c5uSI8hOkKdDGXnlo5z::openid profile email',
        '{}',
      );
      localStorage.setItem('unrelated-key', 'keep-this');

      authService.logout();

      expect(
        localStorage.getItem(
          '@@auth0spajs@@::q8fZZFfGEmSB2c5uSI8hOkKdDGXnlo5z::@@user@@',
        ),
      ).toBeNull();
      expect(
        localStorage.getItem(
          '@@auth0spajs@@::q8fZZFfGEmSB2c5uSI8hOkKdDGXnlo5z::openid profile email',
        ),
      ).toBeNull();
      expect(localStorage.getItem('unrelated-key')).toBe('keep-this');
    });
  });
});
