'use strict';

treeherder.directive('personaButtons', [
    '$http', '$q', '$log', '$rootScope', 'localStorageService',
    'thServiceDomain', 'BrowserId', 'ThUserModel',
    function(
        $http, $q, $log, $rootScope, localStorageService, thServiceDomain,
        BrowserId, ThUserModel) {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            scope.user = scope.user
                || angular.fromJson(localStorageService.get('user'))
                || {};
            // check if already know who the current user is
            // if the user.email value is null, it means that he's not logged in
            scope.user.email = scope.user.email || null;
            scope.user.loggedin = scope.user.email == null ? false : true;

            scope.login = function(){
                /*
* BrowserID.login returns a promise of the verification.
* If successful, we will find the user email in the response
*/
                BrowserId.login()
                .then(function(response){
                    scope.user.loggedin = true;
                    scope.user.email = response.data.email;
                    // retrieve the current user's info from the api
                    // including the exclusion profile
                    ThUserModel.get().then(function(user){
                        angular.extend(scope.user, user);
                        localStorageService.add('user', angular.toJson(scope.user));
                    }, null);
                },function(){
                    // logout if the verification failed
                    scope.logout();
                });
            };
            scope.logout = function(){
                BrowserId.logout().then(function(response){
                    scope.user = {loggedin: false, email:null};
                    localStorageService.remove('user');
                });
            };


            navigator.id.watch({
                /*
* loggedinUser is all that we know about the user before
* the interaction with persona. This value could come from a cookie to persist the authentication
* among page reloads. If the value is null, the user is considered logged out.
*/

                loggedInUser: scope.user.email,
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
        },
        templateUrl: 'partials/persona_buttons.html'
    };
}]);
