"use strict";

treeherderApp.controller('FilterPanelCtrl', [
    '$scope', '$rootScope', '$route', '$routeParams', '$location', 'ThLog',
    'thResultStatusList', 'thEvents', 'thJobFilters',
    'ThResultSetStore', 'thPinboard', 'thNotify', 'thFailureResults',
    function FilterPanelCtrl(
        $scope, $rootScope, $route, $routeParams, $location, ThLog,
        thResultStatusList, thEvents, thJobFilters,
        ThResultSetStore, thPinboard, thNotify, thFailureResults) {

        var $log = new ThLog(this.constructor.name);

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
                resultStatuses: ["success", "retry", "usercancel", "coalesced"]
            },
            inProgress: {
                value: "inProgress",
                name: "in progress",
                resultStatuses: ["pending", "running"]
            }
        };

        $scope.resultStatusFilters = {};
        $scope.orderedFilters = _.flatten(_.pluck($scope.filterGroups, "resultStatuses"));

        // field filters
        $scope.newFieldFilter = null;
        $scope.fieldFilters = [];
        $scope.fieldChoices = thJobFilters.getFieldChoices();

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
        };

        /**
         * Handle toggling one of the individual result status filters in
         * the filter panel.
         *
         * @param filter
         */
        $scope.toggleResultStatusFilter = function(filter) {
            if (!$scope.resultStatusFilters[filter]) {
                thJobFilters.removeFilter(thJobFilters.resultStatus, filter);
            } else {
                thJobFilters.addFilter(thJobFilters.resultStatus, filter);
            }
        };

        /**
         * Handle toggling one of the individual result status filter chicklets
         * on the nav bar
         */
        $scope.toggleResultStatusFilterChicklet = function(filter) {
            if ($scope.resultStatusFilters[filter]) {
                $scope.resultStatusFilters[filter] = false;
                thJobFilters.removeFilter(thJobFilters.resultStatus, filter);
            } else {
                $scope.resultStatusFilters[filter] = true;
                thJobFilters.addFilter(thJobFilters.resultStatus, filter);
            }
        };

        /**
         * Toggle the filters to show either unclassified or classified jobs,
         * neither or both.
         */
        $scope.toggleClassifiedFilter = function() {
            var func = $scope.classifiedFilter? thJobFilters.addFilter: thJobFilters.removeFilter;
            func(thJobFilters.classifiedState, 'classified');
        };
        $scope.toggleUnClassifiedFilter = function() {
            var func = $scope.unClassifiedFilter? thJobFilters.addFilter: thJobFilters.removeFilter;
            func(thJobFilters.classifiedState, 'unclassified');
        };

        $scope.createFieldFilter = function() {
            $scope.newFieldFilter = {field: "", value: ""};
        };
        $scope.cancelFieldFilter = function() {
            $scope.newFieldFilter = null;
        };

        // we have to set the field match type here so that the UI can either
        // show a text field for entering a value, or switch to a drop-down select.
        $scope.setFieldMatchType = function() {
            $scope.newFieldFilter.matchType=$scope.fieldChoices[$scope.newFieldFilter.field].matchType;
            $scope.newFieldFilter.choices=$scope.fieldChoices[$scope.newFieldFilter.field].choices;

        };

        // for most match types we want to show just the raw value.  But for
        // choice value type, we want to show the string representation of the
        // value.  For example, failure_classification_id is an int, but we
        // want to show the text.
        $scope.getFilterValue = function(field, value) {
            if ($scope.fieldChoices[field].matchType === 'choice') {
                return $scope.fieldChoices[field].choices[value].name;
            }
            return value;
        };

        var updateFieldFilterChicklets = function() {
            $scope.fieldFilters = thJobFilters.getFieldFiltersArray();
        };

        $scope.addFieldFilter = function() {
            $log.debug("adding filter", $scope.newFieldFilter.field);

            if (!$scope.newFieldFilter) {
                return;
            }

            var value = $scope.newFieldFilter.value;
            var field = $scope.newFieldFilter.field;

            if (field === "" || value === "") {
                return;
            }

            thJobFilters.addFilter(field, value);

            // Hide the new field filter form.
            $scope.newFieldFilter = null;
            updateFieldFilterChicklets();
        };

        $scope.removeAllFieldFilters = function() {
            $scope.fieldFilters = [];
            thJobFilters.removeAllFieldFilters();
        };

        $scope.removeFilter = function(index) {
            $log.debug("removing index", index,
                       $scope.fieldFilters[index].field,
                       $scope.fieldFilters[index].value);

            thJobFilters.removeFilter(
                $scope.fieldFilters[index].field,
                $scope.fieldFilters[index].value
            );
        };

        $scope.pinAllShownJobs = function() {
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

        var updateToggleFilters = function() {
            for (var i = 0; i < $scope.filterOptions.length; i++) {
                var opt = $scope.filterOptions[i];
                $scope.resultStatusFilters[opt] = _.contains(
                    thJobFilters.getResultStatusArray(), opt);
            }

            // whether or not to show classified jobs
            // these are a special case of filtering because we're not checking
            // for a value, just whether the job has any value set or not.
            // just a boolean check either way
            var classifiedState = thJobFilters.getClassifiedStateArray();
            $scope.classifiedFilter = _.contains(classifiedState, 'classified');
            $scope.unClassifiedFilter = _.contains(classifiedState, 'unclassified');

            // update "all checked" boxes for groups
            _.each($scope.filterGroups, function(group) {
                group.allChecked = _.difference(group.resultStatuses, thJobFilters.getResultStatusArray()).length === 0;
            });
        };

        updateToggleFilters();
        updateFieldFilterChicklets();

        $rootScope.$on(thEvents.globalFilterChanged, function() {
            updateToggleFilters();
            updateFieldFilterChicklets();
        });
    }
]);

treeherderApp.controller('SearchCtrl', [
    '$scope', '$rootScope', 'thEvents', 'thJobFilters', '$location',
    function SearchCtrl(
        $scope, $rootScope, thEvents, thJobFilters, $location){

        var getSearchStr = function() {
            var ss = thJobFilters.getFieldFiltersObj().searchStr;
            if (ss) {
                return ss.join(" ");
            } else {
                return "";
            }
        };

        $scope.searchQueryStr = getSearchStr();
        $rootScope.$on(thEvents.globalFilterChanged, function() {
            $scope.searchQueryStr = getSearchStr();
        });

        $scope.search = function(ev){
            //User hit enter
            if (ev.keyCode === 13) {
                var filterVal = $scope.searchQueryStr === ""? null: $scope.searchQueryStr;
                thJobFilters.replaceFilter("searchStr", filterVal);
                $rootScope.$broadcast('blur-this', "quick-filter");
            }
        };
    }
]);
