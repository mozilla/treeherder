/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

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
        classifiedState: {
            values: ['classified', 'unclassified']
        }
    };

    var activeExclusionProfile = {};

    // whether or not to skip the checks for the exclusion profiles.
    // an exclusion profile may be enabled, but this allows the user
    // to toggle it on or off.
    var skipExclusionProfiles = false;

    // when setting to ``unclassified`` failures only, we stash any status
    // filters you had before so that when you untoggle from them, you get
    // back to where you were
    var stashedStatusFilterValues = {};

    var CLASSIFIED_STATE = "classifiedState";
    var RESULT_STATUS = "resultStatus";
    var SEARCH_QUERY = "searchQuery";

    var prefix = "filter-";
    var withPrefix = function(field) {
        if (!field.startsWith(prefix)) {
            return prefix+field;
        } else {
            return field;
        }
    };

    var withoutPrefix = function(field) {
        if (field.startsWith(prefix)) {
            return field.replace(prefix, '');
        } else {
            return field;
        }
    };

    var QS_CLASSIFIED_STATE = withPrefix(CLASSIFIED_STATE);
    var QS_RESULT_STATUS = withPrefix(RESULT_STATUS);
    var QS_SEARCH_QUERY = withPrefix(SEARCH_QUERY);

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
     */
    var _checkFilters = function(job, resultStatusList) {

        var rsFilters = resultStatusList ||
                        toArray($location.search()[QS_RESULT_STATUS]) ||
                        defaults.resultStatus;

        if (!_.contains(rsFilters, thResultStatus(job))) {
            return false;
        }

        var fciFilters = toArray($location.search()[QS_CLASSIFIED_STATE]) ||
                         defaults.classifiedState.values;

        var isClassified = isJobClassified(job);
        if (!_.contains(fciFilters, 'unclassified') && !isClassified) {
                return false;
        }
        if (!_.contains(fciFilters, 'classified') && isClassified) {
                return false;
        }

        // todo: need to cache getAllFieldFilters
        var fieldFilters = _getFieldFiltersObj();

        for (var qsField in fieldFilters) {
            if (fieldFilters.hasOwnProperty(qsField)) {
                var values = toArray(fieldFilters[qsField]);
                var field = withoutPrefix(qsField);

                var jobFieldValue = getJobFieldValue(job, field);

                if (!_.isUndefined(jobFieldValue)) {
                    // if a filter is added somehow, but the job object doesn't
                    // have that field, then don't filter.  Consider it a pass.

                    switch (fieldChoices[field].matchType) {
                        case matchType.isnull:
                            jobFieldValue = !_.isNull(jobFieldValue);
                            if (!_.contains(values, jobFieldValue)) {
                                return false;
                            }
                            break;

                        case matchType.substr:

                            if (!containsSubstr(values, jobFieldValue.toLowerCase())) {
                                return false;
                            }
                            break;

                        case matchType.exactstr:
                            if (!_.contains(values, jobFieldValue.toLowerCase())) {
                                return false;
                            }
                            break;

                        case matchType.choice:
                            if (!_.contains(values, String(jobFieldValue).toLowerCase())) {
                                return false;
                            }
                            break;
                    }

                }
            }
        }

        return true;

    };

    var addFilter = function(field, value) {
        //check for existing value
        var oldQsVal = $location.search()[withPrefix(field)] ||
                     defaults[field].values;
        var newQsVal = null;

        // todo: remove field, if it matches defaults
        if (oldQsVal) {
            // set the value to an array
            newQsVal = toArray(oldQsVal);
            newQsVal.push(value);
            newQsVal = _.uniq(newQsVal);
        } else {
            newQsVal = value;
        }
        if (matchesDefaults(field, newQsVal)) {
            newQsVal = null;
        }
        console.log("add set " + withPrefix(field) + " from " + oldQsVal + " to " + newQsVal);
        $location.search(withPrefix(field), _.uniq(newQsVal));

    };

    var removeFilter = function(field, value) {
        var oldQsVal = toArray($location.search()[withPrefix(field)]) ||
                     defaults[field].values;
        // default to just removing the param completely
        var newQsVal = null;

        if (oldQsVal && oldQsVal.length) {
            newQsVal = _.without(oldQsVal, value);
        }
        if (!newQsVal || !newQsVal.length || matchesDefaults(field, newQsVal)) {
            newQsVal = null;
        }
        console.log("remove set " + withPrefix(field) + " from " + oldQsVal + " to " + newQsVal);
        $location.search(withPrefix(field), newQsVal);
    };

    /**
     * Removes field filters from the passed in locationSearch without
     * actually setting it in the location bar so that further actions
     * can be taken without re-rendering jobs.
     * @param locationSearch A result of $location.search()
     * @returns the same obj passed in without field filters;
     */
    var stripFieldFilters = function(locationSearch) {
        _.forEach(locationSearch, function (val, field) {
            if (isFieldFilter(field)) {
                delete locationSearch[field];
            }
        });
        return locationSearch;
    };

    var removeAllFieldFilters = function() {
        var locationSearch = $location.search();
        stripFieldFilters(locationSearch);
        $location.search(locationSearch);
    };

    var isFieldFilter = function(field) {
        return field.startsWith(prefix) &&
               !_.contains(['resultStatus', 'classifiedState'], withoutPrefix(field));
    };

    var getIsClassifiedArray = function() {
        return toArray($location.search()[QS_CLASSIFIED_STATE]) || defaults.classifiedState.values ;
    };

    var getResultStatusArray = function() {
        return toArray($location.search()[QS_RESULT_STATUS]) || defaults.resultStatus.values;
    };

    var getFieldFiltersArray = function() {
        var fieldFilters = [];

        _.each($location.search(), function(values, fieldName) {
            if (isFieldFilter(fieldName)) {
                _.each(values, function (val) {
                    fieldFilters.push({field: withoutPrefix(fieldName),
                                       value: val});
                });
            }
        });
        return fieldFilters;
    };

    var _getFieldFiltersObj = function() {
        var locationSearch = _.clone($location.search());
        _.each(locationSearch, function(values, fieldName) {
            if (!isFieldFilter(fieldName)) {
                delete locationSearch[fieldName];
            }
        });
        return locationSearch;
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
        $rootScope.$emit(thEvents.globalFilterChanged);
    };

    var copyResultStatusFilters = function() {
        var rsFilters = toArray($location.search()[QS_RESULT_STATUS]) ||
                        defaults.resultStatus.values;
        return rsFilters.slice();
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

        if (!_checkFilters(job, resultStatusList)) {
            return false;
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

    var toArray = function(value) {
        if (_.isUndefined(value)) {
            return value;
        }
        if (!_.isArray(value)) {
            return [value];
        } else if (value.length === 0) {
            return null;
        }
        return value;
    };

    /**
     * Set the non-field filters so that we only view coalesced jobs
     */
    var showCoalesced = function() {
        stashStatusFilters();
        var locationSearch = _.clone($location.search());
        locationSearch[QS_RESULT_STATUS] = "coalesced";
        locationSearch[QS_CLASSIFIED_STATE]= [false, true];
        $location.search(locationSearch);
    };

    var toggleInProgress = function() {
        var rsValues = toArray($location.search()[QS_RESULT_STATUS]);
        var pendRun = ['pending', 'running'];
        if (_.difference(pendRun, rsValues).length === 0) {
            rsValues = _.without(rsValues, 'pending', 'running');
        } else {
            rsValues = _.uniq(_.flatten(rsValues, pendRun));
        }
        $location.search(QS_RESULT_STATUS, rsValues);
    };

    var isJobUnclassifiedFailure = function(job) {
        return (_.contains(thFailureResults, job.result) &&
            !isJobClassified(job));
    };

    var isJobClassified = function(job) {
        return job.failure_classification_id !== 1;
    };

    var toggleUnclassifiedFailures = function() {
        $log.debug("toggleUnclassifiedFailures");
        if (isUnclassifiedFailures()) {
            resetNonFieldFilters();
        } else {
            showUnclassifiedFailures();
        }
    };
    var stashStatusFilters = function() {
        var locationSearch = $location.search();
        stashedStatusFilterValues = {
            resultStatus: locationSearch[QS_RESULT_STATUS],
            classifiedState: locationSearch[QS_CLASSIFIED_STATE]
        };
    };
    /**
     * Set the non-field filters so that we only view unclassified failures
     */
    var showUnclassifiedFailures = function() {
        var locationSearch = _.clone($location.search()),
            rs = withPrefix(api.resultStatus),
            ic = withPrefix(api.classifiedState);
        stashStatusFilters();
        locationSearch[rs] = thFailureResults.slice();
        locationSearch[ic] = ['unclassified'];
        $location.search(locationSearch);
    };

    /**
     * check if we're in the state of showing only unclassified failures
     */
    var isUnclassifiedFailures = function() {
        return (_.isEqual($location.search()[QS_RESULT_STATUS], thFailureResults) &&
                _.isEqual($location.search()[QS_CLASSIFIED_STATE], ['unclassified']));
    };

    /**
     * reset the non-field (checkbox in the ui) filters to the default state
     * so the user sees everything.  Doesn't affect the field filters.  This
     * is used to undo the call to ``showUnclassifiedFailures``.
     */
    var resetNonFieldFilters = function() {
        var locationSearch = _.clone($location.search());
        delete locationSearch[QS_RESULT_STATUS];
        delete locationSearch[QS_CLASSIFIED_STATE];
        $location.search(locationSearch);
    };

    /**
     * reset all filters, taking us back to the default state.  But does not
     * replace ``filters`` so the reference remains intact where used.
     */
    var resetAllFilters = function(quiet) {
        var locationSearch = _.clone($location.search());
        delete locationSearch[QS_CLASSIFIED_STATE];
        delete locationSearch[QS_RESULT_STATUS];
        locationSearch = stripFieldFilters(locationSearch);
        $location.search(locationSearch);
    };

    /**
     * Revert the filters back to what they were before one of the
     * showXXX functions was called.
     */
    // todo: make this revert, rather than just go to default
    var revertNonFieldFilters = function() {
        var locationSearch = _.clone($location.search());
        delete locationSearch[QS_CLASSIFIED_STATE];
        delete locationSearch[QS_RESULT_STATUS];
        $location.search(locationSearch);
    };

    var matchesDefaults = function(field, values) {
        $log.debug("matchesDefaults", field, values);
        return _.intersection(defaults[field].values, values).length === defaults[field].values.length;
    };

    /***********************
     * full-text search query
     */


    // todo: remove?  this should all be handled internally in this class
    var stripFiltersFromQueryString = function(locationSearch) {
        delete locationSearch[QS_CLASSIFIED_STATE];
        delete locationSearch[QS_RESULT_STATUS];
        delete locationSearch[QS_SEARCH_QUERY];

        stripFieldFilters(locationSearch);
        return locationSearch;
    };

    var getSearchQuery = function(){
        return { searchQuery:searchQuery, searchQueryStr:searchQueryStr };
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


    /***********************
     * utility functions
     */



    /*********************
     * Exclusion profile calls -- soon to be removed/refactored
     *********************/

    /**
     * Used in more than one place, so this ensures the format remains
     * consistent.  Critical because it's used when building the exclusion
     * profiles in memory, and checking against them.
     */
    var getJobComboField = function(field1, field2) {
        return field1 + " (" + field2 + ")";
    };

    var toggleSkipExclusionProfiles = function() {
        skipExclusionProfiles = !skipExclusionProfiles;
        $rootScope.$emit(thEvents.globalFilterChanged);
    };

    var isSkippingExclusionProfiles = function() {
        return skipExclusionProfiles;
    };

    var getActiveExclusionProfile = function() {
        return activeExclusionProfile;
    };

    var setActiveExclusionProfile = function(newProfile) {
        activeExclusionProfile = newProfile;
        $rootScope.$emit(thEvents.globalFilterChanged, null);
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



    /*********************************
     * Externally available API fields
     */

    var api = {
        addFilter: addFilter,
        removeFilter: removeFilter,
        removeAllFieldFilters: removeAllFieldFilters,
        stripFiltersFromQueryString: stripFiltersFromQueryString,
        resetAllFilters: resetAllFilters,
        resetNonFieldFilters: resetNonFieldFilters,
        revertNonFieldFilters: revertNonFieldFilters,

        getFieldFiltersArray: getFieldFiltersArray,
        getIsClassifiedArray: getIsClassifiedArray,
        getResultStatusArray: getResultStatusArray,
        copyResultStatusFilters: copyResultStatusFilters,

        isJobUnclassifiedFailure: isJobUnclassifiedFailure,
        matchesDefaults: matchesDefaults,

        showCoalesced: showCoalesced,
        showJob: showJob,
        showUnclassifiedFailures: showUnclassifiedFailures,

        toggleFilters: toggleFilters,
        toggleInProgress: toggleInProgress,
        toggleUnclassifiedFailures: toggleUnclassifiedFailures,

        getSearchQuery: getSearchQuery,
        setSearchQuery: setSearchQuery,

        // CONSTANTS
        classifiedState: CLASSIFIED_STATE,
        resultStatus: RESULT_STATUS,
        fieldChoices: fieldChoices,

        searchQuery: searchQuery,
        searchQueryStr: searchQueryStr,

        // EXCLUSION PROFILE
        getActiveExclusionProfile: getActiveExclusionProfile,
        setActiveExclusionProfile: setActiveExclusionProfile,
        getJobComboField: getJobComboField,
        excludedJobs: excludedJobs,
        excludedUnclassifiedFailures: excludedUnclassifiedFailures,
        toggleSkipExclusionProfiles: toggleSkipExclusionProfiles,
        getCountExcluded: getCountExcluded,
        getCountExcludedForRepo: getCountExcludedForRepo,
        isSkippingExclusionProfiles: isSkippingExclusionProfiles

    };

    return api;

}]);
