"use strict";

treeherder.controller('JobsCtrl',
    function JobsCtrl($scope, $http, $rootScope, $location, $routeParams, thResultSets) {

        // set the default tree to mozilla-central if not specified
        if ($routeParams.hasOwnProperty("tree") &&
            $routeParams.tree !== "") {
            $rootScope.tree = $routeParams.tree;
        } else {
            $rootScope.tree = "mozilla-inbound";
        }

        // get the job groups
        // todo: should this be a service too?
        $http.get('resources/job_groups.json').success(function(data) {
            $scope.job_groups = data;
            $scope.job_types = [];
            // extract the job_types from the job_groups and place them in scope
            for (var group in $scope.job_groups){
                if ($scope.job_groups.hasOwnProperty(group)) {
                    for(var job_type in $scope.job_groups[group]){
                        if ($scope.job_groups[group].hasOwnProperty(job_type)) {
                            $scope.job_types.push($scope.job_groups[group][job_type]);
                        }
                    }
                }
            }
        });

        $rootScope.results = {};
        thResultSets.getResultSets($rootScope);

        // compare push values
        $scope.oldRev = null;
        $scope.newRev = null;
        $scope.isCollapsedCompare = ($scope.oldRev === null && $scope.newRev === null);

        $scope.compare = function() {
            // compare two revisions in compare-talos
            if ($scope.oldRev !== "select push" && $scope.newRev !== "select push") {
                var compareurl = "http://perf.snarkfest.net/compare-talos/index.html?" +
                    "oldRevs=" + $scope.oldRev +
                    "&newRev=" + $scope.newRev +
                    "8196c86355bc&submit=true";
            } else {
                // both revs must be set to compare, notify error.
                $scope.status = "Both revisions must be set to compare";
            }
        };

    }
);

treeherder.controller('PushCtrl',
    function PushCtrl($scope, thResults) {
        // whether or not revision list for a push is collapsed
        $scope.isCollapsedRevisions = true;

        $scope.isCollapsedResults = true;
        thResults.getResults($scope.push, $scope);
    }
);
