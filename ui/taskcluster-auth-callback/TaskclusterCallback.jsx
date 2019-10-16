import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Row } from 'reactstrap';

import {
  createQueryParams,
  tcAuthCallbackUrl,
  parseQueryParams,
} from '../helpers/url';
import { getData } from '../helpers/http';
import ErrorMessages from '../shared/ErrorMessages';

const tcClientIdMap = {
  'https://treeherder.mozilla.org': 'production',
  'https://treeherder.allizom.org': 'stage',
  'https://treeherder-prototype.herokuapp.com': 'dev',
  'http://localhost:5000': 'localhost',
};

const clientId = `treeherder-${tcClientIdMap[window.location.origin]}`;
const redirectURI = `${window.location.origin}${tcAuthCallbackUrl}`;
const errorMessage = `There was a problem verifying your Taskcluster credentials. Please try again later.`;

export default class TaskclusterCallback extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      errorMessage: '',
      success: false,
    };
  }

  componentDidMount() {
    // We're not using react router's location prop for simplicity;
    // we can't provide taskcluster with a redirect URI with a hash/fragment
    // per oath2 protocol which would be used by the hash router for parsing query params
    const { code, rootUrl, state } = parseQueryParams(
      window.location.search || window.location.hash,
    );
    const requestState = localStorage.getItem('requestState');

    if (!code && rootUrl) {
      localStorage.setItem('tcRootUrl', rootUrl);
      const nonce = this.generateNonce();
      this.getAuthCode(rootUrl, nonce);
    } else if (code && requestState && requestState === state) {
      this.getCredentials(code);
    } else {
      this.setState({
        errorMessage,
      });
    }
  }

  componentWillUnmount() {
    localStorage.removeItem('userCredentials');
  }

  generateNonce = () => {
    let value = '';
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i <= 20; i++) {
      value += characters.charAt(
        Math.floor(this.secureRandom() * characters.length),
      );
    }

    localStorage.setItem('requestState', value);
    return value;
  };

  // from the MDN crypto.getRandomValues doc
  secureRandom = () =>
    window.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967295;

  getAuthCode = (rootUrl, state) => {
    const params = {
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectURI,
      scope: 'treeherder',
      state,
    };

    window.location.href = `${rootUrl}login/oauth/authorize${createQueryParams(
      params,
    )}`;
  };

  getCredentials = async code => {
    const rootUrl = localStorage.getItem('tcRootUrl');
    if (!rootUrl) {
      this.setState({ errorMessage });
      return;
    }
    let response = await this.fetchToken(code, rootUrl);

    if (response.failureStatus) {
      this.setState({ errorMessage });
      return;
    }
    response = await this.fetchCredentials(response.data.access_token, rootUrl);

    if (response.failureStatus) {
      this.setState({ errorMessage });
    } else {
      localStorage.setItem('userCredentials', { rootUrl: response.data });
      this.setState({ success: true }, () => {
        if (window.opener) {
          window.close();
        } else {
          // handle case where the user navigates directly to the login route
          window.location.href = window.origin;
          console.log(window.location)
        }
      });
    }
  };

  fetchToken = async (code, rootUrl) => {
    const options = {
      method: 'POST',
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${redirectURI}&client_id=${clientId}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    };
    const response = await getData(`${rootUrl}login/oauth/token`, options);
    return response;
  };

  fetchCredentials = async (token, rootUrl) => {
    const options = {
      mode: 'cors',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    const response = await getData(
      `${rootUrl}login/oauth/credentials`,
      options,
    );
    return response;
  };

  render() {
    const { errorMessage, success } = this.state;

    return (
      <div className="pt-5">
        {errorMessage ? (
          <ErrorMessages failureMessage={errorMessage} />
        ) : (
          <Row className="justify-content-center">
            <p className="lead text-center">
              {!success
                ? 'Getting Taskcluster credentials...'
                : 'Successfully retrieved credentials. Redirecting...'}
            </p>
            {/* <div>
              <FontAwesomeIcon icon={faSpinner} spin />
            </div> */}
          </Row>
        )}
      </div>
    );
  }
}
