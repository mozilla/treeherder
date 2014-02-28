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
treeherder.factory('thJobFilters', function(thResultStatusList, $log) {

    /**
     * If a custom resultStatusList is passed in (like for individual
     * resultSets, then use that.  Otherwise, fall back to the global one.
     *
     * if the filter value is just ``true`` or ``false`` then simply check
     * whether or not the field of ``job`` has a value set or not.  ``true``
     * means it must have a value set, ``false`` means it must be null.
     */
    var checkFilter = function(field, job, resultStatusList) {
        // resultStatus is a special case that spans two job fields
        if (field === api.resultStatus) {
            var filterList = resultStatusList || filters[field].values;
            return _.contains(filterList, job.result) ||
                   _.contains(filterList, job.state);
        } else {
            var jobFieldValue = getJobFieldValue(job, field);
            if (_.isUndefined(jobFieldValue)) {
                //$log.warn("job object has no field of '" + field + "'.  Skipping filtration.");
                return true;
            }

            var jobFieldValue = getJobFieldValue(job, field);
            $log.debug(field + ": " + JSON.stringify(job));
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

    var api = {
        /**
         * Add a case-insensitive filter.
         * @param field - the field in the job objec to check
         * @param value - the value to match
         * @param matchType - which type of filter to use.  Default: ``exactstr``
         *                    If the filter field already exists, update the
         *                    ``matchType`` to this value.
         */
        addFilter: function(field, value, matchType) {
            if (_.isUndefined(matchType)) {
                matchType = api.matchType.exactstr;
            }
            // always store in lower case so that comparisons are case insensitive
            if (_.isString(value)) {
                // the string types are case insensitive
                value = value.toLowerCase();
            }
            if (filters.hasOwnProperty(field)) {
                if (!_.contains(filters[field], value)) {
                    filters[field].values.push(value);
                    filters[field].matchType = matchType;
                }
            } else {
                filters[field] = {
                    values: [value],
                    matchType: matchType
                };
            }
            $log.debug("adding " + field + ": " + value);
            $log.debug(filters);
        },
        removeFilter: function(field, value) {
            if (filters.hasOwnProperty(field)) {
                if (_.isString(value)) {
                    // the string types are case insensitive
                    value = value.toLowerCase();
                }
                var idx = filters[field].values.indexOf(value);
                if(idx > -1) {
                    $log.debug("removing " + value);
                    filters[field].values.splice(idx, 1);
                }
            }

            // if this filer no longer has any values, then remove it
            if (filters[field].values.length === 0) {
                delete filters[field];
            }
            $log.debug(filters);
        },
        /**
         * used mostly for resultStatus doing group toggles
         *
         * @param field
         * @param values - an array of values for the field
         * @param add - true if adding, false if removing
         */
        toggleFilters: function(field, values, add) {
            $log.debug("toggling: " + add);
            var action = add? api.addFilter: api.removeFilter;
            for (var i = 0; i < values.length; i++) {
                action(field, values[i]);
            }
        },
        copyResultStatusFilters: function() {
            if (filters.hasOwnProperty(api.resultStatus)) {
                return filters[api.resultStatus].values.slice();
            } else {
                return [];
            }
        },
        /**
         * Whether or not this job should be shown based on the current
         * filters.
         *
         * @param job - the job we are checking against the filter
         * @param resultStatusList - optional.  custom list of resultstatuses
         *        that can be used for individual resultsets
         */
        showJob: function(job, resultStatusList) {
            var fields = _.keys(filters);
            /*
            Handle the two special checkbox fields.  If ALL the boxes in
            either group are unchecked, then we should show no jobs, regardless
            of other filters.
             */
            if (!_.contains(fields, api.resultStatus) ||
                !_.contains(fields, api.failure_classification_id)) {
                return false;
            }
            for(var i = 0; i < fields.length; i++) {
                if (!checkFilter(fields[i], job, resultStatusList)) {
                    return false;
                }
            }
            return true;
        },
        getFilters: function() {
            return filters;
        },

        // CONSTANTS to avoid typos
        failure_classification_id: "failure_classification_id",
        resultStatus: "resultStatus",
        matchType: {
            exactstr: 0,
            substr: 1,
            isnull: 2
        }
    };

    // default filters
    var filters = {
        resultStatus: {
            matchType: api.matchType.exactstr,
            values: thResultStatusList.slice()
        },
        failure_classification_id: {
            matchType: api.matchType.isnull,
            values: [true, false]
        }
    };

    return api;

});
