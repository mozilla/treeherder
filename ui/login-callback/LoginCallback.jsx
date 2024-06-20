import React from 'react';
import { hot } from 'react-hot-loader/root';
import moment from 'moment';

import AuthService from '../shared/auth/AuthService';
import { webAuth, parseHash } from '../helpers/auth';
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
    // make the user login if there is no access token
    if (!window.location.hash) {
      return webAuth.authorize();
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
