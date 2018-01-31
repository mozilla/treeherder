import AuthService from '../auth/AuthService';
import { loggedOutUser } from '../auth/auth-utils';

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
            <div class="dropdown-toggle">
                <div class="nav-user-icon">
                  <span class="fa fa-user pull-left"></span>
                </div>
                <div class="nav-user-name">
                    <span>{{$ctrl.user.fullName}}</span>
                </div>
            </div>
          </button>
          <ul class="dropdown-menu nav-dropdown-menu-right" role="menu" aria-labelledby="logoutLabel">
              <li><a ng-click="$ctrl.logout()" class="dropdown-item">Logout</a></li>
          </ul>
        </span>

        <span class="btn btn-right-navbar nav-login-btn"
           ng-if="!$ctrl.user.loggedin && $ctrl.userCanLogin && !ctrl.userLoggingIn"
           ng-click="$ctrl.login()">Login/Register</span>
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
            const authService = new AuthService();
            const ctrl = this;

            ctrl.user = {};
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
                this.userCanLogin = (a.hostname === $location.host() && a.port === $location.port);
            }

            /**
             * Using a window listener here because I wasn't getting reliable
             * results from the events from angular-local-storage.
             */

            $window.addEventListener("storage", function (e) {
                if (e.key === "treeherder.user") {
                    const oldUser = JSON.parse(e.oldValue);
                    const newUser = JSON.parse(e.newValue);

                    if (newUser && newUser.email && !_.isEqual(newUser, oldUser)) {
                        // User was saved to local storage. Use it.
                        $timeout(() => ctrl.setLoggedIn(newUser), 0);
                    } else if (newUser && !newUser.email) {
                        // Show the user as logged out in all other opened tabs
                        $timeout(() => ctrl.setLoggedOut(), 0);
                    }
                }
            });

            // Ask the back-end if a user is logged in on page load
            if (ctrl.userCanLogin && !ctrl.userLoggingIn) {
                ThUserModel.get().then(function (currentUser) {
                    if (currentUser.email && localStorageService.get('userSession')) {
                        ctrl.setLoggedIn(currentUser);
                    } else {
                        ctrl.setLoggedOut();
                    }
                });
            }

            /**
             * Opens a new tab to handle authentication, which will get closed
             * if it's successful.
             */
            ctrl.login = function () {
                $window.open('/login.html', '_blank');
            };

            /**
             * Contact Treeherder back-end to log the user out and invalidate
             * the session token.  Then updates the UI
             */
            ctrl.logout = function () {
                $http.get(thUrl.getRootUrl("/auth/logout/"))
                    .then(function () {
                        ctrl.setLoggedOut();
                    }, function (data) {
                        thNotify.send(`Logout failed: ${data.data}`, "danger", { sticky: true });
                    });
            };

            ctrl.setLoggedIn = function (newUser) {
                const userSession = localStorageService.get('userSession');

                newUser.loggedin = true;
                newUser.fullName = userSession.fullName;

                ctrl.user = newUser;
                ctrl.onUserChange({ $event: { user: newUser } });

                // start session renewal process
                if (userSession && userSession.renewAfter) {
                    authService.resetRenewalTimer(userSession);
                }
            };

            ctrl.setLoggedOut = function () {
                authService.logout();
                ctrl.user = loggedOutUser;
                ctrl.onUserChange({ $event: { user: loggedOutUser } });
            };
        }]
});
