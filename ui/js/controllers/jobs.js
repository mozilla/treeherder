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

        // get a push sample
        $http.get('resources/push_sample.json').success(function(data) {
            $scope.push_sample = data;
        });

        // get a push sample
        $http.get('resources/results.json').success(function(data) {
            $scope.platforms = data;
        });
    }
);

treeherder.controller('PushCtrl',
    function PushCtrl($scope) {

        // whether or not push results are collapsed
        $scope.isCollapsedResults = false;

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
