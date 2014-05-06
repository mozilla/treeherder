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
    'thResultStatusList', 'ThLog', '$rootScope', 'ThResultSetModel',
    'thPinboard', 'thNotify', 'thEvents', 'thResultStatus', 'ThRepositoryModel',
    function(
        thResultStatusList, ThLog, $rootScope,
        ThResultSetModel, thPinboard, thNotify, thEvents,
        thResultStatus, ThRepositoryModel) {

    var $log = new ThLog("thJobFilters");

    var matchType = {
        exactstr: 'exactstr',
        substr: 'substr',
        isnull: 'isnull',
        bool: 'bool',
        choice: 'choice'
    };

    // default filters
    var filters = {
        resultStatus: {
            matchType: matchType.exactstr,
            values: thResultStatusList.slice(),
            removeWhenEmpty: false
        },
        isClassified: {
            matchType: matchType.bool,
            values: [true, false],
            removeWhenEmpty: false
        }
    };

    var filterKeys = _.keys(filters);

    // whether or not to skip the checks for the exclusion profiles.
    // an exclusion profile may be enabled, but this allows the user
    // to toggle it on or off.
    var skipExclusionProfiles = false;

    // when setting to ``unclassified`` failures only, we stash any status
    // filters you had before so that when you untoggle from them, you get
    // back to where you were
    var stashedStatusFilterValues = {};

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

    /**
     * If a custom resultStatusList is passed in (like for individual
     * resultSets, then use that.  Otherwise, fall back to the global one.
     *
     * if the filter value is just ``true`` or ``false`` then simply check
     * whether or not the field of ``job`` has a value set or not.  ``true``
     * means it must have a value set, ``false`` means it must be null.
     */
    var checkFilter = function(field, job, resultStatusList) {
        $log.debug("checkFilter", field, job, resultStatusList);
        if (field === api.resultStatus) {
            // resultStatus is a special case that spans two job fields
            var filterList = resultStatusList || filters[field].values;
            return _.contains(filterList, job.result) ||
                   _.contains(filterList, job.state);
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

            $log.debug("jobField filter", field, job);
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
            var platform = Config.OSNames[result];
            if (!platform) {
                // if it's not actually found in Config.OSNames, then return
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
    var addFilter = function(field, value, matchType) {
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

        $log.debug("adding ", field, ": ", value);
        $log.debug("filters", filters);
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
            }
        }

        // if this filer no longer has any values, then remove it
        // unless it has the ``allowEmpty`` setting
        if (filters[field].removeWhenEmpty && filters[field].values.length === 0) {
            delete filters[field];
        }

        filterKeys = _.keys(filters);
        $log.debug("filters", filters);
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
        if(typeof $rootScope.searchQuery === 'string'){
            //Confirm job matches search query
            if(job.searchableStr.toLowerCase().indexOf(
                $rootScope.searchQuery.toLowerCase()
                ) === -1){
                return false;
            }
        }
        if($rootScope.active_exclusion_profile && !skipExclusionProfiles) {
            $log.debug("exclusion profile active", $rootScope.active_exclusion_profile);
            try{
                if($rootScope.active_exclusion_profile.flat_exclusion[$rootScope.repoName]
                    [job.platform][job.job_type_name][job.platform_option]){
                    addExcludedJob(job);
                    return false;
                }
            }catch (e){
                //do nothing
            }
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

        if (skipExclusionProfiles) {
            return repoData.unclassifiedFailureCount;
        } else {
            return repoData.unclassifiedFailureCount - repoData.unclassifiedFailureCountExcluded;
        }
    };

    /**
     * Pin all jobs that pass the GLOBAL filters.  Ignores toggling at
     * the result set level.
     */
    var pinAllShownJobs = function() {
        var jobs = ThResultSetModel.getJobMap($rootScope.repoName);
        var jobsToPin = [];

        var queuePinIfShown = function(jMap) {
            if (api.showJob(jMap.job_obj)) {
                jobsToPin.push(jMap.job_obj);
            }
        };
        _.forEach(jobs, queuePinIfShown);

        if (_.size(jobsToPin) > thPinboard.spaceRemaining()) {
            jobsToPin = jobsToPin.splice(0, thPinboard.spaceRemaining());
            thNotify.send("Pinboard max size exceeded.  Pinning only the first " + thPinboard.spaceRemaining(),
                          "danger",
                          true);
        }

        $rootScope.selectedJob = jobsToPin[0];
        _.forEach(jobsToPin, thPinboard.pinJob);
    };

    $rootScope.$on(thEvents.showUnclassifiedFailures, function() {
        showUnclassifiedFailures();
        $rootScope.$broadcast(thEvents.globalFilterChanged);
    });

    /**
     * Set the non-field filters so that we only view unclassified failures
     */
    var showUnclassifiedFailures = function() {
        stashedStatusFilterValues = {
            resultStatus: filters.resultStatus.values,
            isClassified: filters.isClassified.values
        };
        filters.resultStatus.values = ["busted", "testfailed", "exception"];
        filters.isClassified.values = [false];
    };

    var toggleInProgress = function() {
        var func = addFilter;
        if (_.difference(['pending', 'running'], filters.resultStatus.values).length === 0) {
            func = removeFilter;
        }
        func(api.resultStatus, 'pending');
        func(api.resultStatus, 'running');
    };

    /**
     * check if we're in the state of showing only unclassified failures
     */
    var isUnclassifiedFailures = function() {
        return (_.isEqual(filters.resultStatus.values, ["busted", "testfailed", "exception"]) &&
                _.isEqual(filters.isClassified.values, [false]));
    };

    /**
     * reset the non-field (checkbox in the ui) filters to the default state
     * so the user sees everything.  Doesn't affect the field filters.  This
     * is used to undo the call to ``showUnclassifiedFailures``.
     */
    var resetNonFieldFilters = function() {
        filters.resultStatus.values = stashedStatusFilterValues.resultStatus;
        filters.isClassified.values = stashedStatusFilterValues.isClassified;
    };

    var toggleSkipExclusionProfiles = function() {
        skipExclusionProfiles = !skipExclusionProfiles;
    };

    var isSkippingExclusionProfiles = function() {
        return skipExclusionProfiles;
    };

    var api = {
        addFilter: addFilter,
        removeFilter: removeFilter,
        toggleFilters: toggleFilters,
        copyResultStatusFilters: copyResultStatusFilters,
        showJob: showJob,
        filters: filters,
        pinAllShownJobs: pinAllShownJobs,
        showUnclassifiedFailures: showUnclassifiedFailures,
        toggleInProgress: toggleInProgress,
        isUnclassifiedFailures: isUnclassifiedFailures,
        resetNonFieldFilters: resetNonFieldFilters,
        toggleSkipExclusionProfiles: toggleSkipExclusionProfiles,
        isSkippingExclusionProfiles: isSkippingExclusionProfiles,
        excludedJobs: excludedJobs,
        getCountExcluded: getCountExcluded,
        getCountExcludedForRepo: getCountExcludedForRepo,

        // CONSTANTS
        isClassified: "isClassified",
        resultStatus: "resultStatus",
        matchType: matchType
    };

    return api;

}]);
