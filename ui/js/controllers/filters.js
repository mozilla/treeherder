"use strict";

treeherder.controller('FilterPanelCtrl', [
    '$scope', '$rootScope', '$route', '$routeParams', '$location', 'ThLog',
    'localStorageService', 'thResultStatusList', 'thEvents', 'thJobFilters',
    'thClassificationTypes',
    function FilterPanelCtrl(
        $scope, $rootScope, $route, $routeParams, $location, ThLog,
        localStorageService, thResultStatusList, thEvents, thJobFilters,
        thClassificationTypes) {

        var $log = new ThLog(this.constructor.name);
        var filterPrefix = "field-";
        var filterPrefixLen = filterPrefix.length;


        $scope.filterOptions = thResultStatusList.all();

        $scope.filterGroups = {
            failures: {
                value: "failures",
                name: "failures",
                resultStatuses: ["testfailed", "busted", "exception"]
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
            },
            failure_classification_id: {
                name: "failure classification",
                matchType: thJobFilters.matchType.choice,
                choices: thClassificationTypes.classifications
            }
        };

        /**
         * Handle checking the "all" button for a result status group
         *
         * quiet - whether or not to broadcast a message about this change.
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
         * @param group
         * @param filter
         */
        $scope.toggleResultStatusFilter = function(group, filter) {
            if (!$scope.resultStatusFilters[filter]) {
                thJobFilters.removeFilter(thJobFilters.resultStatus, filter);
            } else {
                thJobFilters.addFilter(thJobFilters.resultStatus, filter);
            }
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
        $scope.setClassificationFilter = function(isClassified, isChecked) {
            var field = "isClassified";
            // this function is called before the checkbox value has actually
            // changed the scope model value, so change to the inverse.
            var func = isChecked? thJobFilters.addFilter: thJobFilters.removeFilter;
            var target = isClassified? "classified": "unclassified";

            func(field, isClassified, thJobFilters.matchType.bool);
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

        $scope.addFieldFilter = function(quiet) {
            $log.debug("adding filter", $scope.newFieldFilter.field);
            var value = $scope.newFieldFilter.value;

            if (!$scope.newFieldFilter || $scope.newFieldFilter.field === "" || value === "") {
                return;
            }
            thJobFilters.addFilter(
                $scope.newFieldFilter.field,
                value,
                $scope.fieldChoices[$scope.newFieldFilter.field].matchType,
                quiet
            );
            $scope.fieldFilters.push({
                field: $scope.newFieldFilter.field,
                value: value
            });
            $scope.newFieldFilter = null;

        };

        $scope.removeAllFieldFilters = function() {
            $scope.fieldFilters = [];
            thJobFilters.removeAllFilters();
        };

        $scope.removeFilter = function(index) {
            $log.debug("removing index", index);

            thJobFilters.removeFilter(
                $scope.fieldFilters[index].field,
                $scope.fieldFilters[index].value
            );
            $scope.fieldFilters.splice(index, 1);
        };

        $scope.thJobFilters = thJobFilters;

        var updateToggleFilters = function() {
            for (var i = 0; i < $scope.filterOptions.length; i++) {
                var opt = $scope.filterOptions[i];
                $scope.resultStatusFilters[opt] = _.contains(thJobFilters.filters.resultStatus.values, opt);
            }

            // whether or not to show classified jobs
            // these are a special case of filtering because we're not checking
            // for a value, just whether the job has any value set or not.
            // just a boolean check either way
            $scope.classifiedFilter = _.contains(thJobFilters.filters.isClassified.values, true);
            $scope.unClassifiedFilter = _.contains(thJobFilters.filters.isClassified.values, false);

            // update "all checked" boxes for groups
            _.each($scope.filterGroups, function(group) {
                group.allChecked = _.difference(group.resultStatuses, thJobFilters.filters.resultStatus.values).length === 0;
            });
        };

        updateToggleFilters();

        /*
         * We need to prevent reloading the route under certain conditions.
         * Like when we change the filter params on the url.  So we have set
         * the route to skip ``reloadOnSearch`` changes.  We can't simply
         * turn it to skip before the ``$location.search("key", val)`` call
         * and then turn it back to not skip after the call because the event
         * chain that happens with changing the location and the ``$routeUpdate``
         * won't have happened until after we have turned off the skipping.
         * Thereby it will never skip, and always reload the route.
         *
         * So what we must do is tell it to skip the "next" one before each
         * search change and then when it's skipped, it will turn skipping back
         * off each time.
         */
        $rootScope.skipNextSearchChangeReload = false;
        $scope.$on('$routeUpdate', function(){
            if (!$rootScope.skipNextSearchChangeReload) {
                $route.reload();
            } else {
                $rootScope.skipNextSearchChangeReload = false;
            }
        });

        var updateSearchWithoutReload = function(key, values) {
            $rootScope.skipNextSearchChangeReload = true;
            $location.search(key, values);
        };

        $scope.$on(thEvents.globalFilterChanged, function() {
            updateToggleFilters();

            // update the url search params accordingly
            $location.search("isClassified", null);
            $location.search("resultStatus", null);
            $location.search("searchQuery", null);
            // remove any field filters
            _.each($location.search(), function(filterVal, filterKey) {
                if (filterKey.slice(0, filterPrefixLen) === filterPrefix) {
                    $rootScope.skipNextSearchChangeReload = true;
                    $location.search(filterKey, null);
                }
            });

            _.each(thJobFilters.filters, function(val, key) {
                var values = _.uniq(val.values);
                if (key === "resultStatus" || key === "isClassified") {
                    // don't add to query string if it matches the defaults
                    $log.debug("set query string checks", key, values);
                    if (!thJobFilters.matchesDefaults(key, values)) {
                        if (key === "isClassified") {
                            values = _.map(values, function(item) {return item.toString();});
                        }
                        $log.debug("not defaults, setting check query strings", key, values);
                        updateSearchWithoutReload(key, values);
                    }

                } else {
                    $log.debug("setting field query strings", key, values);
                    updateSearchWithoutReload(filterPrefix + key, values);
                }
            });

            if ($rootScope.searchQuery && typeof $rootScope.searchQuery === 'string'){
                updateSearchWithoutReload("searchQuery", $rootScope.searchQuery);
            }

        });

        /**
         * When the page first loads, check the query string params for
         * filters and apply them.
         */
        var loadFiltersFromQueryString = function() {
            // field filters
            var search = _.clone($location.search());
            $log.debug("query string params", $location.search());

            _.each(search, function (filterVal, filterKey) {
                $log.debug("field filter", filterKey, filterVal);
                if (filterKey.slice(0, filterPrefixLen) === filterPrefix) {
                    $log.debug("adding field filter", filterKey, filterVal);
                    $scope.newFieldFilter = {
                        field: filterKey.slice(filterPrefixLen),
                        value: filterVal

                    };
                    $scope.addFieldFilter(true);

                } else if (filterKey === "resultStatus" || filterKey === "isClassified") {
                    $log.debug("adding check filter", filterKey, filterVal);
                    if (!_.isArray(filterVal)) {
                        filterVal = [filterVal];
                    }
                    // these will come through as strings, so convert to actual booleans
                    if (filterKey === "isClassified") {
                        filterVal = _.map(filterVal, function(item) {return item !== "false";});
                    }
                    thJobFilters.setCheckFilterValues(filterKey, _.uniq(filterVal), true);
                } else if (filterKey === "searchQuery") {
                    filterVal = _.isArray(filterVal)? filterVal[0]: filterVal;
                    $log.debug("searchQuery added", filterVal);
                    $rootScope.searchQuery = filterVal;
                }
            });
            $log.debug("done with loadFiltersFromQueryString", thJobFilters.filters);
            $rootScope.$broadcast(thEvents.globalFilterChanged);

        };

        loadFiltersFromQueryString();

    }
]);

treeherder.controller('SearchCtrl', [
    '$scope', '$rootScope', 'thEvents', '$location',
    function SearchCtrl($scope, $rootScope, thEvents, $location){

        $rootScope.searchQuery = "";

        $scope.search = function(ev){
            //User hit enter
            if( (ev.keyCode === 13) ||
                ($scope.searchQuery === "") ){

                $rootScope.searchQuery = $scope.searchQuery;

                var queryString = $rootScope.searchQuery? $rootScope.searchQuery: null;

                $rootScope.skipNextSearchChangeReload = true;
                $location.search("searchQuery", queryString);

                $rootScope.$broadcast(
                    thEvents.searchPage,
                    {searchQuery: $scope.searchQuery}
                    );
            }
        };

    }
]);
