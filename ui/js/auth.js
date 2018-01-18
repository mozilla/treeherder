'use strict';

const authApp = angular.module('auth', ['LocalStorageModule', 'auth0.auth0', 'react']);

authApp.config(['angularAuth0Provider', 'localStorageServiceProvider', '$locationProvider',
    function (angularAuth0Provider, localStorageServiceProvider, $locationProvider) {
        localStorageServiceProvider.setPrefix("treeherder");
        $locationProvider.hashPrefix('');

        angularAuth0Provider.init({
            clientID: 'q8fZZFfGEmSB2c5uSI8hOkKdDGXnlo5z',
            domain: 'auth.mozilla.auth0.com',
            responseType: 'id_token token',
            audience: 'login.taskcluster.net',
            redirectUri: 'http://localhost:8000/login.html',
            scope: 'full-user-credentials openid profile'
        });
}]);

module.exports = authApp;
