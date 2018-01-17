'use strict';

import PropTypes from 'prop-types';

class LoginCallback extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
          loginError: null
        };

        this.angularAuth0 = props.$injector.get('angularAuth0');
        this.thAuth = props.$injector.get('thAuth');
    }

    async componentDidMount() {
        let authResult;

        // make the user login if there is no access token
        if (!window.location.hash) {
            return this.angularAuth0.authorize();
        }

        // for silent renewal, auth0-js opens this page in an iframe, and expects
        // a postMessage back, and that's it.
        if (window !== window.top) {
            window.parent.postMessage(window.location.hash, window.origin);

            return;
        }

        try {
            authResult = await this.thAuth.parseHash(window.location.hash);
        } catch (loginError) {
            return this.setState({ loginError: loginError.errorDescription || loginError.error });
        }

        if (authResult.accessToken) {
            try {
                await this.thAuth.saveCredentialsFromAuthResult(authResult);

                if (window.opener) {
                    window.close();
                }
            } catch (err) {
                return this.setState({ loginError: err.data ? err.data.detail : err.message });
            }
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

LoginCallback.propTypes = {
    $injector: PropTypes.object
};

authApp.directive('loginCallback', ['reactDirective', '$injector', (reactDirective, $injector) =>
    reactDirective(LoginCallback, undefined, {}, { $injector })]);
