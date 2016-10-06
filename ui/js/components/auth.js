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
              ng-if="user.loggedin">
          <button id="logoutLabel" title="Logged in as: {{user.email}}" role="button"
                  data-toggle="dropdown" data-target="#"
                  class="btn btn-view-nav btn-right-navbar nav-persona-btn">
            <div class="nav-user-icon">
              <span class="fa fa-user pull-left"></span>
            </div>
            <span class="fa fa-angle-down lightgray"></span>
          </button>
          <ul class="dropdown-menu" role="menu" aria-labelledby="logoutLabel">
              <li>
                <a ng-click="logout()">Logout</a>
              </li>
          </ul>
        </span>

        <a class="btn btn-view-nav btn-right-navbar nav-login-btn"
           ng-if="!user.loggedin"
           ng-click="login()">Login/Register</a>
    `,
    bindings: {
        onUserChange: "&"
    },
    controller: ['$scope', '$location', '$window', 'localStorageService',
        'ThUserModel', '$http', 'thUrl', '$timeout',
        function ($scope, $location, $window, localStorageService,
                  ThUserModel, $http, thUrl, $timeout) {
            $scope.user = {};
            // calls to the HTML which sets the user value in the $rootScope.
            var onUserChange = this.onUserChange;
            // "clears out" the user when it is detected to be logged out.
            var loggedOutUser = {is_staff: false, username: "", email: "", loggedin: false};

            /**
             * Using a window listener here because I wasn't getting reliable
             * results from the events from angular-local-storage.
             */
            $window.addEventListener("storage", function(e) {
                console.log(e.key, e.newValue);
                if (e.key === "treeherder.user") {
                    $timeout(function() {
                        var newUser = JSON.parse(e.newValue);
                        if (newUser && newUser.email) {
                            // User was saved to local storage. Use it.
                            setLoggedIn(newUser);
                        } else {
                            // TODO try without this next time
                            var storedUser = localStorageService.get("user");
                            if (!storedUser || !storedUser.email) {
                                setLoggedOut();
                            }
                        }
                    }, 0);
                }
            });

            // Ask the back-end if a user is logged in on page load
            ThUserModel.get().then(function (currentUser) {
                if (currentUser.email) {
                    setLoggedIn(currentUser);
                } else {
                    setLoggedOut();
                }
            });

            /**
             * Contact login.taskcluster to log the user in.  Opens a new tab
             * for the tc-login, which will get closed if it's successful.
             */
            $scope.login = function () {
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
            $scope.logout = function () {
                $http.get(thUrl.getRootUrl("/auth/logout/"));
                setLoggedOut();
            };

            var setLoggedIn = function(newUser) {
                console.log("set login", newUser);
                newUser.loggedin = true;
                localStorageService.set("user", newUser);
                _.extend($scope.user, newUser);
                onUserChange({$event: {user: $scope.user}});

            };

            var setLoggedOut = function() {
                console.log("set logout");
                localStorageService.set("user", loggedOutUser);
                _.extend($scope.user, loggedOutUser);
                onUserChange({$event: {user: loggedOutUser}});
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
            const urlBase = `${$location.protocol()}://${host}:${port}/`;
            const certificate = $location.search().certificate;
            const credentials = {
                id: $location.search().clientId,
                key: $location.search().accessToken,
                algorithm: 'sha256'
            };
            this.loginError = null;
            const header = hawk.client.header(urlBase, 'GET', {
                credentials: credentials,
                ext: hawk.utils.base64urlEncode(JSON.stringify({"certificate": JSON.parse(certificate)}))}
            );

            // send a request from client side to TH server signed with TC
            // creds from login.taskcluster.net
            $http.get(`${urlBase}api/auth/login/?host=${host}&port=${port}`,
                      {headers: {"oth": header.field}})
                .then(function(resp) {
                    var user = resp.data;
                    user.loggedin = true;
                    localStorageService.set("user", user);
                    $window.close();
                }, function(data) {
                    $scope.loginError = data.statusText;
                });
        }
    ]
});
