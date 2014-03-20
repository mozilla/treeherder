'use strict';

treeherder.directive('personaButtons', function($http, $q, $log, $rootScope, localStorageService, thServiceDomain, BrowserId) {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            scope.user = scope.user || {};
            // check if already know who the current user is
            // if the user.email value is null, it means that he's not logged in
            scope.user.email = scope.user.email || localStorageService.get('user.email');
            scope.user.loggedin =  scope.user.email === null ? false : true;

            scope.login = function(){
                /*
                * BrowserID.login returns a promise of the verification.
                * If successful, we will find the user email in the response
                */
                BrowserId.login()
                .then(function(response){
                    scope.user.loggedin = true;
                    scope.user.email = response.data.email;
                    localStorageService.add('user.email', scope.user.email);
                },function(){
                    // logout if the verification failed
                    scope.logout();
                });
            };
            scope.logout = function(){
                BrowserId.logout().then(function(response){
                    scope.user.loggedin = false;
                    scope.user.email = null;
                    localStorageService.remove('user.loggedin');
                    localStorageService.remove('user.email');
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
});
