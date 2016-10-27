"use strict";


treeherder.component("login", {
    template: `
        <span class="dropdown"
              ng-if="$ctrl.user.loggedin">
          <button id="logoutLabel" title="Logged in as: {{$ctrl.user.email}}" role="button"
                  data-toggle="dropdown" data-target="#"
                  class="btn btn-view-nav btn-right-navbar nav-persona-btn">
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
           ng-if="!$ctrl.user.loggedin"
           ng-click="$ctrl.login()">Login/Register</a>
    `,
    bindings: {
        onUserChange: "&"
    },
    controller: function ($scope, $location, $window, $localStorage,
                          ThUserModel, $http, thUrl) {
        this.user = {};
        // can't reference "this" within a $watch
        var user = this.user;
        var onUserChange = this.onUserChange;

        // determine whether a user is currently logged in
        ThUserModel.get().then(function(currentUser) {
            if (user.email) {
                $localStorage.user = currentUser;
                onUserChange({$event: {user: currentUser}});

            } else {
                delete $localStorage.user;
                _.extend(user, {is_staff: false, email: "", loggedin: false});
            }
        });

        this.login = function () {
            var hash = encodeURIComponent("#");
            var colon = encodeURIComponent(":");
            var target = `${$location.protocol()}${colon}//${$location.host()}${colon}${$location.port()}/${hash}/login`;
            var description = "Treeherder";
            var url = `https://login.taskcluster.net/?target=${target}&description=${description}`;
            delete $localStorage.user;

            $window.open(url, "_blank");
        };

        $scope.$watch(function () { return $localStorage.user; }, function () {
            if ($localStorage.user) {
                _.extend(user, $localStorage.user);
                user.loggedin = true;
                onUserChange({$event: {user: user}});
            }
        });

        this.logout = function () {
            delete $localStorage.user;
            _.extend(user, {is_staff: false, email: "", loggedin: false});
            $http.get(thUrl.getRootUrl("/auth/logout/"));
        };
    }
});

treeherder.service(
    'loginCallback', ['$localStorage', '$location', '$window', '$http', '$cookies',
    function($localStorage, $location, $window, $http) {

        const host = $location.host();
        const port = $location.port();
        const urlBase = `${$location.protocol()}://${host}:${port}/`;
        const certificate = $location.search().certificate;
        const credentials = {
            id: $location.search().clientId,
            key: $location.search().accessToken,
            algorithm: 'sha256'
        };

        const header = hawk.client.header(urlBase, 'GET', {
            credentials: credentials,
            ext: hawk.utils.base64urlEncode(JSON.stringify({"certificate": JSON.parse(certificate)}))}
        );

        // send a request from client side to TH server signed with TC
        // creds from login.taskcluster.net
        $http.get(`${urlBase}api/auth/login/?host=${host}&port=${port}`,
                  {headers: {"oth": header.field}})
            .then(function(resp) {
                $localStorage.user = resp.data.user;
                $window.close();
            });
    }]
);
