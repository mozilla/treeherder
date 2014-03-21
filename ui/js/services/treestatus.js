'use strict';

treeherder.factory('treeStatus', function($http, $q) {

    var urlBase = "https://treestatus.mozilla.org/";
    var get = function(repoName) {
        var deferred = $q.defer();
        var url = urlBase + repoName;

        return $http.get(urlBase + repoName, {params: {format: "json"}})
            .then(function(data) {
                return data;
            });
    };

    return {
        get: get
    };
});

