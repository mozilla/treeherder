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
        getResultSets: function(offset=0, count=10) {
            // the default notation above only works in some browsers (firefox)
            offset = typeof offset == 'undefined'?  0: offset;
            count = typeof count == 'undefined'?  10: count;

            return $http.get(thUrl.getProjectUrl("/resultset/"),
                             {params: {
                                exclude_empty: 1,
                                offset: offset,
                                count: count
                             }}
            );
        }
    }
}]);

treeherder.factory('thResults',
                   ['$http', 'thUrl', '$rootScope', '$log',
                   function($http, thUrl, $rootScope, $log) {
    var getWarningLevel = function(results) {

        var COLORS = {
            "green": 1,
            "grey": 2,
            "orange": 3,
            "red": 4
        };

        var level = 1;
        for (var i = 0; i < results.length; i++) {
            var platform = results[i];
            level = Math.max(level, COLORS[platform.warning_level]);
        }
        return Object.keys(COLORS).filter(function(key) {
            return COLORS[key] === level
        })[0];
    };
    var isLoadingResults = true;


    return {
        getResults: function(result_set, $scope) {
            // store the results in scope for this resultset via ajax

            var jobUrl = thUrl.getProjectUrl("/resultset/" + result_set.id + "/");
            $scope.isLoadingResults = true;
            $http.get(jobUrl).
                success(
                    function(data) {
                        $scope.job_results = data["platforms"];
                        result_set.warning_level = getWarningLevel($scope.job_results);

                        $scope.isLoadingResults = false;

                        // whether or not resultset list is collapsed
                        $scope.isCollapsedResults = result_set.warning_level !== "red";

                        // how to display the warning_level.  collapse green ones
                        switch(String(result_set.warning_level))
                        {
                            case "orange":
                                $scope.resultsetStateBtn = "btn-warning";
                                $scope.icon = "glyphicon glyphicon-warning-sign";
                                break;
                            case "red":
                                $scope.resultsetStateBtn = "btn-danger";
                                $scope.icon = "glyphicon glyphicon-remove";
                                break;
                            case "grey":
                                $scope.resultsetStateBtn = "";
                                $scope.icon = "glyphicon glyphicon-time";
                                break;
                            default:
                                $scope.resultsetStateBtn = "btn-success";
                                $scope.icon = "glyphicon glyphicon-ok";
                                $scope.isCollapsedResults = true;
                                break;
                        }
                    }
                );
        }

    };
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
