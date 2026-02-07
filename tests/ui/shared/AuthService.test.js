/**
 * Unit tests for AuthService class.
 *
 * This test suite covers:
 * - _fetchUser: Fetching and validating user data from the API
 * - Error handling for failed authentication responses
 * - Proper async/await behavior (no async-promise-executor anti-pattern)
 */
import AuthService from '../../../ui/shared/auth/AuthService';
import UserModel from '../../../ui/models/user';

// Mock dependencies
jest.mock('../../../ui/helpers/url', () => ({
  getApiUrl: jest.fn((path) => `https://api.test.com${path}`),
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
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
});
