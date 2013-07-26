"use strict";

treeherder.controller('JobsCtrl',
    function JobsCtrl($scope, $http) {
        // get the job groups
        $http.get('resources/job_groups.json').success(function(data) {
            $scope.job_groups = data;
            $scope.job_types = [];
            // extract the job_types from the job_groups and place them in scope
            for (var group in $scope.job_groups){
                for(var job_type in $scope.job_groups[group]){
                    $scope.job_types.push($scope.job_groups[group][job_type]);
                }
            }
        });

        function storeDataForPush(push, idx) {
            // store the results in scope for this push via ajax
            // ``idx`` is just a hack for the static data loading from file.
            var resourceUrl = 'resources/results' + idx + '.json';
            console.log("fetching for " + push.timestamp + " from: " + resourceUrl);
            $http.get(resourceUrl).success(
                function(data) {
                    console.log("storing for: " + push.timestamp);
                    $scope.results[push.timestamp] = data;
                }
            );
        }

        $scope.results = {};
        // get a push sample
        $http.get('resources/push_sample.json').success(function(data) {
            $scope.push_sample = data;
            for (var i = 0; i < data.pushes.length; i++) {
                storeDataForPush(data.pushes[i], i+1);
            }
        });

        // compare push values
        $scope.status = "everything is A-OK";
        $scope.oldRev = "select push";
        $scope.newRev = "select push";

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
    function PushCtrl($scope) {

        // whether or not push results list is collapsed
        $scope.isCollapsedResults = false;

        // whether or not revision list for a push is collapsed
        $scope.isCollapsedRevisions = true;

        // how to display the warning_level.  collapse green ones
        switch(String($scope.push.warning_level))
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
);
