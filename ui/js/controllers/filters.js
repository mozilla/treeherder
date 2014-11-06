/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

treeherder.controller('FilterPanelCtrl', [
    '$scope', '$rootScope', '$route', '$routeParams', '$location', 'ThLog',
    'localStorageService', 'thResultStatusList', 'thEvents', 'thJobFilters',
    'ThResultSetModel', 'thPinboard', 'thNotify', 'thFailureResults',
    function FilterPanelCtrl(
        $scope, $rootScope, $route, $routeParams, $location, ThLog,
        localStorageService, thResultStatusList, thEvents, thJobFilters,
        ThResultSetModel, thPinboard, thNotify, thFailureResults) {

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

        // field filters
        $scope.newFieldFilter = null;
        $scope.fieldFilters = [];
        $scope.fieldChoices = thJobFilters.fieldChoices;

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

        var getFieldWithPrefix = function(field) {
            return 'field-' + field;
        };

        $scope.addFieldFilter = function(quiet) {
            $log.debug("adding filter", $scope.newFieldFilter.field);

            if (!$scope.newFieldFilter) {
                return;
            }

            var value = $scope.newFieldFilter.value;
            var field = $scope.newFieldFilter.field;
            var fieldWithPrefix = getFieldWithPrefix(field);

            if (field === "" || value === "") {
                return;
            }

            // Add the new filter to the URL query string and rely on it to
            // actually do the filtering.
            var newSearchQuery = $location.search();
            newSearchQuery[fieldWithPrefix] = value;
            $location.search(newSearchQuery);

            // Add the field as a tag on the field filters panel.
            $scope.fieldFilters.push({'field': field, 'value': value});

            // Hide the new field filter form.
            $scope.newFieldFilter = null;
        };

        $scope.removeAllFieldFilters = function() {
            _.each($scope.fieldFilters, function(field) {
                $location.search(getFieldWithPrefix(field), null);
            });
            $scope.fieldFilters = [];
            thJobFilters.removeAllFieldFilters();
        };

        $scope.removeFilter = function(index) {
            $log.debug("removing index", index);

            thJobFilters.removeFilter(
                $scope.fieldFilters[index].field,
                $scope.fieldFilters[index].value
            );
            $scope.fieldFilters.splice(index, 1);
        };

        $scope.pinAllShownJobs = function() {
            if (!thPinboard.spaceRemaining()) {
                thNotify.send("Pinboard is full.  Can not pin any more jobs.",
                    "danger",
                    true);
                return;
            }
            var shownJobs = ThResultSetModel.getAllShownJobs(
                $rootScope.repoName,
                thPinboard.spaceRemaining()
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
                    thJobFilters.filters.resultStatus.values, opt);
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

        $scope.$on(thEvents.globalFilterChanged, function() {
            updateToggleFilters();
            _.each(thJobFilters.filters, function(val, key) {
                if (val.removeWhenEmpty) {
                    _.each(val.values, function(v) {
                        $scope.fieldFilters.push({ field: key, value: v });
                    });
                }
            });
            $scope.fieldFilters = _.uniq($scope.fieldFilters, ['field', 'value']);
            thJobFilters.buildQueryStringFromFilters();
        });
    }
]);

treeherder.controller('SearchCtrl', [
    '$scope', '$rootScope', 'thEvents', 'thJobFilters', '$location',
    function SearchCtrl(
        $scope, $rootScope, thEvents, thJobFilters, $location){

        $scope.$watch(
            function(){
                return thJobFilters.getSearchQuery().searchQueryStr;
            },
            function(searchQueryStr){

                $scope.searchQueryStr = searchQueryStr;

                if($scope.searchQueryStr === ""){

                    $location.search("searchQuery", null);

                    //jobname here is for backwards compatibility with
                    //tbpl url parameters
                    $location.search("jobname", null);

                }else{
                    $location.search("searchQuery", searchQueryStr);

                    //jobname here is for backwards compatibility with
                    //tbpl url parameters
                    $location.search("jobname", null);
                }

                $rootScope.$emit(
                    thEvents.searchPage,
                    { searchQuery: thJobFilters.getSearchQuery() }
                    );
            }
        );

        $scope.search = function(ev){
            //User hit enter
            if( (ev.keyCode === 13) ||
                ($scope.searchQueryStr === "") ){

                thJobFilters.setSearchQuery($scope.searchQueryStr);
            }
        };
    }
]);
