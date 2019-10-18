import React from 'react';
import { Row } from 'reactstrap';

import { parseQueryParams } from '../helpers/url';
import { getData } from '../helpers/http';
import ErrorMessages from '../shared/ErrorMessages';

import { clientId, redirectURI, errorMessage } from './constants';

export default class TaskclusterCallback extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      errorMessage: '',
    };
  }

  componentDidMount() {
    // We're not using react router's location prop for simplicity;
    // we can't provide taskcluster with a redirect URI with a hash/fragment
    // per oath2 protocol which would be used by the hash router for parsing query params
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
      localStorage.setItem(
        'userCredentials',
        JSON.stringify({ [rootUrl]: response.data }),
      );
      window.close();
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
    const { errorMessage } = this.state;
    return (
      <div className="pt-5">
        {errorMessage ? (
          <ErrorMessages failureMessage={errorMessage} />
        ) : (
          <Row className="justify-content-center">
            <p className="lead text-center">
              Getting Taskcluster credentials...
            </p>
          </Row>
        )}
      </div>
    );
  }
}
