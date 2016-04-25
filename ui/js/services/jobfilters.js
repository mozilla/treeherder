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
    'thPlatformName',
    function(
        thResultStatusList, ThLog, $rootScope, $location,
        thNotify, thEvents, thFailureResults,
        thResultStatus, thClassificationTypes, ThRepositoryModel,
        thPlatformName) {

        var $log = new ThLog("thJobFilters");

        // prefix for all filter query string params
        var PREFIX = "filter-";

        // constants for specific types of filters
        var CLASSIFIED_STATE = "classifiedState";
        var RESULT_STATUS = "resultStatus";
        var SEARCH_STR = "searchStr";

        var QS_CLASSIFIED_STATE = PREFIX + CLASSIFIED_STATE;
        var QS_RESULT_STATUS = PREFIX + RESULT_STATUS;
        var QS_SEARCH_STR = PREFIX + SEARCH_STR;

        // default filter values, when a filter is not specified in the query string
        var DEFAULTS = {
            resultStatus: thResultStatusList.defaultFilters(),
            classifiedState: ['classified', 'unclassified'],
            tier: ["1", "2"]
        };

        // failure classification ids that should be shown in "unclassified" mode
        var UNCLASSIFIED_IDS = [1, 7];

        var TIERS = ["1", "2", "3"];

        // used with field-filters to determine how to match the value against the
        // job field.
        var MATCH_TYPE = {
            exactstr: 'exactstr',
            substr: 'substr',       // returns true if any values match the substring
            searchStr: 'searchStr', // returns true only if ALL the values match the substring
            choice: 'choice'
        };

        // choices available for the field filters
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
            tier: {
                name: "tier",
                matchType: MATCH_TYPE.exactstr
            },
            failure_classification_id: {
                name: "failure classification",
                matchType: MATCH_TYPE.choice,
                choices: thClassificationTypes.classifications
            },
            // text search across multiple fields
            searchStr: {
                name: "search string",
                matchType: MATCH_TYPE.searchStr
            }
        };

        // filter caches so that we only collect them when the filter params
        // change in the query string
        var cachedResultStatusFilters = {};
        var cachedClassifiedStateFilters = {};
        var cachedFieldFilters = {};
        var cachedFilterParams;

        /**
         * Checks for a filter change and, if detected, updates the cached filter
         * values from the query string.  Then publishes the global event
         * to re-render jobs.
         */
        $rootScope.$on('$locationChangeSuccess', function() {

            var newFilterParams = getNewFilterParams();
            if (!_.isEqual(cachedFilterParams, newFilterParams)) {
                cachedFilterParams = newFilterParams;
                _refreshFilterCaches();
                $rootScope.$emit(thEvents.globalFilterChanged);
            }

        });

        var getNewFilterParams = function() {
            var filterParams = {};
            _.each($location.search(), function (value, field) {
                if (_startsWith(field, PREFIX)) {
                    filterParams[field] = value;
                }
            });
            return filterParams;
        };

        var _refreshFilterCaches = function() {
            cachedResultStatusFilters = _getFiltersOrDefaults(RESULT_STATUS);
            cachedClassifiedStateFilters = _getFiltersOrDefaults(CLASSIFIED_STATE);
            cachedFieldFilters = getFieldFiltersObj();
        };

        var getFieldFiltersObj = function() {
            var fieldFilters = {};
            // get the search params and lay any defaults over it so we test
            // against those as well.
            var locationSearch = _.defaults(_.clone($location.search()),
                                            _.mapKeys(DEFAULTS, function(value, key) {
                                                return _withPrefix(key);
                                            }));
            _.each(locationSearch, function(values, field) {
                if (_isFieldFilter(field)) {
                    if (field === QS_SEARCH_STR) {
                        // we cache this one a little differently
                        fieldFilters[_withoutPrefix(field)] = decodeURIComponent(values).replace(/ +(?= )/g, ' ').toLowerCase().split(' ');
                    } else {
                        var lowerVals = _.map(_toArray(values),
                                              function(v) {return String(v).toLowerCase();});
                        fieldFilters[_withoutPrefix(field)] = lowerVals;
                    }
                }
            });
            return fieldFilters;
        };

        var _getFiltersOrDefaults = function(field) {
            var filters = _.clone($location.search()[_withPrefix(field)]);
            if (filters) {
                return _toArray(filters);
            } else if (DEFAULTS.hasOwnProperty(_withoutPrefix(field))) {
                return DEFAULTS[_withoutPrefix(field)].slice();
            }
            return [];
        };

        /**
         * Whether or not this job should be shown based on the current
         * filters.
         *
         * @param job - the job we are checking against the filters
         */
        var showJob = function(job) {
            // when runnable jobs have been added to a resultset, they should be
            // shown regardless of settings for classified or result state
            if (job.result !== "runnable") {
                // test against resultStatus and classifiedState
                if (!_.contains(cachedResultStatusFilters, thResultStatus(job))) {
                    return false;
                }
                if (!_checkClassifiedStateFilters(job)) {
                    return false;
                }
            }
            // runnable or not, we still want to apply the field filters like
            // for symbol, platform, search str, etc...
            return _checkFieldFilters(job);
        };

        var _checkClassifiedStateFilters = function(job) {
            var isClassified = _isJobClassified(job);
            if (!_.contains(cachedClassifiedStateFilters, 'unclassified') && !isClassified) {
                return false;
            }
            if (!_.contains(cachedClassifiedStateFilters, 'classified') && isClassified) {
                return false;
            }
            return true;
        };

        var _checkFieldFilters = function(job) {

            for (var field in cachedFieldFilters) {
                if (cachedFieldFilters.hasOwnProperty(field)) {

                    var values = cachedFieldFilters[field];
                    var jobFieldValue = _getJobFieldValue(job, field);

                    if (!_.isUndefined(jobFieldValue)) {
                        // if a filter is added somehow, but the job object doesn't
                        // have that field, then don't filter.  Consider it a pass.
                        jobFieldValue = String(jobFieldValue).toLowerCase();

                        switch (FIELD_CHOICES[field].matchType) {

                            case MATCH_TYPE.substr:
                                if (!_containsSubstr(values, jobFieldValue)) {
                                    return false;
                                }
                                break;

                            case MATCH_TYPE.searchStr:
                                if (!_containsAllSubstr(values, jobFieldValue)) {
                                    return false;
                                }
                                break;

                            case MATCH_TYPE.exactstr:
                                if (!_.contains(values, jobFieldValue)) {
                                    return false;
                                }
                                break;

                            case MATCH_TYPE.choice:
                                if (!_.contains(values, jobFieldValue)) {
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
            var oldQsVal = _getFiltersOrDefaults(field);
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
            $location.search(_withPrefix(field), newQsVal);
        };

        var removeFilter = function(field, value) {
            // default to just removing the param completely
            var newQsVal = null;

            if (value) {
                var oldQsVal = _getFiltersOrDefaults(field);
                if (oldQsVal && oldQsVal.length) {
                    newQsVal = _.without(oldQsVal, value);
                }
                if (!newQsVal || !newQsVal.length || _matchesDefaults(field, newQsVal)) {
                    newQsVal = null;
                }
                $log.debug("remove set " + _withPrefix(field) + " from " + oldQsVal + " to " + newQsVal);
            }
            $location.search(_withPrefix(field), newQsVal);
        };

        var replaceFilter = function(field, value) {
            //check for existing value
            $log.debug("add set " + _withPrefix(field) + " to " + value);
            $location.search(_withPrefix(field), value);
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
            // Don't emit the filter changed state here: we'll
            // do that when the URL change signal gets fired (see
            // the locationChangeSuccess event, above)
        };

        var toggleInProgress = function() {
            toggleResultStatuses(['pending', 'running']);
        };

        var toggleResultStatuses = function(resultStatuses) {
            var rsValues = _getFiltersOrDefaults(RESULT_STATUS);
            if (_.difference(resultStatuses, rsValues).length === 0) {
                rsValues = _.difference(rsValues, resultStatuses);
            } else {
                rsValues = _.uniq(rsValues.concat(resultStatuses));
            }
            // remove all query string params for this field if we match the defaults
            if (_matchesDefaults(RESULT_STATUS, rsValues)) {
                rsValues = null;
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

        var isFilterSetToShow = function(field, value) {
            return _.contains(_getFiltersOrDefaults(field), String(value));
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
            locationSearch[QS_CLASSIFIED_STATE]= DEFAULTS.classifiedState.slice();
            $location.search(locationSearch);
        };

        var getClassifiedStateArray = function() {
            var arr = _toArray($location.search()[QS_CLASSIFIED_STATE]) ||
                DEFAULTS.classifiedState;
            return arr.slice();
        };

        /**
         * Used externally to display the field filters.  Internally, we treat
         * the ``searchStr`` as a field filter, but the we don't want to expose
         * that outside of this class in this function.
         */
        var getFieldFiltersArray = function() {
            var fieldFilters = [];

            _.each($location.search(), function(values, fieldName) {
                if (_isFieldFilter(fieldName)) {
                    var valArr = _toArray(values);
                    _.each(valArr, function (val) {
                        if (fieldName !== QS_SEARCH_STR) {
                            fieldFilters.push({field: _withoutPrefix(fieldName),
                                               value: val});
                        }
                    });
                }
            });
            return fieldFilters;
        };

        var getFieldChoices = function() {
            var choices = _.clone(FIELD_CHOICES);
            delete choices.searchStr;
            return choices;
        };

        var getResultStatusArray = function() {
            var arr = _toArray($location.search()[QS_RESULT_STATUS]) ||
                DEFAULTS.resultStatus;
            return arr.slice();
        };

        var isJobUnclassifiedFailure = function(job) {
            return (_.contains(thFailureResults, job.result) &&
                    !_isJobClassified(job));
        };

        var _isJobClassified = function(job) {
            return !_.contains(UNCLASSIFIED_IDS, job.failure_classification_id);
        };

        var stripFiltersFromQueryString = function(locationSearch) {
            delete locationSearch[QS_CLASSIFIED_STATE];
            delete locationSearch[QS_RESULT_STATUS];

            _stripFieldFilters(locationSearch);
            return locationSearch;
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
            return _startsWith(field, PREFIX) &&
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
                result = thPlatformName(result) + " " + job.platform_option;
            }
            return result;
        };

        /**
         * check if we're in the state of showing only unclassified failures
         */
        var _isUnclassifiedFailures = function() {
            return (_.isEqual(_toArray($location.search()[QS_RESULT_STATUS]), thFailureResults) &&
                    _.isEqual(_toArray($location.search()[QS_CLASSIFIED_STATE]), ['unclassified']));
        };

        var _matchesDefaults = function(field, values) {
            $log.debug("_matchesDefaults", field, values);
            if (DEFAULTS.hasOwnProperty(field)) {
                return values.length === DEFAULTS[field].length &&
                    _.intersection(DEFAULTS[field], values).length === DEFAULTS[field].length;
            }
            return false;
        };

        var _withPrefix = function(field) {
            if (!_startsWith(field, PREFIX)) {
                return PREFIX+field;
            } else {
                return field;
            }
        };

        var _withoutPrefix = function(field) {
            if (_startsWith(field, PREFIX)) {
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

        var _containsAllSubstr = function(arr, val) {
            for (var i = 0; i < arr.length; i++) {
                if (val.indexOf(arr[i]) === -1) {
                    return false;
                }
            }
            return true;
        };

        var _toArray = function(value) {
            if (_.isUndefined(value)) {
                return value;
            }
            if (!_.isArray(value)) {
                return [value];
            }
            return value;
        };

        var _startsWith = function(str, val) {
            return str.indexOf(val) === 0;
        };

        // initialize caches on initial load
        cachedFilterParams = getNewFilterParams();
        _refreshFilterCaches();

        /*********************************
         * Externally available API fields
         */

        var api = {
            // check a job against the filters
            showJob: showJob,

            // filter changing accessors
            addFilter: addFilter,
            removeFilter: removeFilter,
            replaceFilter: replaceFilter,
            removeAllFieldFilters: removeAllFieldFilters,
            resetNonFieldFilters: resetNonFieldFilters,
            toggleFilters: toggleFilters,
            toggleResultStatuses: toggleResultStatuses,
            toggleInProgress: toggleInProgress,
            toggleUnclassifiedFailures: toggleUnclassifiedFailures,
            setOnlyCoalesced: setOnlyCoalesced,

            // filter data read-only accessors
            getClassifiedStateArray: getClassifiedStateArray,
            getFieldFiltersArray: getFieldFiltersArray,
            getFieldFiltersObj: getFieldFiltersObj,
            getResultStatusArray: getResultStatusArray,
            isJobUnclassifiedFailure: isJobUnclassifiedFailure,
            isFilterSetToShow: isFilterSetToShow,
            stripFiltersFromQueryString: stripFiltersFromQueryString,
            getFieldChoices: getFieldChoices,

            // CONSTANTS
            classifiedState: CLASSIFIED_STATE,
            resultStatus: RESULT_STATUS,
            tiers: TIERS
        };
        return api;
    }]);
