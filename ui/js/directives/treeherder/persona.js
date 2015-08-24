'use strict';

treeherder.directive('personaButtons', [
    '$http', '$q', '$log', '$rootScope',
    'thServiceDomain', 'BrowserId', 'ThUserModel', 'thNotify',
    function(
        $http, $q, $log, $rootScope, thServiceDomain,
        BrowserId, ThUserModel, thNotify) {

        return {
            restrict: "E",
            link: function(scope, element, attrs) {
                scope.initialized = $q.all([
                    ThUserModel.get().then(function(user){
                        $rootScope.user = {};
                        // if the user.email value is null, it means that he's not logged in
                        $rootScope.user.email = user.email || null;
                        $rootScope.user.loggedin = $rootScope.user.email !== null;

                        if ($rootScope.user.loggedin) {
                            angular.extend($rootScope.user, user);
                        }
                    }),
                    $http.get('/browserid/csrf/')
                ]).then(function(){
                    navigator.id.watch({
                        /*
                         * loggedinUser is all that we know about the user before
                         * the interaction with persona. This value could come from a cookie to persist the authentication
                         * among page reloads. If the value is null, the user is considered logged out.
                         */
                        loggedInUser: $rootScope.user.email,
                        /*
                         * We need a watch call to interact with persona.
                         * onLogin is called when persona provides an assertion
                         * This is the only way we can know the assertion from persona,
                         * so we resolve BrowserId.requestDeferred with the assertion retrieved
                         */
                        onlogin: function(assertion){
                            if (BrowserId.requestDeferred) {
                                BrowserId.requestDeferred.resolve(assertion);
                            }
                        },
                        /*
                         * Resolve BrowserId.logoutDeferred once the user is logged out from persona
                         */
                        onlogout: function(){
                            if (BrowserId.logoutDeferred) {
                                BrowserId.logoutDeferred.resolve();
                            }
                        }
                    });
                });


                scope.login = function(){
                    /*
                     * BrowserID.login returns a promise of the verification.
                     * If successful, we will find the user email in the response
                     */
                    scope.initialized.then(function(){
                        BrowserId.login()
                            .then(function(response){
                                $rootScope.user.loggedin = true;
                                $rootScope.user.email = response.data.email;
                                // retrieve the current user's info from the api
                                ThUserModel.get().then(function(user){
                                    angular.extend($rootScope.user, user);
                                }, null);
                            },function(response){
                                var message = "Login failed: " + response.status + " " + response.statusText;
                                thNotify.send(message, "danger", true);

                                // logout if the verification failed
                                scope.logout();
                            });
                    });
                };
                scope.logout = function(){
                    scope.initialized.then(function(){
                        BrowserId.logout().then(function(response){
                            $rootScope.user = {loggedin: false, email:null};
                        });
                    });
                };
            },
            templateUrl: 'partials/main/persona_buttons.html'
        };
    }]);
