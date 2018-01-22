'use strict';

import React from 'react';
import 'font-awesome/css/font-awesome.css';
import AuthService from './AuthService';
import { webAuth, parseHash } from './auth0';

export default class LoginCallback extends React.PureComponent {
    constructor(props) {
        super(props);

        this.state = {
            loginError: null
        };

        this.authService = new AuthService();
    }

    async componentDidMount() {
        let authResult;

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
            authResult = await parseHash(window.location.hash);

            if (authResult.accessToken) {
                try {
                    await this.authService.saveCredentialsFromAuthResult(authResult);

                    if (window.opener) {
                        window.close();
                    }
                } catch (err) {
                    return this.setState({ loginError: err.detail ? err.detail : err.message });
                }
            }
        } catch (loginError) {
            return this.setState({ loginError: loginError.errorDescription || loginError.error });
        }
    }

    render() {
        if (this.state.loginError) {
            return <p>{this.state.loginError}</p>;
        }

        if (window.location.hash) {
            return <p>Logging in..</p>;
        }

        return <p>Redirecting..</p>;
    }
}
