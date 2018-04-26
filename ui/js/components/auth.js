import _ from 'lodash';

import treeherder from '../treeherder';
import AuthService from '../auth/AuthService';
import { loggedOutUser } from '../auth/auth-utils';
import thTaskcluster from '../services/taskcluster';
import { getApiUrl } from '../../helpers/url';
import UserModel from '../../models/user';

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
              ng-if="$ctrl.user.isLoggedIn">
          <button id="logoutLabel" title="Logged in as: {{$ctrl.user.email}}" role="button"
                  data-toggle="dropdown"
                  class="btn btn-view-nav">
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

        <span class="btn nav-login-btn"
           ng-if="!$ctrl.user.isLoggedIn"
           ng-click="$ctrl.login()">Login/Register</span>
    `,
    bindings: {
        // calls to the HTML which sets the user value in the $rootScope.
        onUserChange: "&"
    },
    controller: ['$location', '$window', 'thNotify',
        '$http', '$timeout',
        function ($location, $window, thNotify,
                  $http, $timeout) {
            const authService = new AuthService();
            const ctrl = this;

            ctrl.user = {};

            /**
             * Using a window listener here because I wasn't getting reliable
             * results from the events from angular-local-storage.
             */

            $window.addEventListener("storage", function (e) {
                if (e.key === 'user') {
                    const oldUser = JSON.parse(e.oldValue);
                    const newUser = JSON.parse(e.newValue);

                    if (newUser && newUser.email && !_.isEqual(newUser, oldUser)) {
                        // User was saved to local storage. Use it.
                        $timeout(() => ctrl.setLoggedIn(newUser), 0);
                    } else if (newUser && !newUser.email) {
                        // Show the user as logged out in all other opened tabs
                        $timeout(() => ctrl.setLoggedOut(), 0);
                    }
                } else if (e.key === 'userSession') {
                    // used when a different tab updates userSession,
                    thTaskcluster.updateAgent();
                }
            });

            // Ask the back-end if a user is logged in on page load
            UserModel.get().then(async function (currentUser) {
                if (currentUser.email && localStorage.getItem('userSession')) {
                    ctrl.setLoggedIn(currentUser);
                } else {
                    ctrl.setLoggedOut();
                }
            });

            /**
             * Opens a new tab to handle authentication, which will get closed
             * if it's successful.
             */
            ctrl.login = function () {
                // Intentionally not using `noopener` since `window.opener` used in LoginCallback.
                $window.open('/login.html', '_blank');
            };

            /**
             * Contact Treeherder back-end to log the user out and invalidate
             * the session token.  Then updates the UI
             */
            ctrl.logout = function () {
                $http.get(getApiUrl("/auth/logout/"))
                    .then(function () {
                        ctrl.setLoggedOut();
                    }, function (data) {
                        thNotify.send(`Logout failed: ${data.data}`, "danger", { sticky: true });
                    });
            };

            ctrl.setLoggedIn = function (newUser) {
                const userSession = JSON.parse(localStorage.getItem('userSession'));

                newUser.isLoggedIn = true;
                newUser.fullName = userSession.fullName;

                ctrl.user = newUser;
                ctrl.onUserChange({ $event: { user: newUser } });

                // start session renewal process
                if (userSession && userSession.renewAfter) {
                    authService.resetRenewalTimer();
                }
            };

            ctrl.setLoggedOut = function () {
                authService.logout();
                // logging out will not trigger a storage event since localStorage is being set by the same window
                thTaskcluster.updateAgent();
                ctrl.user = loggedOutUser;
                ctrl.onUserChange({ $event: { user: loggedOutUser } });
            };
        }]
});
