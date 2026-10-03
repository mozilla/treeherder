/**
 * Unit tests for the shared HTTP helpers' in-tab session recovery.
 *
 * The Django session is capped (AUTH_MAX_SESSION_AGE_SECONDS) and can lapse
 * while a tab still believes it is logged in (e.g. the renewal heartbeat was
 * suspended with the laptop). A write then fails with 401/403 even though the
 * Auth0 tokens are still valid. The helpers must silently re-establish the
 * backend session and retry once before surfacing an auth error.
 */
import { create, update, destroy } from '../../../ui/helpers/http';

const mockRecoverSession = jest.fn();
const mockLogout = jest.fn();

jest.mock('../../../ui/shared/auth/AuthService', () =>
  jest.fn().mockImplementation(() => ({
    recoverSession: (...args) => mockRecoverSession(...args),
    logout: (...args) => mockLogout(...args),
  })),
);

const jsonResponse = (status, body) => ({
  ok: status < 400,
  status,
  statusText: status === 403 ? 'Forbidden' : 'OK',
  headers: { get: () => 'application/json' },
  json: jest.fn().mockResolvedValue(body),
});

const authDenied = { detail: 'Authentication credentials were not provided.' };

describe('http helpers: in-tab session recovery', () => {
  let originalFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom fixture for js-cookie
    document.cookie = 'csrftoken=token-before';
    originalFetch = global.fetch;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('recovers the session and retries a write once when a 403 arrives while logged in', async () => {
    localStorage.setItem('userSession', '{"accessToken":"tok"}');
    global.fetch
      .mockResolvedValueOnce(jsonResponse(403, authDenied))
      .mockResolvedValueOnce(jsonResponse(200, { id: 1 }));
    mockRecoverSession.mockResolvedValue({ email: 'test@mozilla.com' });

    const result = await create('/api/project/autoland/note/', { text: 'x' });

    expect(mockRecoverSession).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: { id: 1 }, failureStatus: null });
  });

  it('sends the rotated CSRF token on the retry', async () => {
    localStorage.setItem('userSession', '{"accessToken":"tok"}');
    global.fetch
      .mockResolvedValueOnce(jsonResponse(403, authDenied))
      .mockResolvedValueOnce(jsonResponse(200, {}));
    // Re-establishing the backend session rotates the CSRF cookie.
    mockRecoverSession.mockImplementation(async () => {
      // biome-ignore lint/suspicious/noDocumentCookie: jsdom fixture for js-cookie
      document.cookie = 'csrftoken=token-after';
      return { email: 'test@mozilla.com' };
    });

    await update('/api/performance/alert/1/', { status: 1 });

    const [, firstOptions] = global.fetch.mock.calls[0];
    const [, retryOptions] = global.fetch.mock.calls[1];
    expect(firstOptions.headers.get('X-CSRFToken')).toBe('token-before');
    expect(retryOptions.headers.get('X-CSRFToken')).toBe('token-after');
  });

  it('does not attempt recovery when no userSession exists', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse(403, authDenied));

    const result = await create('/api/project/autoland/note/', {});

    expect(mockRecoverSession).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.failureStatus).toBe(403);
  });

  it('retries only once when the retry is also denied', async () => {
    localStorage.setItem('userSession', '{"accessToken":"tok"}');
    global.fetch
      .mockResolvedValueOnce(jsonResponse(403, authDenied))
      .mockResolvedValueOnce(jsonResponse(403, authDenied));
    mockRecoverSession.mockResolvedValue({ email: 'test@mozilla.com' });

    const result = await destroy('/api/project/autoland/bug-job-map/1/');

    expect(mockRecoverSession).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.failureStatus).toBe(403);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('logs out and returns the auth error when recovery fails', async () => {
    localStorage.setItem('userSession', '{"accessToken":"tok"}');
    global.fetch.mockResolvedValueOnce(jsonResponse(403, authDenied));
    mockRecoverSession.mockResolvedValue(null);

    const result = await create('/api/project/autoland/note/', {});

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.failureStatus).toBe(403);
  });

  it('shares a single recovery across concurrent failed writes', async () => {
    localStorage.setItem('userSession', '{"accessToken":"tok"}');
    // Three writes fail together (e.g. a bulk classification), then all
    // three retries succeed.
    global.fetch
      .mockResolvedValueOnce(jsonResponse(403, authDenied))
      .mockResolvedValueOnce(jsonResponse(403, authDenied))
      .mockResolvedValueOnce(jsonResponse(403, authDenied))
      .mockResolvedValue(jsonResponse(200, {}));
    const pendingRecoveries = [];
    mockRecoverSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          pendingRecoveries.push(resolve);
        }),
    );

    const writes = [1, 2, 3].map((id) =>
      create('/api/project/autoland/note/', { job_id: id }),
    );
    // Let all three first attempts fail and reach the recovery step.
    await new Promise((resolve) => setTimeout(resolve, 0));
    pendingRecoveries.forEach((resolve) =>
      resolve({ email: 'test@mozilla.com' }),
    );
    const results = await Promise.all(writes);

    expect(mockRecoverSession).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(6);
    expect(results.every((r) => r.failureStatus === null)).toBe(true);
  });

  it('does not treat a non-auth failure as a lapsed session', async () => {
    localStorage.setItem('userSession', '{"accessToken":"tok"}');
    global.fetch.mockResolvedValueOnce(
      jsonResponse(400, { text: ['This field is required.'] }),
    );

    const result = await create('/api/project/autoland/note/', {});

    expect(mockRecoverSession).not.toHaveBeenCalled();
    expect(result.failureStatus).toBe(400);
  });
});
