'use strict';

treeherder.factory('thService',
                   ['$rootScope',
                   function($rootScope) {
    return {
        getUrl: function(uri) {
            return "http://192.168.33.10/api/project/" + $rootScope.tree + uri;
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
            $http.get(thService.getUrl("/resultset/?format=json")).success(function(data) {
                $rootScope.result_sets = data;
            });
        }
    }
}]);

/* Services */
treeherder.factory('thResults',
                   ['$http', 'thService', '$rootScope',
                   function($http, thService, $rootScope) {
    var getWarningLevel = function(results) {
        var LEVELS = {
            1: "green",
            2: "grey",
            3: "orange",
            4: "red"
        };

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
        return LEVELS[level];
    };
    var isLoadingResults = true;


    return {
        getResults: function(result_set, $rootScope, $scope) {
            // store the results in scope for this push via ajax
            // ``idx`` is just a hack for the static data loading from file.
//            var resourceUrl = 'resources/results' + idx + '.json';

            var jobUrl = thService.getUrl("/resultset/" + result_set.id + "/?format=json");
            console.log("fetching for " + result_set.id + " from: " + jobUrl);
            isLoadingResults = true;
            $http.get(jobUrl).success(
                function(data) {
                    console.log("done fetching for: " + result_set.id);
                    // this feels like the right way

                    $scope.job_results = data["jobs"];
                    result_set.warning_level = getWarningLevel($scope.job_results);

                    isLoadingResults = false;

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
                        default:
                            $scope.pushResultBtn = "btn-success";
                            $scope.icon = "icon-ok";
                            $scope.isCollapsedResults = true;
                            break;
                    }
                }
            ).error(
                function(data, status, headers, config) {
                    console.log(data)
                });
        }

    };
}]);