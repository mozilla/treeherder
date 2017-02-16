"use strict";

/**
 * This component handles logging in to Taskcluster Authentication
 *
 * See: https://docs.taskcluster.net/manual/3rdparty
 *
 * This communicates to the rest of Treeherder by calling the onUserChange
 * function on the HTML element, which in turn stores that user in $rootScope.
 */
treeherder.component("login", {
    template: `
        <span class="dropdown"
              ng-if="$ctrl.user.loggedin">
          <button id="logoutLabel" title="Logged in as: {{$ctrl.user.email}}" role="button"
                  data-toggle="dropdown"
                  class="btn btn-view-nav btn-right-navbar">
            <div class="nav-user-icon">
              <span class="fa fa-user pull-left"></span>
            </div>
            <span class="fa fa-angle-down lightgray"></span>
          </button>
          <ul class="dropdown-menu" role="menu" aria-labelledby="logoutLabel">
              <li>
                <a ng-click="$ctrl.logout()">Logout</a>
              </li>
          </ul>
        </span>

        <a class="btn btn-view-nav btn-right-navbar nav-login-btn"
           ng-if="!$ctrl.user.loggedin && $ctrl.userCanLogin && !ctrl.userLoggingIn"
           ng-click="$ctrl.login()">Login/Register</a>
        <span ng-if="$ctrl.userLoggingIn"
              class="midgray"
              title="User is already logging in">Logging In...</span>
        <span ng-if="!$ctrl.userCanLogin"
              class="midgray"
              title="thServiceDomain does not match host domain">Login not available</span>
    `,
    bindings: {
        // calls to the HTML which sets the user value in the $rootScope.
        onUserChange: "&"
    },
    controller: ['$location', '$window', 'localStorageService', 'thNotify',
        'ThUserModel', '$http', 'thUrl', '$timeout', 'thServiceDomain',
        function ($location, $window, localStorageService, thNotify,
                  ThUserModel, $http, thUrl, $timeout, thServiceDomain) {
            var ctrl = this;
            ctrl.user = {};
            // "clears out" the user when it is detected to be logged out.
            var loggedOutUser = {is_staff: false, username: "", email: "", loggedin: false};

            ctrl.userLoggingIn = $location.path() === '/login';

            // check if the user can login.  thServiceDomain must match
            // host domain.  Remove this if we fix
            // Bug 1317752 - Enable logging in with Taskcluster Auth cross-domain
            if (!thServiceDomain) {
                // thServiceDomain isn't being used, so no mismatch possible.
                this.userCanLogin = true;
            } else {
                var a = document.createElement('a');
                a.href = thServiceDomain;
                this.userCanLogin = a.hostname === $location.host();
            }

            /**
             * Using a window listener here because I wasn't getting reliable
             * results from the events from angular-local-storage.
             */
            $window.addEventListener("storage", function(e) {
                if (e.key === "treeherder.user") {
                    $timeout(function() {
                        var newUser = JSON.parse(e.newValue);
                        if (newUser && newUser.email) {
                            // User was saved to local storage. Use it.
                            ctrl.setLoggedIn(newUser);
                        }
                    }, 0);
                }
            });

            // Ask the back-end if a user is logged in on page load
            if (ctrl.userCanLogin && !ctrl.userLoggingIn) {
                ThUserModel.get().then(function (currentUser) {
                    if (currentUser.email) {
                        ctrl.setLoggedIn(currentUser);
                    } else {
                        ctrl.setLoggedOut();
                    }
                });
            }

            /**
             * Contact login.taskcluster to log the user in.  Opens a new tab
             * for the tc-login, which will get closed if it's successful.
             */
            ctrl.login = function () {
                var hash = encodeURIComponent("#");
                var colon = encodeURIComponent(":");
                var target = `${$location.protocol()}${colon}//${$location.host()}${colon}${$location.port()}/${hash}/login`;
                var description = "Treeherder";
                var url = `https://login.taskcluster.net/?target=${target}&description=${description}`;

                // open a new tab to show the taskcluster auth login page
                $window.open(url, "_blank");
            };

            /**
             * Contact Treeherder back-end to log the user out and invalidate
             * the session token.  Then updates the UI
             */
            ctrl.logout = function () {
                $http.get(thUrl.getRootUrl("/auth/logout/"))
                    .then(function() {
                        ctrl.setLoggedOut();
                    }, function(data) {
                        thNotify.send(`Logout failed: ${data.data}`, "danger", true);
                    });
            };

            ctrl.setLoggedIn = function(newUser) {
                newUser.loggedin = true;
                localStorageService.set("user", newUser);
                ctrl.user = newUser;
                ctrl.onUserChange({$event: {user: newUser}});

            };

            ctrl.setLoggedOut = function() {
                localStorageService.set("user", loggedOutUser);
                localStorageService.set('taskcluster.credentials', {});
                ctrl.user = loggedOutUser;
                ctrl.onUserChange({$event: {user: loggedOutUser}});
            };
        }]
});

treeherder.component("loginCallback", {
    template: `
        <div ng-if="!loginError">
            <span>Logging in... <span class="fa fa-spinner fa-spin"></span></span>
        </div>
        <div ng-if="loginError">
            <span>Error logging in: {{loginError}}</span>
        </div>
    `,
    controller: ['localStorageService', '$location', '$window', '$http', '$scope',
        function(localStorageService, $location, $window, $http, $scope) {
            const host = $location.host();
            const port = $location.port();
            const loginUrl = `${$location.protocol()}://${host}:${port}/api/auth/login/`;
            const credentials = {
                id: $location.search().clientId,
                key: $location.search().accessToken,
                algorithm: 'sha256'
            };

            this.loginError = null;
            var payload = {
                credentials: credentials,
            };

            // Cribbed from taskcluster-tools. Save this for interacting with tc
            const results = $location.search();
            if (results.certificate) {
                results.certificate = JSON.parse(results.certificate);
                payload.ext = hawk.utils.base64urlEncode(JSON.stringify({"certificate": results.certificate}));
            }

            const header = hawk.client.header(loginUrl, 'GET', payload);

            // send a request from client side to TH server signed with TC
            // creds from login.taskcluster.net
            $http.get(loginUrl,
                      {headers: {"tcauth": header.field}})
                .then(function(resp) {
                    var user = resp.data;
                    user.loggedin = true;
                    localStorageService.set("user", user);
                    localStorageService.set('taskcluster.credentials', results);
                    $window.close();
                }, function(data) {
                    $scope.loginError = data.data.detail;
                });
        }
    ]
});
