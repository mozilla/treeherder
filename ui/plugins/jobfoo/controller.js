"use strict";

treeherder.controller('JobFooPluginCtrl',
    function JobFooPluginCtrl($scope) {

        $scope.$watch('selectedJob', function(newValue, oldValue) {
            // preferred way to get access to the selected job
            if (newValue) {
                $scope.job = newValue;
            }
        }, true);
    }
);
