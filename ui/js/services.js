'use strict';

treeherder.factory('thService',
                   ['$rootScope', 'thServiceDomain',
                   function($rootScope, thServiceDomain) {
    return {
        getRootUrl: function(uri) {
            return thServiceDomain + "/api" + uri;
        },
        getUrl: function(uri) {
            return thServiceDomain + "/api/project/" + $rootScope.repo + uri;
        }
    };
    return thService;

}]);

treeherder.factory('thResultSets',
                   ['$http', 'thService', 'thResults', '$rootScope',
                   function($http, thService, thResults, $rootScope) {

    // get the pushes for this tree
    // sample: 'resources/push_sample.json'
    return {
        getResultSets: function($rootScope) {
            $http.get(thService.getUrl("/resultset/?format=json")).
                success(function(data) {
                    $rootScope.result_sets = data;
                }).
                error(
                    function(data, status, headers, config) {
                        console.log("error: " + data + headers);
                    });
                ;
        }
    }
}]);

/* Services */
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

            var jobUrl = thService.getUrl("/resultset/" + result_set.id + "/?format=json");
            console.log("fetching for " + result_set.id + " from: " + jobUrl);
            $scope.isLoadingResults = true;
            $http.get(jobUrl).
                success(
                    function(data) {
                        console.log("done fetching for: " + result_set.id);
                        // this feels like the right way

                        $scope.job_results = data["platforms"];
                        result_set.warning_level = getWarningLevel($scope.job_results);

                        $scope.isLoadingResults = false;

                        // whether or not push results list is collapsed
                        $scope.isCollapsedResults = result_set.warning_level !== "red";

                        // how to display the warning_level.  collapse green ones
                        console.log($scope.push.warning_level);
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
                ).
                error(
                    function(data, status, headers, config) {
                        console.log("error: " + data + headers);
                    });
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
                }).
                error(
                    function(data, status, headers, config) {
                        console.log("error: " + data + headers);
                    });
        }
    };
}]);
