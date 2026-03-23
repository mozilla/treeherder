// Global mock for @auth0/auth0-spa-js to avoid TextEncoder/dpop issues in jsdom.
// Test files that need specific Auth0 behavior should use jest.mock() to override.
const mockClient = {
  getTokenSilently: jest.fn(),
  getIdTokenClaims: jest.fn(),
  handleRedirectCallback: jest.fn(),
  loginWithRedirect: jest.fn(),
  logout: jest.fn(),
};

module.exports = {
  Auth0Client: jest.fn(() => mockClient),
};
