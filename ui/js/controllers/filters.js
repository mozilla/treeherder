"use strict";

treeherder.controller('StatusFilterPanelCtrl',
    function StatusFilterPanelCtrl($scope, $rootScope, $routeParams, $location, $log,
                               localStorageService, thResultStatusList) {

        $scope.filterOptions = thResultStatusList;

        $scope.filterGroups = {
            failures: {
                value: "failures",
                name: "failures",
                allChecked: true,
                resultStatuses: ["testfailed", "busted", "exception"]
            },
            nonfailures: {
                value: "nonfailures",
                name: "non-failures",
                allChecked: true,
                resultStatuses: ["success", "retry"]
            },
            inProgress: {
                value: "inProgress",
                name: "in progress",
                allChecked: true,
                resultStatuses: ["pending", "running"]
            }
        };

        /**
         * Handle checking the "all" button for a result status group
         */
        $scope.toggleGroup = function(group) {
            var check = function(rs) {$scope.resultStatusFilters[rs] = group.allChecked;};
            _.each(group.resultStatuses, check);
        };

        // which result statuses should be shown
        $scope.$parent.resultStatusFilters = {};

        for (var i = 0; i < $scope.filterOptions.length; i++) {
            $scope.resultStatusFilters[$scope.filterOptions[i]] = true;
        }
        $scope.toggleFilter = function(group, filter) {
            if (!$scope.resultStatusFilters[filter]) {
                group.allChecked = false;
            }
        };
        // whether or not to show classified jobs
        $scope.classifiedFilter = true;

    }
);