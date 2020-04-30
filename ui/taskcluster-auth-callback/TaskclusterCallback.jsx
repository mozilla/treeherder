import React from 'react';

import { parseQueryParams } from '../helpers/url';
import { getData } from '../helpers/http';
import CallbackMessage from '../shared/CallbackMessage';

import { clientId, redirectURI, errorMessage } from './constants';

export default class TaskclusterCallback extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      errorMessage: '',
    };
  }

  componentDidMount() {
    // We're not using react router's location prop because we can't provide
    // taskcluster with a redirect URI that contains a fragment (hash) per
    // oath2 protocol (which is used by the hash router for parsing query params)
    const { code, state } = parseQueryParams(window.location.search);
    const requestState = localStorage.getItem('requestState');

    if (code && requestState && requestState === state) {
      this.getCredentials(code);
    } else {
      this.setState({
        errorMessage,
      });
    }
  }

  getCredentials = async (code) => {
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
      return;
    }
    localStorage.setItem(
      'userCredentials',
      JSON.stringify({ [rootUrl]: response.data }),
    );
    if (window.opener) {
      window.close();
    } else {
      window.location.href = window.origin;
    }
  };

  fetchToken = async (code, rootUrl) => {
    const options = {
      method: 'POST',
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${redirectURI}&client_id=${clientId}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    };
    return getData(`${rootUrl}/login/oauth/token`, options);
  };

  fetchCredentials = async (token, rootUrl) => {
    const options = {
      mode: 'cors',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
    return getData(`${rootUrl}/login/oauth/credentials`, options);
  };

  render() {
    const { errorMessage } = this.state;
    return (
      <CallbackMessage
        errorMessage={errorMessage}
        text="Getting Taskcluster credentials..."
      />
    );
  }
}
