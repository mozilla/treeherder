'use strict';

/* Services */
treeherder.factory('thService',
                   ['$rootScope', 'thServiceDomain',
                   function($rootScope, thServiceDomain) {
    return {
        getRootUrl: function(uri) {
            return thServiceDomain + "/api" + uri;
        },
        getProjectUrl: function(uri) {
            return thServiceDomain + "/api/project/" + $rootScope.repo + uri;
        }
    };
    return thService;

}]);

treeherder.factory('thArtifact',
                   ['$http', 'thService',
                   function($http, thService) {

    // get the pushes for this tree
    // sample: 'resources/push_sample.json'
    return {
        getArtifact: function(id) {
            return $http.get(thService.getProjectUrl(
                "/artifact/" + id + "/?format=json"));
        }
    }
}]);

treeherder.factory('thResultSets',
                   ['$http', 'thService',
                   function($http, thService) {

    // get the pushes for this tree
    // sample: 'resources/push_sample.json'
    return {
        getResultSets: function() {
            return $http.get(thService.getProjectUrl("/resultset/?format=json"));
        }
    }
}]);

treeherder.factory('thResults',
                   ['$http', 'thService', '$rootScope',
                   function($http, thService, $rootScope) {
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
            // store the results in scope for this push via ajax

            var jobUrl = thService.getProjectUrl("/resultset/" + result_set.id + "/?format=json");
            console.log("fetching for " + result_set.id + " from: " + jobUrl);
            $scope.isLoadingResults = true;
            $http.get(jobUrl).
                success(
                    function(data) {
                        $scope.job_results = data["platforms"];
                        result_set.warning_level = getWarningLevel($scope.job_results);

                        $scope.isLoadingResults = false;

                        // whether or not push results list is collapsed
                        $scope.isCollapsedResults = result_set.warning_level !== "red";

                        // how to display the warning_level.  collapse green ones
                        switch(String(result_set.warning_level))
                        {
                            case "orange":
                                $scope.pushResultBtn = "btn-warning";
                                $scope.icon = "icon-warning-sign";
                                break;
                            case "red":
                                $scope.pushResultBtn = "btn-danger";
                                $scope.icon = "icon-remove";
                                break;
                            case "grey":
                                $scope.pushResultBtn = "";
                                $scope.icon = "icon-time";
                                break;
                            default:
                                $scope.pushResultBtn = "btn-success";
                                $scope.icon = "icon-ok";
                                $scope.isCollapsedResults = true;
                                break;
                        }
                    }
                );
        }

    };
}]);

treeherder.factory('thRepos',
                   ['$http', 'thService', '$rootScope',
                   function($http, thService, $rootScope) {

    // get the repositories (aka trees)
    // sample: 'resources/menu.json'
    return {
        getRepos: function($rootScope) {
            $http.get(thService.getRootUrl("/repository/?format=json")).
                success(function(data) {
                    $rootScope.repos = data;
                });
        }
    };
}]);
