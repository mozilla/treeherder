"use strict";

treeherder.controller('FilterPanelCtrl', [
    '$scope', '$rootScope', '$routeParams', '$location', 'ThLog',
    'localStorageService', 'thResultStatusList', 'thEvents', 'thJobFilters',
    function FilterPanelCtrl(
        $scope, $rootScope, $routeParams, $location, ThLog,
        localStorageService, thResultStatusList, thEvents, thJobFilters) {

        var $log = new ThLog(this.constructor.name);

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

        $scope.resultStatusFilters = {};

        /**
         * Handle checking the "all" button for a result status group
         *
         * quiet - whether or not to broadcast a message about this change.
         */
        $scope.toggleResultStatusGroup = function(group, quiet) {
            var check = function(rs) {
                $scope.resultStatusFilters[rs] = group.allChecked;
            };

            _.each(group.resultStatuses, check);
            thJobFilters.toggleFilters(
                thJobFilters.resultStatus,
                group.resultStatuses,
                group.allChecked
            );

            if (!quiet) {
                $rootScope.$broadcast(thEvents.globalFilterChanged,
                                      {target: group, newValue: group.allChecked});
            }
        };

        /**
         * Handle toggling one of the individual result status filters in
         * the filter panel.
         *
         * @param group
         * @param filter
         */
        $scope.toggleResultStatusFilter = function(group, filter) {
            if (!$scope.resultStatusFilters[filter]) {
                thJobFilters.removeFilter(thJobFilters.resultStatus, filter);
            } else {
                thJobFilters.addFilter(thJobFilters.resultStatus, filter);
            }
            $rootScope.$broadcast(thEvents.globalFilterChanged,
                                  {target: filter, newValue: $scope.resultStatusFilters[filter]});
        };

        /**
         * Toggle the filters to show either unclassified or classified jobs,
         * neither or both.
         */
        $scope.toggleClassificationFilter = function(isClassified) {
            var isChecked = !(isClassified? $scope.classifiedFilter: $scope.unClassifiedFilter);
            $scope.setClassificationFilter(isClassified, isChecked, false);
        };

        /**
         * Toggle the filters to show either unclassified or classified jobs,
         * neither or both.
         * @param isClassified - whether to toggle the filter on/off for
         *                       ``classified`` (when true) or ``unclassified``
         *                       (when false)
         */
        $scope.setClassificationFilter = function(isClassified, isChecked, quiet) {
            var field = "failure_classification_id";
            // this function is called before the checkbox value has actually
            // changed the scope model value, so change to the inverse.
            var func = isChecked? thJobFilters.addFilter: thJobFilters.removeFilter;
            var target = isClassified? "classified": "unclassified";

            func(field, isClassified, thJobFilters.matchType.bool);

            if (!quiet) {
                $rootScope.$broadcast(thEvents.globalFilterChanged,
                                      {target: target, newValue: isChecked});
            }
        };

        $scope.createFieldFilter = function() {
            $scope.newFieldFilter = {field: "", value: ""};
        };
        $scope.cancelFieldFilter = function() {
            $scope.newFieldFilter = null;
        };


        $scope.addFieldFilter = function() {
            $log.debug("adding filter", $scope.newFieldFilter.field);
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

        };

        $scope.removeAllFieldFilters = function() {
            $scope.fieldFilters.forEach(function(ff) {
                thJobFilters.removeFilter(ff.field, ff.value);
            });
            $rootScope.$broadcast(thEvents.globalFilterChanged,
                                  {target: "allFieldFilters", newValue: null});
            $scope.fieldFilters = [];
        };

        $scope.removeFilter = function(index) {
            $log.debug("removing index", index);
            thJobFilters.removeFilter(
                $scope.fieldFilters[index].field,
                $scope.fieldFilters[index].value
            );
            $rootScope.$broadcast(thEvents.globalFilterChanged,
                                  {target: $scope.fieldFilters[index].field, newValue: null});
            $scope.fieldFilters.splice(index, 1);
        };

        $scope.pinAllShownJobs = function() {
            thJobFilters.pinAllShownJobs();
        };

        var updateToggleFilters = function() {
            for (var i = 0; i < $scope.filterOptions.length; i++) {
                var opt = $scope.filterOptions[i];
                $scope.resultStatusFilters[opt] = _.contains(thJobFilters.filters.resultStatus.values, opt);
            }

            // whether or not to show classified jobs
            // these are a special case of filtering because we're not checking
            // for a value, just whether the job has any value set or not.
            // just a boolean check either way
            $scope.classifiedFilter = _.contains(thJobFilters.filters.failure_classification_id.values, true);
            $scope.unClassifiedFilter = _.contains(thJobFilters.filters.failure_classification_id.values, false);

            // update "all checked" boxes for groups
            _.each($scope.filterGroups, function(group) {
                group.allChecked = _.difference(group.resultStatuses, thJobFilters.filters.resultStatus.values).length === 0;
            });
        };

        updateToggleFilters();

        $scope.$on(thEvents.globalFilterChanged, function() {
            updateToggleFilters();
        });

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
            machine_name: {
                name: "machine name",
                matchType: thJobFilters.matchType.substr
            },
            platform: {
                name: "platform",
                matchType: thJobFilters.matchType.substr
            }
        };
    }
]);

treeherder.controller('SearchCtrl', [
    '$scope', '$rootScope', 'thEvents',
    function SearchCtrl($scope, $rootScope, thEvents){

        $rootScope.searchQuery = "";

        $scope.search = function(ev){
            //User hit enter
            if( (ev.keyCode === 13) ||
                ($scope.searchQuery === "") ){

                $rootScope.searchQuery = $scope.searchQuery;

                $rootScope.$broadcast(
                    thEvents.searchPage,
                    {searchQuery: $scope.searchQuery}
                    );
            }
        };

    }
]);
