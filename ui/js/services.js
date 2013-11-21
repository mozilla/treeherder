'use strict';

/* Services */
treeherder.factory('thUrl',
                   ['$rootScope', 'thServiceDomain',
                   function($rootScope, thServiceDomain) {
    return {
        getRootUrl: function(uri) {
            return thServiceDomain + "/api" + uri;
        },
        getProjectUrl: function(uri) {
            return thServiceDomain + "/api/project/" + $rootScope.repo + uri;
        },
        getLogViewerUrl: function(artifactId) {
            return "logviewer.html#?id=" + artifactId + "&repo=" + $rootScope.repo;
        }
    };
    return thUrl;

}]);

treeherder.factory('thArtifact',
                   ['$http', 'thUrl',
                   function($http, thUrl) {

    // get the artifacts for this tree
    return {
        getArtifact: function(id) {
            return $http.get(thUrl.getProjectUrl(
                "/artifact/" + id + "/"));
        }
    }
}]);

treeherder.factory('thResultSets',
                   ['$http', 'thUrl',
                   function($http, thUrl) {

    // get the resultsets for this repo
    return {
        getResultSets: function(offset, count) {
            // the default notation above only works in some browsers (firefox)
            offset = typeof offset == 'undefined'?  0: offset;
            count = typeof count == 'undefined'?  10: count;

            return $http.get(thUrl.getProjectUrl("/resultset/"),
                             {params: {
                                offset: offset,
                                count: count,
                                format: "json"
                             }}
            );
        }
    }
}]);

treeherder.factory('thRepos',
                   ['$http', 'thUrl', '$rootScope',
                   function($http, thUrl, $rootScope) {

    // get the repositories (aka trees)
    // sample: 'resources/menu.json'
    return {
        getRepos: function($rootScope) {
            $http.get(thUrl.getRootUrl("/repository/")).
                success(function(data) {
                    $rootScope.repos = data;
                });
        }
    };
}]);
