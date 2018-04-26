import treeherderApp from '../treeherder_app';
import { thFailureResults, thAllResultStates, thEvents } from "../constants";

treeherderApp.controller('JobFilterCtrl', [
    '$scope', '$rootScope', 'thJobFilters',
    function JobFilterCtrl($scope, $rootScope, thJobFilters) {

        $scope.filterOptions = thAllResultStates;

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
        // flatten filter groups
        $scope.filterChicklets =
          ["failures", $scope.filterGroups.nonfailures.resultStatuses, "in progress"].reduce(
            (acc, val) => acc.concat(val), []);

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
            if (Object.keys($scope.filterGroups).indexOf(filter) !== -1) {
                return $scope.filterGroups[filter].resultStatuses.map(val =>
                  $scope.resultStatusFilters[val]).some(val => val);
            }
            return $scope.resultStatusFilters[filter];
        };

        /**
         * Handle toggling one of the individual result status filter chicklets
         * on the nav bar
         */
        $scope.toggleResultStatusFilterChicklet = function (filter) {
            let filterValues;
            if (Object.keys($scope.filterGroups).indexOf(filter) !== -1) {
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
            const func = $scope.classifiedFilter ? thJobFilters.removeFilter : thJobFilters.addFilter;
            func(thJobFilters.classifiedState, 'classified');
        };

        $scope.toggleUnClassifiedFilter = function () {
            const func = $scope.unClassifiedFilter ? thJobFilters.removeFilter : thJobFilters.addFilter;
            func(thJobFilters.classifiedState, 'unclassified');
        };

        $scope.thJobFilters = thJobFilters;

        const updateToggleFilters = function () {
            for (let i = 0; i < $scope.filterOptions.length; i++) {
                const opt = $scope.filterOptions[i];
                $scope.resultStatusFilters[opt] = thJobFilters.getResultStatusArray().indexOf(opt) !== -1;
            }

            // whether or not to show classified jobs
            // these are a special case of filtering because we're not checking
            // for a value, just whether the job has any value set or not.
            // just a boolean check either way
            const classifiedState = thJobFilters.getClassifiedStateArray();
            $scope.classifiedFilter = classifiedState.indexOf('classified') !== -1;
            $scope.unClassifiedFilter = classifiedState.indexOf('unclassified') !== -1;
        };

        updateToggleFilters();

        $rootScope.$on(thEvents.globalFilterChanged, function () {
            updateToggleFilters();
        });
    }
]);

treeherderApp.controller('SearchCtrl', [
    '$scope', '$rootScope', 'thJobFilters',
    function SearchCtrl(
        $scope, $rootScope, thJobFilters) {

        const getSearchStr = function () {
            const ss = thJobFilters.getFieldFiltersObj().searchStr;
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
                const filterVal = $scope.searchQueryStr === ""? null: $scope.searchQueryStr;
                thJobFilters.replaceFilter("searchStr", filterVal);
                $rootScope.$broadcast('blur-this', "quick-filter");
            }
        };
    }
]);
