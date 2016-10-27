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
    controller: function ($scope, $location, $window, $localStorage, ThUserModel) {
        this.user = {};
        // can't reference "this" within a $watch
        var user = this.user;
        var onUserChange = this.onUserChange;

        // determine whether a user is currently logged in
        ThUserModel.get().then(function(currentUser) {
            if (user.email) {
                console.log("initial user", currentUser);
                $localStorage.user = currentUser;
                onUserChange({$event: {user: currentUser}});

            } else {
                delete $localStorage.user;
                _.extend(user, {isSheriff: false, email: "", loggedin: false});
            }
        });

        this.login = function () {
            console.log("logging in with TC");
            var hash = encodeURIComponent("#");
            var colon = encodeURIComponent(":");
            var target = `${$location.protocol()}${colon}//${$location.host()}${colon}${$location.port()}/${hash}/login`;
            var description = "Treeherder";
            var url = `https://login.taskcluster.net/?target=${target}&description=${description}`;
            delete $localStorage.user;

            $window.open(url, "_blank");
        };

        $scope.$watch(function () { return $localStorage.user; }, function () {
            console.log("LocalStorage auth Changed", $localStorage.user);
            if ($localStorage.user) {
                _.extend(user, $localStorage.user);
                user.loggedin = true;
                onUserChange({$event: {user: user}});
                console.log("logged in now", user);
            }
        });

        this.logout = function () {
            console.log("logging out with TC");
            delete $localStorage.user;
            _.extend(user, {isSheriff: false, email: "", loggedin: false});

            // need to clear the session cookies, too.  But I think the login part is
            // working now
        };
    }
});

treeherder.service(
    'loginCallback', ['$localStorage', '$location', '$window', '$http', '$cookies',
    function($localStorage, $location, $window, $http, $cookies) {

    const urlBase = `${$location.protocol()}://${$location.host()}:${$location.port()}/`;
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

    console.log("header", header);
    // So here we send a request from client side to your server signed with TC creds from login.taskcluster.net
    $http.get(`${urlBase}api/auth/`, {headers: {"oth": header.field}})
        .then(function(resp) {
            console.log("success", resp);
            $localStorage.user = resp.data.user;
            // $window.close();
        },function(data) {
            console.log("failed", data);
        });
}]);
