/**
 * Unit tests for the Login component's page-load session handling.
 *
 * The Django session is capped (AUTH_MAX_SESSION_AGE_SECONDS) so it lapses
 * whenever the renewal heartbeat stops for longer than the cap (laptop
 * asleep, browser closed overnight). The Auth0 refresh token usually remains
 * valid much longer, so on page load the component must attempt a silent
 * session recovery before treating the user as logged out.
 */
import { render, waitFor } from '@testing-library/react';

import Login from '../../../ui/shared/auth/Login';
import UserModel from '../../../ui/models/user';

const mockRecoverSession = jest.fn();
const mockLogout = jest.fn();
const mockResetRenewalTimer = jest.fn();

jest.mock('../../../ui/shared/auth/AuthService', () =>
  jest.fn().mockImplementation(() => ({
    recoverSession: (...args) => mockRecoverSession(...args),
    logout: (...args) => mockLogout(...args),
    resetRenewalTimer: (...args) => mockResetRenewalTimer(...args),
  })),
);

jest.mock('../../../ui/helpers/auth', () => ({
  loggedOutUser: {
    isStaff: false,
    username: '',
    email: '',
    isLoggedIn: false,
  },
}));

jest.mock('../../../ui/models/user');

const storedSession = JSON.stringify({
  accessToken: 'tok',
  idToken: 'id',
  fullName: 'Test User',
  renewAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
});

describe('Login page-load session handling', () => {
  let setUser;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    setUser = jest.fn();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  const renderLogin = () =>
    render(<Login setUser={setUser} user={{ isLoggedIn: false }} />);

  it('sets the user as logged in when the backend session is still valid', async () => {
    localStorage.setItem('userSession', storedSession);
    UserModel.get.mockResolvedValue({ email: 'test@mozilla.com' });

    renderLogin();

    await waitFor(() =>
      expect(setUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@mozilla.com',
          isLoggedIn: true,
        }),
      ),
    );
    expect(mockRecoverSession).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('recovers the session silently when the backend session lapsed but a userSession remains', async () => {
    localStorage.setItem('userSession', storedSession);
    // Backend session lapsed: anonymous response with no email
    UserModel.get.mockResolvedValue({ email: '' });
    mockRecoverSession.mockResolvedValue({
      email: 'test@mozilla.com',
      isStaff: false,
    });

    renderLogin();

    await waitFor(() => expect(mockRecoverSession).toHaveBeenCalled());
    await waitFor(() =>
      expect(setUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@mozilla.com',
          isLoggedIn: true,
        }),
      ),
    );
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('logs out when silent recovery fails', async () => {
    localStorage.setItem('userSession', storedSession);
    UserModel.get.mockResolvedValue({ email: '' });
    mockRecoverSession.mockResolvedValue(null);

    renderLogin();

    await waitFor(() => expect(mockRecoverSession).toHaveBeenCalled());
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(setUser).toHaveBeenCalledWith(
      expect.objectContaining({ isLoggedIn: false }),
    );
  });

  it('logs out without attempting recovery when no userSession exists', async () => {
    UserModel.get.mockResolvedValue({ email: '' });

    renderLogin();

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockRecoverSession).not.toHaveBeenCalled();
  });
});
