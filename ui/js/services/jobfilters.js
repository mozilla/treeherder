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
    'thPinboard', 'thNotify', 'thEvents',
    function(
        thResultStatusList, ThLog, $rootScope,
        ThResultSetModel, thPinboard, thNotify, thEvents) {

    var $log = new ThLog("thJobFilters");

    var matchType = {
        exactstr: 0,
        substr: 1,
        isnull: 2,
        bool: 3
    };

    // default filters
    var filters = {
        resultStatus: {
            matchType: matchType.exactstr,
            values: thResultStatusList.slice(),
            removeWhenEmpty: false
        },
        failure_classification_id: {
            matchType: matchType.bool,
            values: [true, false],
            removeWhenEmpty: false
        }
    };

    var filterKeys = _.keys(filters);

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
        } else if (field === api.failure_classification_id) {
            // fci is a special case, too.  Where 1 is "not classified"
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
        if($rootScope.active_exclusion_profile){
            try{
                if($rootScope.active_exclusion_profile.flat_exclusion[$rootScope.repoName]
                    [job.platform][job.job_type_name].indexOf(job.platform_option) !== -1){
                    return false;
                }
            }catch (e){
                //do nothing
            }
        }

        return true;
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
        filters.resultStatus.values = ["busted", "testfailed", "exception"];
        filters.failure_classification_id.values = [false];
    };

    /**
     * check if we're in the state of showing only unclassified failures
     */
    var isUnclassifiedFailures = function() {
        return (_.isEqual(filters.resultStatus.values, ["busted", "testfailed", "exception"]) &&
                _.isEqual(filters.failure_classification_id.values, [false]));
    };

    /**
     * reset the non-field (checkbox in the ui) filters to the default state
     * so the user sees everything.  Doesn't affect the field filters.  This
     * is used to undo the call to ``showUnclassifiedFailures``.
     */
    var resetNonFieldFilters = function() {
        filters.resultStatus.values = thResultStatusList.slice();
        filters.failure_classification_id.values = [true, false];
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
        isUnclassifiedFailures: isUnclassifiedFailures,
        resetNonFieldFilters: resetNonFieldFilters,

        // CONSTANTS
        failure_classification_id: "failure_classification_id",
        resultStatus: "resultStatus",
        matchType: matchType
    };

    return api;

}]);
