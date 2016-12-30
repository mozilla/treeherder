'use strict';

treeherder.factory('thTaskcluster', ['$window', 'localStorageService',
    function($window, localStorageService) {
        let client = $window.taskcluster;
        client.config({
            credentials: localStorageService.get('taskcluster.credentials'),
        });
        return client;
    }
]);
