import React from 'react';
import { hot } from 'react-hot-loader/root';
import moment from 'moment';

import AuthService from '../shared/auth/AuthService';
import { parseHash } from '../helpers/auth';
import { loginCallbackUrl } from '../helpers/url';
import CallbackMessage from '../shared/CallbackMessage';
import taskcluster from '../helpers/taskcluster';
import {
  prodFirefoxRootUrl,
  checkRootUrl,
} from '../taskcluster-auth-callback/constants';

class LoginCallback extends React.PureComponent {
  config = {
    clientID: 'q8fZZFfGEmSB2c5uSI8hOkKdDGXnlo5z',
    domain: 'auth.mozilla.auth0.com',
    responseType: 'id_token token',
    redirectUri: `${window.location.protocol}//${window.location.host}${loginCallbackUrl}`,
    scope: 'openid profile email',
  };

  constructor(props) {
    super(props);

    this.state = {
      loginError: null,
    };

    this.authService = new AuthService();
  }

  async componentDidMount() {
    // make the user login if there is no access token
    if (!window.location.hash) {
      return this.initializeAuth0();
    }

    // for silent renewal, auth0-js opens this page in an iframe, and expects
    // a postMessage back, and that's it.
    if (window !== window.top) {
      window.parent.postMessage(window.location.hash, window.origin);
      return;
    }

    try {
      const authResult = await parseHash({ hash: window.location.hash });
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
      !moment(userCredentials[defaultRootUrl].expires).isAfter(moment())
    ) {
      taskcluster.getAuthCode(true);
    } else if (window.opener) {
      window.close();
    } else {
      // handle case where the user navigates directly to the login route
      window.location.href = window.origin;
    }
  };

  initializeAuth0 = async () => {
    const url =
      'https://auth.mozilla.auth0.com/authorize?response_type=code&client_id=q8fZZFfGEmSB2c5uSI8hOkKdDGXnlo5z&redirect_uri=https://treeherder.mozilla.org/login.html&scope=openid%20profile%20email';
    window.location.href = url;
  };

  render() {
    const { loginError } = this.state;
    return (
      <CallbackMessage
        errorMessage={loginError}
        text={window.location.hash ? 'Logging in...' : 'Redirecting...'}
      />
    );
  }
}

export default hot(LoginCallback);
