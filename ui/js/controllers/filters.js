"use strict";

treeherder.controller('StatusFilterPanelCtrl',
    function StatusFilterPanelCtrl($scope, $rootScope, $routeParams, $location, $log,
                               localStorageService, thResultStatusList, thEvents, thJobFilters) {

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
            thJobFilters.toggleFilters(thJobFilters.resultStatus, group.resultStatuses, group.allChecked);
            $rootScope.$broadcast(thEvents.globalFilterChanged,
                                  {target: group, newValue: group.allChecked});
            showCheck();
        };

        $scope.toggleFilter = function(group, filter) {
            if (!$scope.resultStatusFilters[filter]) {
                group.allChecked = false;
                thJobFilters.removeFilter(thJobFilters.resultStatus, filter);
            } else {
                thJobFilters.addFilter(thJobFilters.resultStatus, filter);
            }
            $rootScope.$broadcast(thEvents.globalFilterChanged,
                                  {target: filter, newValue: $scope.resultStatusFilters[filter]});
            showCheck();
        };

        $scope.createFieldFilter = function() {
            $scope.newFieldFilter = {field: "", value: ""};
        };
        $scope.cancelFieldFilter = function() {
            $scope.newFieldFilter = null;
        };


        $scope.addFieldFilter = function() {
            $log.debug("adding filter of " + $scope.newFieldFilter.field);
            if (!$scope.newFieldFilter || $scope.newFieldFilter.field === "" || $scope.newFieldFilter.value === "") {
                return;
            }
            thJobFilters.addFilter(
                $scope.newFieldFilter.field,
                $scope.newFieldFilter.value
            );
            $scope.fieldFilters.push({
                field: $scope.newFieldFilter.field,
                value: $scope.newFieldFilter.value
            });
            $scope.newFieldFilter = null;

        };

        $scope.removeAllFieldFilters = function() {
            $scope.fieldFilters.forEach(function(ff) {
                thJobFilters.removeFilter(ff.field, ff.value);
            });
            $scope.fieldFilters = [];
        };

        $scope.removeFilter = function(index) {
            $log.debug("removing index: " + index);
            thJobFilters.removeFilter(
                $scope.fieldFilters[index].field,
                $scope.fieldFilters[index].value
            );
            $scope.fieldFilters.splice(index, 1);
        };

        /*
        @@@ TODO: CAMD: test code, remove before merge.
         */
        var jobs = [];
        $scope.filterGroups.inProgress.resultStatuses.forEach(function(rs) {jobs.push({state: rs, result: "unknown"});});
        $scope.filterGroups.failures.resultStatuses.forEach(function(rs) {jobs.push({state: "completed", result: rs});});
        $scope.filterGroups.nonfailures.resultStatuses.forEach(function(rs) {jobs.push({state: "completed", result: rs});});

        var showCheck = function() {
            jobs.forEach(function(job) {
               $log.debug("show job: " + job.result + " " + job.state + ": " + thJobFilters.showJob(job));
            });
        };
        // END test code

        $scope.resultStatusFilters = {};
        for (var i = 0; i < $scope.filterOptions.length; i++) {
            $scope.resultStatusFilters[$scope.filterOptions[i]] = true;
        }
        // whether or not to show classified jobs
        $scope.classifiedFilter = true;

        // field filters
        $scope.newFieldFilter = null;
        $scope.fieldFilters = [];
        $scope.fieldChoices = {
            job_type_name: "job name",
            job_type_symbol: "job symbol",
            job_group_name: "group name",
            job_group_symbol: "group symbol",
            platform: "platform"
        };
    }
);