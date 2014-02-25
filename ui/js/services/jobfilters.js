'use strict'

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
    var incompleteStates = ['pending', 'running'];

    /**
     * Looks like:
     * {
     *     result: [
     *         'success',
     *         'testfailed'
     *     ],
     *     platform: [
     *         'windows',
     *         'mac'
     *     ]
     */
    var filters = {
        resultStatus: thResultStatusList.slice(),
        failure_classification_id: [true, false]
    };

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
            var filterList = resultStatusList || filters[field];
            return _.contains(filterList, job.result) ||
                   _.contains(filterList, job.state);
        } else {
            var jobFieldValue = job[field];
            if (_.every(filters[field], _.isBoolean)) {
                jobFieldValue = !_.isNull(jobFieldValue);
            }
            return _.contains(filters[field], jobFieldValue);
        }
    };

    var api = {
        addFilter: function(field, value) {
            if (filters.hasOwnProperty(field)) {
                if (!_.contains(filters[field], value)) {
                    filters[field].push(value);
                }
            } else {
                filters[field] = [value];
            }
            $log.debug("adding " + field + ": " + value);
            $log.debug(filters);
        },
        removeFilter: function(field, value) {
            if (filters.hasOwnProperty(field)) {
                var idx = filters[field].indexOf(value);
                if(idx > -1) {
                    filters[field].splice(idx, 1);
                }
            }

            // if this filer no longer has any values, then remove it
            if (filters[field].length === 0) {
                delete filters[field];
            }
            $log.debug("removing " + value);
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
            return filters[api.resultStatus].slice();
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
            if (filters.length === 0) {
                return false;
            }
            for(var i = 0; i < fields.length; i++) {
                if (!checkFilter(fields[i], job)) {
                    return false;
                }
            }
            return true;
        },
        resultStatus: "resultStatus",
        getFilters: function() {
            return filters;
        }
    };

    return api;

});
