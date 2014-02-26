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
        $scope.toggleResultStatusGroup = function(group) {
            var check = function(rs) {
                $scope.resultStatusFilters[rs] = group.allChecked;
            };

            _.each(group.resultStatuses, check);
            thJobFilters.toggleFilters(
                thJobFilters.resultStatus,
                group.resultStatuses,
                group.allChecked
            );
            $rootScope.$broadcast(thEvents.globalFilterChanged,
                                  {target: group, newValue: group.allChecked});
            showCheck();
        };

        $scope.toggleResultStatusFilter = function(group, filter) {
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

        /**
         * Toggle the filters to show either unclassified or classified jobs,
         * neither or both.
         * @param isClassified - whether to toggle the filter on/off for
         *                       ``classified`` (when true) or ``unclassified``
         *                       (when false)
         */
        $scope.toggleClassificationFilter = function(isClassified) {
            var field = "failure_classification_id";
            // this function is called before the checkbox value has actually
            // changed the scope model value, so change to the inverse.
            var isChecked = !(isClassified? $scope.classifiedFilter: $scope.unClassifiedFilter);
            var func = isChecked? thJobFilters.addFilter: thJobFilters.removeFilter;
            var target = isClassified? "classified": "unclassified";

            func(field, isClassified);

            $rootScope.$broadcast(thEvents.globalFilterChanged,
                                  {target: target, newValue: isChecked});
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
                $scope.newFieldFilter.value,
                $scope.fieldChoices[$scope.newFieldFilter.field].matchType
            );
            $scope.fieldFilters.push({
                field: $scope.newFieldFilter.field,
                value: $scope.newFieldFilter.value
            });
            $rootScope.$broadcast(thEvents.globalFilterChanged,
                                  {target: $scope.newFieldFilter.field, newValue: $scope.newFieldFilter.value});
            $scope.newFieldFilter = null;
            showCheck();

        };

        $scope.removeAllFieldFilters = function() {
            $scope.fieldFilters.forEach(function(ff) {
                thJobFilters.removeFilter(ff.field, ff.value);
            });
            $rootScope.$broadcast(thEvents.globalFilterChanged,
                                  {target: "allFieldFilters", newValue: null});
            $scope.fieldFilters = [];
            showCheck();
        };

        $scope.removeFilter = function(index) {
            $log.debug("removing index: " + index);
            thJobFilters.removeFilter(
                $scope.fieldFilters[index].field,
                $scope.fieldFilters[index].value
            );
            $rootScope.$broadcast(thEvents.globalFilterChanged,
                                  {target: $scope.fieldFilters[index].field, newValue: null});
            $scope.fieldFilters.splice(index, 1);
            showCheck();
        };

        /*
        @@@ TODO: CAMD: test code, remove before merge.
         */
        var jobs = [];
        $scope.filterGroups.inProgress.resultStatuses.forEach(function(rs) {jobs.push({
            state: rs,
            result: "unknown",
            failure_classification_id: null
            });});

        $scope.filterGroups.failures.resultStatuses.forEach(function(rs) {jobs.push({
            state: "completed",
            result: rs,
            job_type_symbol: "A",
            job_type_name: "Apples",
            job_group_symbol: "M",
            job_group_name: "Mochitest",
            failure_classification_id: "bird"
            });});
        $scope.filterGroups.nonfailures.resultStatuses.forEach(function(rs) {jobs.push({
            state: "completed",
            result: rs
            });});

        var showCheck = function() {
            jobs.forEach(function(job) {
               $log.debug("show job: " + JSON.stringify(job) + ": " + thJobFilters.showJob(job));
            });
            $log.debug(JSON.stringify(thJobFilters.getFilters()));
        };
        // END test code

        $scope.resultStatusFilters = {};
        for (var i = 0; i < $scope.filterOptions.length; i++) {
            $scope.resultStatusFilters[$scope.filterOptions[i]] = true;
        }
        // whether or not to show classified jobs
        // these are a special case of filtering because we're not checking
        // for a value, just whether the job has any value set or not.
        // just a boolean check either way
        $scope.classifiedFilter = true;
        $scope.unClassifiedFilter = true;

        // field filters
        $scope.newFieldFilter = null;
        $scope.fieldFilters = [];
        $scope.fieldChoices = {
            job_type_name: {
                name: "job name",
                matchType: thJobFilters.matchType.substr
            },
            job_type_symbol: {
                name: "job symbol",
                matchType: thJobFilters.matchType.exactstr
            },
            job_group_name: {
                name: "group name",
                matchType: thJobFilters.matchType.substr
            },
            job_group_symbol: {
                name: "group symbol",
                matchType: thJobFilters.matchType.exactstr
            },
            platform: {
                name: "platform",
                matchType: thJobFilters.matchType.substr
            }
        };
    }
);
