"use strict";

treeherder.controller('FilterPanelCtrl',
    function FilterPanelCtrl($scope, $rootScope, $routeParams, $location, ThLog,
                             localStorageService, thResultStatusList, thEvents,
                             thJobFilters) {
        var thLog = new ThLog(this.constructor.name);

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

        $rootScope.$on(thEvents.showUnclassifiedFailures, function() {
            $scope.showUnclassifiedFailures();
        });

        /**
         * Handle clicking the ``unclassified failures`` button.
         */
        $scope.showUnclassifiedFailures = function() {
            $scope.filterGroups.failures.allChecked = true;
            $scope.filterGroups.nonfailures.allChecked = false;
            $scope.filterGroups.inProgress.allChecked = false;
            $scope.classifiedFilter = false;
            $scope.unClassifiedFilter = true;

            $scope.toggleResultStatusGroup($scope.filterGroups.failures, true);
            $scope.toggleResultStatusGroup($scope.filterGroups.nonfailures, true);
            $scope.toggleResultStatusGroup($scope.filterGroups.inProgress, true);

            $scope.setClassificationFilter(true, $scope.classifiedFilter, true);
            $scope.setClassificationFilter(false, $scope.unClassifiedFilter, true);

            $rootScope.$broadcast(thEvents.globalFilterChanged);
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
                group.allChecked = false;
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
            thLog.debug("adding filter", $scope.newFieldFilter.field);
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
            thLog.debug("removing index", index);
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
);

treeherder.controller('SearchCtrl',
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
);
