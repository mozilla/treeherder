'use strict';

treeherder.factory('thTaskcluster', ['$window', '$rootScope', 'localStorageService',
    function($window, $rootScope, localStorageService) {
        let client = $window.taskcluster;
        $rootScope.$on("LocalStorageModule.notification.setitem", function() {
            client.config({
                credentials: localStorageService.get('taskcluster.credentials') || {},
            });
        });
        return client;
    }
]);
