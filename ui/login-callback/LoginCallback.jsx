import React from 'react';
import Icon from 'react-fontawesome';
import { hot } from 'react-hot-loader';

import AuthService from '../shared/auth/AuthService';
import { webAuth, parseHash } from '../helpers/auth';

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

        if (window.opener) {
          window.close();
        } else {
          // handle case where the user navigates directly to the login route
          window.location.href = window.origin;
        }
      }
    } catch (err) {
      this.setError(err);
    }
  }

  setError(err) {
    this.setState({ loginError: err.message ? err.message : err.errorDescription });
  }

  render() {
    if (this.state.loginError) {
      return <p>{this.state.loginError}</p>;
    }

    if (window.location.hash) {
      return (
        <div>
          <span>Logging in..&nbsp;</span>
          <Icon name="spinner" spin />
        </div>
      );
    }

    return (
      <div>
        <span>Redirecting..&nbsp;</span>
        <Icon name="spinner" spin />
      </div>
    );
  }
}

export default hot(module)(LoginCallback);
