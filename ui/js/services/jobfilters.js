'use strict';

/**
  This service handles whether or not a job, job group or platform row should
  be displayed based on the filter settings.

  Global filter settings are stored and updated here.  But this also provides
  helper methods for individual resultsets.
*/


/**
 * Filters can be specific to the resultStatus.  But we can also have filters
 * for things like slavename, job type, job group, platform, etc.  This allows
 *
 * rules:
 * ======
 * If a field is in ``filters`` then the item must match at least one of the
 * ``values.``.  Values within a field are OR'ed.
 *
 * Each field is AND'ed so that, if a field exists in ``filters`` then the job
 * must match at least one value in every field.
 */
treeherder.factory('thJobFilters', [
    'thResultStatusList', 'ThLog', '$rootScope', '$location',
    'thNotify', 'thEvents', 'thFailureResults',
    'thResultStatus', 'thClassificationTypes', 'ThRepositoryModel',
    'thPlatformNameMap',
    function(
        thResultStatusList, ThLog, $rootScope, $location,
        thNotify, thEvents, thFailureResults,
        thResultStatus, thClassificationTypes, ThRepositoryModel,
        thPlatformNameMap) {

    var $log = new ThLog("thJobFilters");

    var matchType = {
        exactstr: 'exactstr',
        substr: 'substr',
        isnull: 'isnull',
        bool: 'bool',
        choice: 'choice'
    };

    var searchQuery = [];
    var searchQueryStr = "";

    var fieldChoices = {
        ref_data_name: {
            name: "buildername/jobname",
            matchType: matchType.substr
        },
        job_type_name: {
            name: "job name",
            matchType: matchType.substr
        },
        job_type_symbol: {
            name: "job symbol",
            matchType: matchType.exactstr
        },
        job_group_name: {
            name: "group name",
            matchType: matchType.substr
        },
        job_group_symbol: {
            name: "group symbol",
            matchType: matchType.exactstr
        },
        machine_name: {
            name: "machine name",
            matchType: matchType.substr
        },
        platform: {
            name: "platform",
            matchType: matchType.substr
        },
        failure_classification_id: {
            name: "failure classification",
            matchType: matchType.choice,
            choices: thClassificationTypes.classifications
        }
    };

    // default filter values
    var defaults = {
        resultStatus: {
            values: thResultStatusList.defaultFilters()
        },
        isClassified: {
            values: [true, false]
        }
    };

    // filters
    var filters = {
        resultStatus: {
            matchType: matchType.exactstr,
            values: thResultStatusList.defaultFilters(),
            removeWhenEmpty: false
        },
        isClassified: {
            matchType: matchType.bool,
            values: defaults.isClassified.values.slice(),
            removeWhenEmpty: false
        }
    };

    var filterKeys = _.keys(filters);

    var activeExclusionProfile = {};

    // whether or not to skip the checks for the exclusion profiles.
    // an exclusion profile may be enabled, but this allows the user
    // to toggle it on or off.
    var skipExclusionProfiles = false;

    // when setting to ``unclassified`` failures only, we stash any status
    // filters you had before so that when you untoggle from them, you get
    // back to where you were
    var stashedStatusFilterValues = {};

    var urlFilterPrefix = "field-";
    var urlFilterPrefixLen = urlFilterPrefix.length;

    // This object will look like:
    //
    //        {
    //            resultset_id1: {
    //                counts: {
    //                    "success": 4,
    //                    "testfailed": 6,
    //                    "total": 10
    //                    ...
    //                },
    //                jobs: {
    //                    job_guid1: "success",
    //                    job_guid2: "testfailure",
    //                    ...
    //                }
    //            },
    //            resultset_id2: ...
    //        }
    var excludedJobs = {};
    var excludedUnclassifiedFailures = {};

    /**
     * If a custom resultStatusList is passed in (like for individual
     * resultSets, then use that.  Otherwise, fall back to the global one.
     *
     * if the filter value is just ``true`` or ``false`` then simply check
     * whether or not the field of ``job`` has a value set or not.  ``true``
     * means it must have a value set, ``false`` means it must be null.
     */
    var checkFilter = function(field, job, resultStatusList) {

        if (field === api.resultStatus) {
            // resultStatus is a special case that spans two job fields
            var filterList = resultStatusList || filters[field].values;
            var resultState = thResultStatus(job);
            return _.contains(filterList, resultState);
        } else if (field === api.isClassified) {
            // isClassified is a special case, too.  Where value of 1 in the
            // job field of ``failure_classification_id`` is "not classified"
            var fci_filters = filters[field].values;
            if (_.contains(fci_filters, false) && (job.failure_classification_id === 1 ||
                                                   job.failure_classification_id === null)) {
                return true;
            }
            return _.contains(fci_filters, true) && job.failure_classification_id > 1;
        } else {
            var jobFieldValue = getJobFieldValue(job, field);
            if (_.isUndefined(jobFieldValue)) {
                // if a filter is added somehow, but the job object doesn't
                // have that field, then don't filter.  Consider it a pass.
                return true;
            }

            switch (filters[field].matchType) {
                case api.matchType.isnull:
                    jobFieldValue = !_.isNull(jobFieldValue);
                    return _.contains(filters[field].values, jobFieldValue);

                case api.matchType.substr:

                    return containsSubstr(filters[field].values, jobFieldValue.toLowerCase());

                case api.matchType.exactstr:
                    return _.contains(filters[field].values, jobFieldValue.toLowerCase());

                case api.matchType.choice:
                    return _.contains(filters[field].values, String(jobFieldValue).toLowerCase());

            }
        }
    };

    /**
     * Get the field from the job.  In most cases, this is very simple.  But
     * this function allows for some special cases, like ``platform`` which
     * shows to the user as a different string than what is stored in the job
     * object.
     *
     * @param job
     * @param field
     */
    var getJobFieldValue = function(job, field) {
        var result = job[field];
        if (field === 'platform') {
            var platform = thPlatformNameMap[result];
            if (!platform) {
                // if it's not found, then return
                // the original string
                platform = result;
            }
            result = platform + " " + job.platform_option;
        }
        return result;
    };

    /**
     * Check the array if any elements contain a match for the ``val`` as a
     * substring.
     * @param arr
     * @param val
     */
    var containsSubstr = function(arr, val) {
        for (var i = 0; i < arr.length; i++) {
            if (val.indexOf(arr[i]) >= 0) {
                return true;
            }
        }
        return false;
    };

    /**
     * Add a case-insensitive filter.
     * @param field - the field in the job objec to check
     * @param value - the value to match
     * @param matchType - which type of filter to use.  Default: ``exactstr``
     *                    If the filter field already exists, update the
     *                    ``matchType`` to this value.
     */
    var addFilter = function(field, value, matchType, quiet) {

        if (_.isUndefined(matchType)) {
            matchType = api.matchType.exactstr;
        }
        // always store in lower case so that comparisons are case insensitive
        if (_.isString(value)) {
            // the string types are case insensitive
            value = value.toLowerCase();
        }
        if (filters.hasOwnProperty(field)) {
            if (!_.contains(filters[field].values, value)) {
                filters[field].values.push(value);
                filters[field].matchType = matchType;
            }
        } else {
            filters[field] = {
                values: [value],
                matchType: matchType,
                removeWhenEmpty: true
            };
        }

        filterKeys = _.keys(filters);
        $log.debug("added ", field, ": ", value);
        $log.debug("filters", filters, "filterkeys", filterKeys);
        if (!quiet) {
            $rootScope.$broadcast(thEvents.globalFilterChanged);
        }
    };

    var removeFilter = function(field, value) {
        if (filters.hasOwnProperty(field)) {
            if (_.isString(value)) {
                // the string types are case insensitive
                value = value.toLowerCase();
            }
            var idx = filters[field].values.indexOf(value);
            if(idx > -1) {
                $log.debug("removing ", value);
                filters[field].values.splice(idx, 1);

                // if this filer no longer has any values, then remove it
                // unless it has the ``allowEmpty`` setting
                if (filters[field].removeWhenEmpty && filters[field].values.length === 0) {
                    delete filters[field];
                }
                filterKeys = _.keys(filters);
                $rootScope.$broadcast(thEvents.globalFilterChanged);
            }
        }

        $log.debug("filters", filters);
    };

    var removeAllFieldFilters = function() {
        var someRemoved = false;
        $log.debug("removeAllFilters", filters, filterKeys);
        var removeAll = function(field) {
            $log.debug("removeAllFilters", field, filters);
            if (!_.contains(['resultStatus', 'isClassified'], field)) {
                filters[field].values = [];
                someRemoved = true;
                $log.debug("removeAllFilters", "removed", field, filters);
            }

            // if this filer no longer has any values, then remove it
            // if it has the ``removeWhenEmpty`` setting
            if (filters[field].removeWhenEmpty) {
                delete filters[field];
            }
        };

        _.forEach(filterKeys, removeAll);

        filterKeys = _.keys(filters);
        $log.debug("filters", filters);

        if (someRemoved) {
            $rootScope.$broadcast(thEvents.globalFilterChanged);
        }
    };

    /**
     * used mostly for resultStatus doing group toggles
     *
     * @param field
     * @param values - an array of values for the field
     * @param add - true if adding, false if removing
     */
    var toggleFilters = function(field, values, add) {
        $log.debug("toggling to ", add);
        var action = add? api.addFilter: api.removeFilter;
        for (var i = 0; i < values.length; i++) {
            action(field, values[i]);
        }
        $rootScope.$broadcast(thEvents.globalFilterChanged);
    };

    var copyResultStatusFilters = function() {
        return filters[api.resultStatus].values.slice();
    };

    /**
     * Whether or not this job should be shown based on the current
     * filters.
     *
     * @param job - the job we are checking against the filter
     * @param resultStatusList - optional.  custom list of resultstatuses
     *        that can be used for individual resultsets
     */
    var showJob = function(job, resultStatusList) {

        for(var i = 0; i < filterKeys.length; i++) {
            if (!checkFilter(filterKeys[i], job, resultStatusList)) {
                return false;
            }
        }

        var matchTargetCount = searchQuery.length;

        if( matchTargetCount > 0 ){

            var searchableStrLc = job.searchableStr.toLowerCase();
            var matches = 0;
            var j = 0;

            for(; j<matchTargetCount; j++){
                if(searchableStrLc.indexOf(searchQuery[j]) !== -1){
                    matches++;
                }
            }
            if(matches !== matchTargetCount){
                return false;
            }
        }
        if(activeExclusionProfile && !skipExclusionProfiles) {
            try{
                var jobPlatformArch = getJobComboField(
                    job.platform, job.machine_platform_architecture);
                var jobNameSymbol = getJobComboField(
                    job.job_type_name, job.job_type_symbol);

                if(activeExclusionProfile.flat_exclusion[$rootScope.repoName]
                    [jobPlatformArch][jobNameSymbol][job.platform_option]){
                    addExcludedJob(job);
                    return false;
                }
            }catch (e){
                //do nothing
            }
            removeExcludedJob(job);
        } else {
            removeExcludedJob(job);
        }
        return true;
    };

    /**
     * When a job is excluded, we add it to the ``excludedJobs`` object which
     * keeps track of the counts of resultStatus values during exclusion.
     * These values can then be used to modify the displayed counts per
     * ``resultStatus`` in that directive if exclusion is enabled.
     * @param job
     */
    var addExcludedJob = function(job) {
        var newStatus = thResultStatus(job);
        if (!_.has(excludedJobs, job.result_set_id)) {
            excludedJobs[job.result_set_id] = {
                counts: {},
                jobs: {}
            };
        }
        var rs_excluded = excludedJobs[job.result_set_id];

        if (_.has(rs_excluded.jobs, job.job_guid)) {
            //we already have this in the map, but the status may be different
            //so remove the old count value so we can add the new one
            var oldStatus = rs_excluded.jobs[job.job_guid];
            --rs_excluded.counts[oldStatus];
        }

        if (isJobUnclassifiedFailure(job)) {
            excludedUnclassifiedFailures[job.job_guid] = job;
        }

        // now we can do the increment, because we've decremented the old count
        // if one was there.
        rs_excluded.jobs[job.job_guid] = newStatus;
        rs_excluded.counts[newStatus] = rs_excluded.counts[newStatus] || 0;
        ++rs_excluded.counts[newStatus];
        rs_excluded.counts.total = _.size(rs_excluded.jobs);
    };

    /**
     * If an exclusion profile is changed, we need to modify the count
     * excluded.
     * @param job
     */
    var removeExcludedJob = function(job) {
        if (_.has(excludedJobs, job.result_set_id)) {
            var rs_excluded = excludedJobs[job.result_set_id];

            if (_.has(rs_excluded.jobs, job.job_guid)) {

                var status = rs_excluded.jobs[job.job_guid];
                delete rs_excluded.jobs[job.job_guid];
                --rs_excluded.counts[status];
                rs_excluded.counts.total = _.size(rs_excluded.jobs);
            }
        }

        delete excludedUnclassifiedFailures[job.job_guid];
    };

    /**
     * Get the count of this resultStatus that were excluded.  If
     * skipping exclusion, then return 0.
     * @param resultStatus
     */
    var getCountExcluded = function(resultset_id, resultStatus) {
        if (skipExclusionProfiles) {
            return 0;
        } else {
            if (_.has(excludedJobs, resultset_id)) {
                return excludedJobs[resultset_id].counts[resultStatus] || 0;
            }
            return 0;
        }
    };

    var getCountExcludedForRepo = function(repoName) {
        var repoData = ThRepositoryModel.watchedRepos[repoName];

        if (repoData) {
            if (skipExclusionProfiles) {
                return repoData.unclassifiedFailureCount;
            } else {
                return repoData.unclassifiedFailureCount - repoData.unclassifiedFailureCountExcluded;
            }
        }
        return 0;
    };

    $rootScope.$on(thEvents.showUnclassifiedFailures, function() {
        showUnclassifiedFailures();
    });

    /**
     * Set the non-field filters so that we only view unclassified failures
     */
    var showUnclassifiedFailures = function() {
        stashedStatusFilterValues = {
            resultStatus: filters.resultStatus.values,
            isClassified: filters.isClassified.values
        };
        filters.resultStatus.values = thFailureResults.slice();
        filters.isClassified.values = [false];
        $rootScope.$broadcast(thEvents.globalFilterChanged);
    };

    /**
     * Set the non-field filters so that we only view coalesced jobs
     */
    var showCoalesced = function() {
        stashedStatusFilterValues = {
            resultStatus: filters.resultStatus.values,
            isClassified: filters.isClassified.values
        };
        filters.resultStatus.values = ["coalesced"];
        filters.isClassified.values = [false, true];
        $rootScope.$broadcast(thEvents.globalFilterChanged);
    };

    var toggleInProgress = function() {
        var func = addFilter;
        if (_.difference(['pending', 'running'], filters.resultStatus.values).length === 0) {
            func = removeFilter;
        }
        func(api.resultStatus, 'pending');
        func(api.resultStatus, 'running');
        $rootScope.$broadcast(thEvents.globalFilterChanged);
    };

    var isJobUnclassifiedFailure = function(job) {
        return (_.contains(thFailureResults, job.result) &&
            job.failure_classification_id === 1);
    };

    /**
     * check if we're in the state of showing only unclassified failures
     */
    var isUnclassifiedFailures = function() {
        return (_.isEqual(filters.resultStatus.values, thFailureResults) &&
                _.isEqual(filters.isClassified.values, [false]));
    };

    /**
     * Set the list of resultStatus and classified filters.
     *
     * This can be done when loading the page, due to a query string from the
     * URL
     */
    var setCheckFilterValues = function(field, values, quiet) {
        filters[field].values = values;
        $log.debug("setCheckFilterValues", field, values);
        if (!quiet) {
            $rootScope.$broadcast(thEvents.globalFilterChanged);
        }
    };

    /**
     * reset the non-field (checkbox in the ui) filters to the default state
     * so the user sees everything.  Doesn't affect the field filters.  This
     * is used to undo the call to ``showUnclassifiedFailures``.
     */
    var resetNonFieldFilters = function(quiet) {
        filters.resultStatus.values = thResultStatusList.defaultFilters();
        filters.isClassified.values = [true, false];
        if (!quiet) {
            $rootScope.$broadcast(thEvents.globalFilterChanged);
        }
    };

    /**
     * reset all filters, taking us back to the default state.  But does not
     * replace ``filters`` so the reference remains intact where used.
     */
    var resetAllFilters = function(quiet) {
        filters.resultStatus.values = thResultStatusList.defaultFilters();
        filters.isClassified.values = [true, false];
        _.each(filters, function(value, key) {
            if (key !== "isClassified" && key !== "resultStatus") {
                delete filters[key];
            }
        });
        filterKeys = _.keys(filters);

        if (!quiet) {
            $rootScope.$broadcast(thEvents.globalFilterChanged);
        }
    };

    /**
     * Revert the filters back to what they were before one of the
     * showXXX functions was called.
     */
    var revertNonFieldFilters = function() {
        filters.resultStatus.values = stashedStatusFilterValues.resultStatus;
        filters.isClassified.values = stashedStatusFilterValues.isClassified;
        $rootScope.$broadcast(thEvents.globalFilterChanged);

    };

    var toggleSkipExclusionProfiles = function() {
        skipExclusionProfiles = !skipExclusionProfiles;
        $rootScope.$broadcast(thEvents.globalFilterChanged);
    };

    var isSkippingExclusionProfiles = function() {
        return skipExclusionProfiles;
    };

    var matchesDefaults = function(field, values) {
        $log.debug("matchesDefaults", field, values);
        return _.intersection(defaults[field].values, values).length === defaults[field].values.length;
    };

    /**
     * When the page first loads, check the query string params for
     * filters and apply them.
     */
    var buildFiltersFromQueryString = function(quiet) {
        // field filters
        resetAllFilters(true);
        var search = _.clone($location.search());

        $log.debug("query string params", $location.search());

        _.each(search, function (filterVal, filterKey) {
            $log.debug("field filter", filterKey, filterVal);

            if (filterKey.slice(0, urlFilterPrefixLen) === urlFilterPrefix) {
                $log.debug("adding field filter", filterKey, filterVal);
                var field = filterKey.slice(urlFilterPrefixLen);
                addFilter(field, filterVal, fieldChoices[field].matchType);

            } else if (filterKey === "resultStatus" || filterKey === "isClassified") {
                $log.debug("adding check filter", filterKey, filterVal);
                if (!_.isArray(filterVal)) {
                    filterVal = [filterVal];
                }
                // these will come through as strings, so convert to actual booleans
                if (filterKey === "isClassified") {
                    filterVal = _.map(filterVal, function(item) {return item !== "false";});
                }
                setCheckFilterValues(filterKey, _.uniq(filterVal), true);
            } else if ((filterKey === "searchQuery") || (filterKey === "jobname")) {
                //jobname is for backwords compatibility with tbpl links
                setSearchQuery(filterVal);
            }
        });
        $log.debug("done with buildFiltersFromQueryString", filters);
        if (!quiet) {
            $rootScope.$broadcast(thEvents.globalFilterChanged);
        }
    };

    var removeFiltersFromQueryString = function(locationSearch) {
        delete locationSearch.isClassified;
        delete locationSearch.resultStatus;
        delete locationSearch.searchQuery;

        // update the url search params accordingly
        // remove any field filters
        _.each(locationSearch, function(filterVal, filterKey) {
            if (filterKey.slice(0, urlFilterPrefixLen) === urlFilterPrefix) {
                delete locationSearch[filterKey];
            }
        });
        return locationSearch;
    };

    var buildQueryStringFromFilters = function() {

        var newSearchValues = removeFiltersFromQueryString(
            _.clone($location.search()));

        _.each(filters, function(val, key) {
            var values = _.uniq(val.values);
            if (key === "resultStatus" || key === "isClassified") {
                // don't add to query string if it matches the defaults
                $log.debug("set query string checks", key, values);
                if (!matchesDefaults(key, values)) {
                    if (key === "isClassified") {
                        values = _.map(values, function(item) {
                            return item.toString();
                        });
                    }
                    $log.debug("not defaults, setting check query strings",
                               key,
                               values);
                    newSearchValues[key] = values;
                }

            } else {
                $log.debug("setting field query strings", key, values);
                newSearchValues[urlFilterPrefix + key] = values;
            }
        });

        if (searchQueryStr !== ""){
            newSearchValues.searchQuery = searchQueryStr;
        }

        $location.search(newSearchValues);
    };

    var getSearchQuery = function(){
        return { searchQuery:searchQuery, searchQueryStr:searchQueryStr };
    };
    /**
     * Used in more than one place, so this ensures the format remains
     * consistent.  Critical because it's used when building the exclusion
     * profiles in memory, and checking against them.
     */
    var getJobComboField = function(field1, field2) {
        return field1 + " (" + field2 + ")";
    };

    var setSearchQuery = function(queryStr){

        if(typeof queryStr === "string"){
            searchQueryStr = queryStr;

            if(queryStr === ""){
                searchQuery = [];
            }else{
                searchQuery = queryStr.replace(/ +(?= )/g, ' ').toLowerCase().split(' ');
            }

        }
    };

    var getActiveExclusionProfile = function() {
        return activeExclusionProfile;
    };

    var setActiveExclusionProfile = function(newProfile) {
        activeExclusionProfile = newProfile;
        $rootScope.$broadcast(thEvents.globalFilterChanged, null);
    };

    var api = {
        addFilter: addFilter,
        buildFiltersFromQueryString: buildFiltersFromQueryString,
        buildQueryStringFromFilters: buildQueryStringFromFilters,
        copyResultStatusFilters: copyResultStatusFilters,
        excludedJobs: excludedJobs,
        excludedUnclassifiedFailures: excludedUnclassifiedFailures,
        filters: filters,
        getActiveExclusionProfile: getActiveExclusionProfile,
        getCountExcluded: getCountExcluded,
        getCountExcludedForRepo: getCountExcludedForRepo,
        getJobComboField: getJobComboField,
        isJobUnclassifiedFailure: isJobUnclassifiedFailure,
        isSkippingExclusionProfiles: isSkippingExclusionProfiles,
        isUnclassifiedFailures: isUnclassifiedFailures,
        matchesDefaults: matchesDefaults,
        removeAllFieldFilters: removeAllFieldFilters,
        removeFilter: removeFilter,
        removeFiltersFromQueryString: removeFiltersFromQueryString,
        resetAllFilters: resetAllFilters,
        resetNonFieldFilters: resetNonFieldFilters,
        revertNonFieldFilters: revertNonFieldFilters,

        setActiveExclusionProfile: setActiveExclusionProfile,
        setCheckFilterValues: setCheckFilterValues,
        showCoalesced: showCoalesced,
        showJob: showJob,
        showUnclassifiedFailures: showUnclassifiedFailures,

        toggleFilters: toggleFilters,
        toggleInProgress: toggleInProgress,
        toggleSkipExclusionProfiles: toggleSkipExclusionProfiles,

        getSearchQuery: getSearchQuery,
        setSearchQuery: setSearchQuery,

        // CONSTANTS
        isClassified: "isClassified",
        resultStatus: "resultStatus",
        matchType: matchType,
        fieldChoices: fieldChoices,

        searchQuery: searchQuery,
        searchQueryStr: searchQueryStr

    };

    return api;

}]);
