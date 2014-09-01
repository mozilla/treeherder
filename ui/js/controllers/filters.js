"use strict";

treeherder.controller('FilterPanelCtrl', [
    '$scope', '$rootScope', '$route', '$routeParams', '$location', 'ThLog',
    'localStorageService', 'thResultStatusList', 'thEvents', 'thJobFilters',
    'ThResultSetModel', 'thPinboard', 'thNotify',
    function FilterPanelCtrl(
        $scope, $rootScope, $route, $routeParams, $location, ThLog,
        localStorageService, thResultStatusList, thEvents, thJobFilters,
        ThResultSetModel, thPinboard, thNotify) {

        var $log = new ThLog(this.constructor.name);

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
            $log.debug("route updated", $location.search());
            if (!$rootScope.skipNextSearchChangeReload) {
                // when switching repos via the repos panel, you click a link
                // that is a new route.  So it comes here, and we reload
                // the route.  But the filters will be left on in thJobFilters
                // but not in the URL.  So we reset all the filters here.
                // If we wanted to retain the filters (like set to unclassified
                // failures only) then we'd take out the next line and rebuild
                // the url from the filters that are set.  Possibly just with
                // a broadcast of ``globalFilterChanged``.
                thJobFilters.buildFiltersFromQueryString();
                $log.debug("route reloading");
                $route.reload();
            } else {
                $log.debug("route NOT reloading");
            }
            $rootScope.skipNextSearchChangeReload = false;
        });

        $scope.$on(thEvents.globalFilterChanged, function() {
            updateToggleFilters();
            thJobFilters.buildQueryStringFromFilters();
        });

    }
]);

treeherder.controller('SearchCtrl', [
    '$scope', '$rootScope', 'thEvents', '$location',
    function SearchCtrl($scope, $rootScope, thEvents, $location){

        $scope.search = function(ev){

            if($scope.searchQueryStr === ""){
               $rootScope.searchQuery = [];
               $rootScope.searchQueryStr = "";
               $location.search("searchQuery", null);
               $location.search("jobname", null);
            }

            //User hit enter
            if( (ev.keyCode === 13) ||
                ($scope.searchQuery.length === 0) ){

                var queryString = $scope.searchQueryStr.replace(/ +(?= )/g, ' ').toLowerCase();
                $rootScope.searchQuery = queryString.split(' ');

                $rootScope.skipNextSearchChangeReload = true;

                if(queryString === ""){
                    // Remove the parameter from the url if there are no
                    // search terms
                    $location.search("searchQuery", null);
                    $location.search("jobname", null);
                }else{
                    $location.search("searchQuery", queryString);
                    $location.search("jobname", null);
                }

                $rootScope.$broadcast(
                    thEvents.searchPage,
                    {searchQuery: $scope.searchQuery}
                    );
            }
        };

    }
]);
