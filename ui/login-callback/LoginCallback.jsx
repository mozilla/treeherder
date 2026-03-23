import React from 'react';

import dayjs from '../helpers/dayjs';
import AuthService from '../shared/auth/AuthService';
import { auth0Client, handleCallback } from '../helpers/auth';
import CallbackMessage from '../shared/CallbackMessage';
import taskcluster from '../helpers/taskcluster';
import {
  prodFirefoxRootUrl,
  checkRootUrl,
} from '../taskcluster-auth-callback/constants';

class LoginCallback extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      loginError: null,
    };

    this.authService = new AuthService();
  }

  async componentDidMount() {
    const params = new URLSearchParams(window.location.search);

    // If no authorization code in query params, redirect to Auth0 login.
    // Auth0 SPA SDK uses Authorization Code + PKCE flow, so the code
    // comes back as a query parameter (not a hash fragment).
    if (!params.has('code')) {
      return auth0Client.loginWithRedirect();
    }

    try {
      const authResult = await handleCallback();

      if (authResult.accessToken) {
        await this.authService.saveCredentialsFromAuthResult(authResult);
        this.checkTaskclusterCredentials();
      }
    } catch (err) {
      this.setError(err);
    }
  }

  setError(err) {
    this.setState({
      loginError: err.message ? err.message : err.errorDescription,
    });
  }

  checkTaskclusterCredentials = () => {
    const userCredentials = JSON.parse(localStorage.getItem('userCredentials'));
    const defaultRootUrl = checkRootUrl(prodFirefoxRootUrl);

    if (
      !userCredentials ||
      !userCredentials[defaultRootUrl] ||
      !dayjs(userCredentials[defaultRootUrl].expires).isAfter(dayjs())
    ) {
      // Navigate this popup window to TC auth. The entire auth flow stays
      // contained in this popup window.
      taskcluster.getAuthCode(true);
    } else {
      // The original Treeherder tab detects login via storage events.
      window.close();
      // Fallback if window.close() doesn't work (e.g. user navigated directly)
      setTimeout(() => {
        window.location.href = window.origin;
      }, 500);
    }
  };

  render() {
    const { loginError } = this.state;
    const hasCode = new URLSearchParams(window.location.search).has('code');
    return (
      <CallbackMessage
        errorMessage={loginError}
        text={hasCode ? 'Logging in...' : 'Redirecting...'}
      />
    );
  }
}

export default LoginCallback;
