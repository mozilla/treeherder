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
 * For a job to be shown, it must have a matching value in ALL the fields
 * specified (including defaults).  But if a field has multiple values, then it
 * must match only ONE of those values.
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

    var PREFIX = "filter-";

    var CLASSIFIED_STATE = "classifiedState";
    var RESULT_STATUS = "resultStatus";
    var SEARCH_QUERY = "searchQuery";

    var QS_CLASSIFIED_STATE = PREFIX + CLASSIFIED_STATE;
    var QS_RESULT_STATUS = PREFIX + RESULT_STATUS;
    var QS_SEARCH_QUERY = PREFIX + SEARCH_QUERY;

    // default filter values
    var DEFAULTS = {
        resultStatus: {
            values: thResultStatusList.defaultFilters()
        },
        classifiedState: {
            values: ['classified', 'unclassified']
        }
    };

    var MATCH_TYPE = {
        exactstr: 'exactstr',
        substr: 'substr',
        choice: 'choice'
    };

    var FIELD_CHOICES = {
        ref_data_name: {
            name: "buildername/jobname",
            matchType: MATCH_TYPE.substr
        },
        job_type_name: {
            name: "job name",
            matchType: MATCH_TYPE.substr
        },
        job_type_symbol: {
            name: "job symbol",
            matchType: MATCH_TYPE.exactstr
        },
        job_group_name: {
            name: "group name",
            matchType: MATCH_TYPE.substr
        },
        job_group_symbol: {
            name: "group symbol",
            matchType: MATCH_TYPE.exactstr
        },
        machine_name: {
            name: "machine name",
            matchType: MATCH_TYPE.substr
        },
        platform: {
            name: "platform",
            matchType: MATCH_TYPE.substr
        },
        failure_classification_id: {
            name: "failure classification",
            matchType: MATCH_TYPE.choice,
            choices: thClassificationTypes.classifications
        }
    };


    var searchQuery = [];
    var searchQueryStr = "";

    var activeExclusionProfile = {};

    // whether or not to skip the checks for the exclusion profiles.
    // an exclusion profile may be enabled, but this allows the user
    // to toggle it on or off.
    var skipExclusionProfiles = false;

    var excludedJobs = {};
    var excludedUnclassifiedFailures = {};


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
     * If a custom resultStatusList is passed in (like for individual
     * resultSets, then use that.  Otherwise, fall back to the global one.
     *
     */
    var _checkFilters = function(job, resultStatusList) {

        var rsFilters = resultStatusList ||
                        _toArray($location.search()[QS_RESULT_STATUS]) ||
                        DEFAULTS.resultStatus.values;

        if (!_.contains(rsFilters, thResultStatus(job))) {
            return false;
        }

        var fciFilters = _toArray($location.search()[QS_CLASSIFIED_STATE]) ||
                         DEFAULTS.classifiedState.values;

        var isClassified = _isJobClassified(job);
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
                var values = _toArray(fieldFilters[qsField]);
                var field = _withoutPrefix(qsField);

                var jobFieldValue = _getJobFieldValue(job, field);

                if (!_.isUndefined(jobFieldValue)) {
                    // if a filter is added somehow, but the job object doesn't
                    // have that field, then don't filter.  Consider it a pass.

                    switch (FIELD_CHOICES[field].matchType) {
                        case MATCH_TYPE.isnull:
                            jobFieldValue = !_.isNull(jobFieldValue);
                            if (!_.contains(values, jobFieldValue)) {
                                return false;
                            }
                            break;

                        case MATCH_TYPE.substr:

                            if (!_containsSubstr(values, jobFieldValue.toLowerCase())) {
                                return false;
                            }
                            break;

                        case MATCH_TYPE.exactstr:
                            if (!_.contains(values, jobFieldValue.toLowerCase())) {
                                return false;
                            }
                            break;

                        case MATCH_TYPE.choice:
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

    var _getFieldFiltersObj = function() {
        var locationSearch = _.clone($location.search());
        _.each(locationSearch, function(values, fieldName) {
            if (!_isFieldFilter(fieldName)) {
                delete locationSearch[fieldName];
            }
        });
        return locationSearch;
    };


    var addFilter = function(field, value) {
        //check for existing value
        var oldQsVal = $location.search()[_withPrefix(field)] ||
                     DEFAULTS[field].values.slice();
        var newQsVal = null;

        if (oldQsVal) {
            // set the value to an array
            newQsVal = _toArray(oldQsVal);
            newQsVal.push(value);
            newQsVal = _.uniq(newQsVal);
        } else {
            newQsVal = value;
        }
        if (_matchesDefaults(field, newQsVal)) {
            newQsVal = null;
        }
        $log.debug("add set " + _withPrefix(field) + " from " + oldQsVal + " to " + newQsVal);
        $location.search(_withPrefix(field), _.uniq(newQsVal));

    };

    var removeFilter = function(field, value) {
        var oldQsVal = _toArray($location.search()[_withPrefix(field)]) ||
                     DEFAULTS[field].values.slice();
        // default to just removing the param completely
        var newQsVal = null;

        if (oldQsVal && oldQsVal.length) {
            newQsVal = _.without(oldQsVal, value);
        }
        if (!newQsVal || !newQsVal.length || _matchesDefaults(field, newQsVal)) {
            newQsVal = null;
        }
        $log.debug("remove set " + _withPrefix(field) + " from " + oldQsVal + " to " + newQsVal);
        $location.search(_withPrefix(field), newQsVal);
    };

    var removeAllFieldFilters = function() {
        var locationSearch = $location.search();
        _stripFieldFilters(locationSearch);
        $location.search(locationSearch);
    };

    /**
     * reset the non-field (checkbox in the ui) filters to the default state
     * so the user sees everything.  Doesn't affect the field filters.  This
     * is used to undo the call to ``setOnlyUnclassifiedFailures``.
     */
    var resetNonFieldFilters = function() {
        var locationSearch = _.clone($location.search());
        delete locationSearch[QS_RESULT_STATUS];
        delete locationSearch[QS_CLASSIFIED_STATE];
        $location.search(locationSearch);
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

    var toggleInProgress = function() {
        var rsValues = _toArray($location.search()[QS_RESULT_STATUS]);
        var pendRun = ['pending', 'running'];
        if (_.difference(pendRun, rsValues).length === 0) {
            rsValues = _.without(rsValues, 'pending', 'running');
        } else {
            rsValues = _.uniq(_.flatten(rsValues, pendRun));
        }
        $location.search(QS_RESULT_STATUS, rsValues);
    };

    var toggleUnclassifiedFailures = function() {
        $log.debug("toggleUnclassifiedFailures");
        if (_isUnclassifiedFailures()) {
            resetNonFieldFilters();
        } else {
            setOnlyUnclassifiedFailures();
        }
    };

    /**
     * Set the non-field filters so that we only view unclassified failures
     */
    var setOnlyUnclassifiedFailures = function() {
        var locationSearch = _.clone($location.search());
        locationSearch[QS_RESULT_STATUS] = thFailureResults.slice();
        locationSearch[QS_CLASSIFIED_STATE] = ['unclassified'];
        $location.search(locationSearch);
    };

    /**
     * Set the non-field filters so that we only view coalesced jobs
     */
    var setOnlyCoalesced = function() {
        var locationSearch = _.clone($location.search());
        locationSearch[QS_RESULT_STATUS] = "coalesced";
        locationSearch[QS_CLASSIFIED_STATE]= DEFAULTS.classifiedState.values.slice();
        $location.search(locationSearch);
    };




    var getClassifiedStateArray = function() {
        var arr = _toArray($location.search()[QS_CLASSIFIED_STATE]) ||
               DEFAULTS.classifiedState.values;
        return arr.slice();
    };

    var getFieldFiltersArray = function() {
        var fieldFilters = [];

        _.each($location.search(), function(values, fieldName) {
            if (_isFieldFilter(fieldName)) {
                _.each(values, function (val) {
                    fieldFilters.push({field: _withoutPrefix(fieldName),
                                       value: val});
                });
            }
        });
        return fieldFilters;
    };

    var getResultStatusArray = function() {
        var arr = _toArray($location.search()[QS_RESULT_STATUS]) ||
                  DEFAULTS.resultStatus.values;
        return arr.slice();
    };

    var isJobUnclassifiedFailure = function(job) {
        return (_.contains(thFailureResults, job.result) &&
            !_isJobClassified(job));
    };

    var _isJobClassified = function(job) {
        return job.failure_classification_id !== 1;
    };

    var stripFiltersFromQueryString = function(locationSearch) {
        delete locationSearch[QS_CLASSIFIED_STATE];
        delete locationSearch[QS_RESULT_STATUS];
        delete locationSearch[QS_SEARCH_QUERY];

        _stripFieldFilters(locationSearch);
        return locationSearch;
    };

    /*******************************************
     * full-text search query
     */

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

    /**
     * Removes field filters from the passed-in locationSearch without
     * actually setting it in the location bar
     */
    var _stripFieldFilters = function(locationSearch) {
        _.forEach(locationSearch, function (val, field) {
            if (_isFieldFilter(field)) {
                delete locationSearch[field];
            }
        });
        return locationSearch;
    };

    var _isFieldFilter = function(field) {
        return field.startsWith(PREFIX) &&
               !_.contains(['resultStatus', 'classifiedState'], _withoutPrefix(field));
    };

    /**
     * Get the field from the job.  In most cases, this is very simple.  But
     * this function allows for some special cases, like ``platform`` which
     * shows to the user as a different string than what is stored in the job
     * object.
     */
    var _getJobFieldValue = function(job, field) {
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
     * check if we're in the state of showing only unclassified failures
     */
    var _isUnclassifiedFailures = function() {
        return (_.isEqual($location.search()[QS_RESULT_STATUS], thFailureResults) &&
                _.isEqual($location.search()[QS_CLASSIFIED_STATE], ['unclassified']));
    };

    var _matchesDefaults = function(field, values) {
        $log.debug("_matchesDefaults", field, values);
        return _.intersection(DEFAULTS[field].values, values).length === DEFAULTS[field].values.length;
    };

    var _withPrefix = function(field) {
        if (!field.startsWith(PREFIX)) {
            return PREFIX+field;
        } else {
            return field;
        }
    };

    var _withoutPrefix = function(field) {
        if (field.startsWith(PREFIX)) {
            return field.replace(PREFIX, '');
        } else {
            return field;
        }
    };

    /**
     * Check the array if any elements contain a match for the ``val`` as a
     * substring.
     */
    var _containsSubstr = function(arr, val) {
        for (var i = 0; i < arr.length; i++) {
            if (val.indexOf(arr[i]) >= 0) {
                return true;
            }
        }
        return false;
    };

    var _toArray = function(value) {
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

    /*********************
     * Exclusion profile functions -- soon to be refactored
     *******************/

    /**
     * When a job is excluded, we add it to the ``excludedJobs`` object which
     * keeps track of the counts of resultStatus values during exclusion.
     * These values can then be used to modify the displayed counts per
     * ``resultStatus`` in that directive if exclusion is enabled.
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
        // check a job against the filters
        showJob: showJob,

        // filter changing accessors
        addFilter: addFilter,
        removeFilter: removeFilter,
        removeAllFieldFilters: removeAllFieldFilters,
        resetNonFieldFilters: resetNonFieldFilters,
        toggleFilters: toggleFilters,
        toggleInProgress: toggleInProgress,
        toggleUnclassifiedFailures: toggleUnclassifiedFailures,
        setOnlyCoalesced: setOnlyCoalesced,

        // filter data read-only accessors
        getClassifiedStateArray: getClassifiedStateArray,
        getFieldFiltersArray: getFieldFiltersArray,
        getResultStatusArray: getResultStatusArray,
        isJobUnclassifiedFailure: isJobUnclassifiedFailure,
        stripFiltersFromQueryString: stripFiltersFromQueryString,

        // string search
        getSearchQuery: getSearchQuery,
        setSearchQuery: setSearchQuery,

        // CONSTANTS
        classifiedState: CLASSIFIED_STATE,
        resultStatus: RESULT_STATUS,
        fieldChoices: FIELD_CHOICES,

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
