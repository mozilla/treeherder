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
    controller: ['$scope', '$location', '$window', '$localStorage',
        'ThUserModel', '$http', 'thUrl',
        function ($scope, $location, $window, $localStorage,
                  ThUserModel, $http, thUrl) {
            $scope.user = {};
            // can't reference "this" within a $watch, create var reference
            // calls to the HTML which sets the user value in the $rootScope.
            var onUserChange = this.onUserChange;
            // "clears out" the user when it is detected to be logged out.
            var loggedOutUser = {is_staff: false, email: "", loggedin: false};

            /**
             * Watch the local storage to determine if the user has changed.
             * This is required because the login with TC happens on a separate
             * tab and so watching localstorage is the only way to detect that
             * a user has been logged in.
             *
             * This watch is hit on page load, during a fresh login, or when
             * another tab logs in or out.
             *
             * I was hitting an intermittent error where you would log in, and
             * it would immediately hit this watcher with a value of
             * ``undefined`` for ``newValue``.  For that reason, I'm not
             * including an ``else`` clause that would log the user out if
             * the value comes back empty
             */
            $scope.$watch(function () {
                return $localStorage.user;
            }, function (newValue) {
                console.log("newValue", newValue);
                if (newValue) {
                    // user exists and should be marked as logged in
                    _.extend($scope.user, newValue);
                    console.log("watch hit", $scope.user);
                    onUserChange({$event: {user: $scope.user}});
                }
            }, true);

            // determine whether a user is currently logged in
            ThUserModel.get().then(function (currentUser) {
                if (currentUser.email) {
                    console.log("page load login", currentUser);
                    currentUser.loggedin = true;
                    $localStorage.user = currentUser;
                } else {
                    console.log("page load logout");
                    $localStorage.user = loggedOutUser;
                    setLoggedOut();
                }
            });

            $scope.login = function () {
                var hash = encodeURIComponent("#");
                var colon = encodeURIComponent(":");
                var target = `${$location.protocol()}${colon}//${$location.host()}${colon}${$location.port()}/${hash}/login`;
                var description = "Treeherder";
                var url = `https://login.taskcluster.net/?target=${target}&description=${description}`;
                $localStorage.user = loggedOutUser;

                // open a new tab to show the taskcluster auth login page
                $window.open(url, "_blank");
            };

            $scope.logout = function () {
                $localStorage.user = loggedOutUser;
                $http.get(thUrl.getRootUrl("/auth/logout/"));
                setLoggedOut();
            };

            var setLoggedOut = function() {
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
    controller: ['$localStorage', '$location', '$window', '$http', '$scope',
        function($localStorage, $location, $window, $http, $scope) {
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
                    $localStorage.user = user;
                    $window.close();
                }, function(data) {
                    $scope.loginError = data.statusText;
                });
        }
    ]
});
