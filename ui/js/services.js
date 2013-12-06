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
            return thServiceDomain + "/api/project/" + $rootScope.repoName + uri;
        },
        getLogViewerUrl: function(artifactId) {
            return "logviewer.html#?id=" + artifactId + "&repo=" + $rootScope.repoName;
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
                   ['$http', 'thUrl', '$rootScope', '$log',
                   function($http, thUrl, $rootScope, $log) {

    // get the repositories (aka trees)
    // sample: 'resources/menu.json'
    var byName = function(name) {
        if ($rootScope.repos != undefined) {
            for (var i = 0; i < $rootScope.repos.length; i++) {
                var repo = $rootScope.repos[i];
                if (repo.name === name) {
                    return repo;
                }
            };
        } else {
            $log.warn("Repos list has not been loaded.")
        }
        $log.warn("'" + name + "' not found in repos list.")
        return null;
    }

    return {
        // load the list of repos into $rootScope, and set the current repo.
        load: function(name) {
            return $http.get(thUrl.getRootUrl("/repository/")).
                success(function(data) {
                    $rootScope.repos = data;
                    if (name) {
                        $rootScope.currentRepo = byName(name)
                    }
                });
        },
        // return the currently selected repo
        getCurrent: function() {
            return $rootScope.currentRepo;
        },
        // set the current repo to one in the repos list
        setCurrent: function(name) {
            $rootScope.currentRepo = byName(name)
        },
        // get a repo object without setting anything
        getRepo: function(name) {
            return byName(name);
        }
    };
}]);
