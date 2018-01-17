'use strict';

authApp.component("loginCallback", {
    template: `
        <div ng-if="!loginError">
            <span>Logging in... <span class="fa fa-spinner fa-spin"></span></span>
        </div>
        <div ng-if="loginError">
            <span>Error logging in: {{loginError}}</span>
        </div>
    `,
    controller: ['$location', 'localStorageService', '$scope', '$window', 'angularAuth0', '$http', '$timeout', 'thAuth',
        async ($location, localStorageService, $scope, $window, angularAuth0, $http, $timeout, thAuth) => {
            // splitting by '#/' because the backend doesn't strip trailing slashes from calculated URLs
            const qs = $location.absUrl().split('#/')[1];
            const searchParams = new URLSearchParams(qs);
            const accessToken = searchParams.get('access_token');
            const renderError = err => $timeout(() => ($scope.loginError = err), 0);
            let authResult;

            // make the user login if there is no access token
            if (!accessToken) {
                return angularAuth0.authorize();
            }

            // for silent renewal, auth0-js opens this page in an iframe, and expects
            // a postMessage back, and that's it.
            if ($window !== $window.top) {
                $window.parent.postMessage(window.location.hash, window.origin);

                return;
            }

            try {
                authResult = await thAuth.parseHash(qs);
            } catch (loginError) {
                return renderError(loginError.errorDescription || loginError.error);
            }

            if (authResult.accessToken) {
                try {
                    await thAuth.saveCredentialsFromAuthResult(authResult);

                    if ($window.opener) {
                        $window.close();
                    }
                } catch (err) {
                    return renderError(err.data ? err.data.detail : err.message);
                }
            }
        }]
});
