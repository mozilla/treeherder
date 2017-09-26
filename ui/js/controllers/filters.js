"use strict";

treeherderApp.controller('FilterPanelCtrl', [
    '$scope', '$rootScope', '$route', '$routeParams', '$location', 'ThLog',
    'thResultStatusList', 'thEvents', 'thJobFilters',
    'ThResultSetStore', 'thPinboard', 'thNotify', 'thFailureResults',
    function FilterPanelCtrl(
        $scope, $rootScope, $route, $routeParams, $location, ThLog,
        thResultStatusList, thEvents, thJobFilters,
        ThResultSetStore, thPinboard, thNotify, thFailureResults) {

        $scope.filterOptions = thResultStatusList.all();

        $scope.filterGroups = {
            failures: {
                value: "failures",
                name: "failures",
                resultStatuses: thFailureResults.slice()
            },
            nonfailures: {
                value: "nonfailures",
                name: "non-failures",
                resultStatuses: ["success", "retry", "usercancel", "superseded"]
            },
            "in progress": {
                value: "in progress",
                name: "in progress",
                resultStatuses: ["pending", "running"]
            }
        };

        $scope.resultStatusFilters = {};
        $scope.filterChicklets = _.flatten([
            "failures",
            $scope.filterGroups.nonfailures.resultStatuses,
            "in progress"
        ]);

        /**
         * Handle checking the "all" button for a result status group
         */
        $scope.toggleResultStatusGroup = function (group) {
            var check = function (rs) {
                $scope.resultStatusFilters[rs] = group.allChecked;
            };

            _.each(group.resultStatuses, check);
            thJobFilters.toggleFilters(
                thJobFilters.resultStatus,
                group.resultStatuses,
                group.allChecked
            );
        };

        /**
         * Handle toggling one of the individual result status filters in
         * the filter panel.
         *
         * @param filter
         */
        $scope.toggleResultStatusFilter = function (filter) {
            if (!$scope.resultStatusFilters[filter]) {
                thJobFilters.removeFilter(thJobFilters.resultStatus, filter);
            } else {
                thJobFilters.addFilter(thJobFilters.resultStatus, filter);
            }
        };

        $scope.isFilterOn = function (filter) {
            if (_.includes(_.keys($scope.filterGroups), filter)) {
                // this is a filter grouping, so toggle all on/off
                return _.some(
                    _.at($scope.resultStatusFilters,
                    $scope.filterGroups[filter].resultStatuses)
                );
            }
            return $scope.resultStatusFilters[filter];
        };

        /**
         * Handle toggling one of the individual result status filter chicklets
         * on the nav bar
         */
        $scope.toggleResultStatusFilterChicklet = function (filter) {
            var filterValues;
            if (_.includes(_.keys($scope.filterGroups), filter)) {
                // this is a filter grouping, so toggle all on/off
                filterValues = $scope.filterGroups[filter].resultStatuses;
            } else {
                filterValues = [filter];
            }
            thJobFilters.toggleResultStatuses(filterValues);
        };

        /**
         * Toggle the filters to show either unclassified or classified jobs,
         * neither or both.
         */
        $scope.toggleClassifiedFilter = function () {
            var func = $scope.classifiedFilter? thJobFilters.addFilter: thJobFilters.removeFilter;
            func(thJobFilters.classifiedState, 'classified');
        };
        $scope.toggleUnClassifiedFilter = function () {
            var func = $scope.unClassifiedFilter? thJobFilters.addFilter: thJobFilters.removeFilter;
            func(thJobFilters.classifiedState, 'unclassified');
        };

        $scope.pinAllShownJobs = function () {
            if (!thPinboard.spaceRemaining()) {
                thNotify.send("Pinboard is full.  Can not pin any more jobs.",
                    "danger",
                    true);
                return;
            }
            var shownJobs = ThResultSetStore.getAllShownJobs(
                $rootScope.repoName,
                thPinboard.spaceRemaining(),
                thPinboard.maxNumPinned
            );
            thPinboard.pinJobs(shownJobs);

            if (!$rootScope.selectedJob) {
                $rootScope.selectedJob = shownJobs[0];
            }
        };

        $scope.thJobFilters = thJobFilters;

        var updateToggleFilters = function () {
            for (var i = 0; i < $scope.filterOptions.length; i++) {
                var opt = $scope.filterOptions[i];
                $scope.resultStatusFilters[opt] = _.includes(
                    thJobFilters.getResultStatusArray(), opt);
            }

            // whether or not to show classified jobs
            // these are a special case of filtering because we're not checking
            // for a value, just whether the job has any value set or not.
            // just a boolean check either way
            var classifiedState = thJobFilters.getClassifiedStateArray();
            $scope.classifiedFilter = _.includes(classifiedState, 'classified');
            $scope.unClassifiedFilter = _.includes(classifiedState, 'unclassified');

            // update "all checked" boxes for groups
            _.each($scope.filterGroups, function (group) {
                group.allChecked = _.difference(group.resultStatuses, thJobFilters.getResultStatusArray()).length === 0;
            });
        };

        updateToggleFilters();

        $rootScope.$on(thEvents.globalFilterChanged, function () {
            updateToggleFilters();
        });
    }
]);

treeherderApp.controller('SearchCtrl', [
    '$scope', '$rootScope', 'thEvents', 'thJobFilters',
    function SearchCtrl(
        $scope, $rootScope, thEvents, thJobFilters) {

        var getSearchStr = function () {
            var ss = thJobFilters.getFieldFiltersObj().searchStr;
            if (ss) {
                return ss.join(" ");
            }
            return "";
        };

        $scope.searchQueryStr = getSearchStr();
        $rootScope.$on(thEvents.globalFilterChanged, function () {
            $scope.searchQueryStr = getSearchStr();
        });

        $scope.search = function (ev) {
            //User hit enter
            if (ev.keyCode === 13) {
                var filterVal = $scope.searchQueryStr === ""? null: $scope.searchQueryStr;
                thJobFilters.replaceFilter("searchStr", filterVal);
                $rootScope.$broadcast('blur-this', "quick-filter");
            }
        };
    }
]);
