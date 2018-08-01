/* eslint-disable no-use-before-define */

import _ from 'lodash';
import intersection from 'lodash/intersection';
import difference from 'lodash/difference';

import treeherder from '../treeherder';
import { getStatus } from '../../helpers/job';
import { thFailureResults, thDefaultFilterResultStatuses, thEvents } from '../constants';

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
    '$rootScope', '$location',
    '$timeout',
    'thClassificationTypes',
    'thPlatformName',
    function (
        $rootScope, $location,
        $timeout,
        thClassificationTypes,
        thPlatformName) {

        // prefix for all filter query string params
        const PREFIX = 'filter-';

        // constants for specific types of filters
        const CLASSIFIED_STATE = 'classifiedState';
        const RESULT_STATUS = 'resultStatus';
        const SEARCH_STR = 'searchStr';

        const QS_CLASSIFIED_STATE = PREFIX + CLASSIFIED_STATE;
        const QS_RESULT_STATUS = PREFIX + RESULT_STATUS;
        const QS_SEARCH_STR = PREFIX + SEARCH_STR;

        // default filter values, when a filter is not specified in the query string
        const DEFAULTS = {
            resultStatus: thDefaultFilterResultStatuses,
            classifiedState: ['classified', 'unclassified'],
            tier: ['1', '2'],
        };

        const NON_FIELD_FILTERS = ['fromchange', 'tochange', 'author',
            'nojobs', 'startdate', 'enddate', 'revision'];

        // failure classification ids that should be shown in "unclassified" mode
        const UNCLASSIFIED_IDS = [1, 7];

        const TIERS = ['1', '2', '3'];

        // used with field-filters to determine how to match the value against the
        // job field.
        const MATCH_TYPE = {
            exactstr: 'exactstr',
            substr: 'substr', // returns true if any values match the substring
            searchStr: 'searchStr', // returns true only if ALL the values match the substring
            choice: 'choice',
        };

        // choices available for the field filters
        const FIELD_CHOICES = {
            ref_data_name: {
                name: 'buildername/jobname',
                matchType: MATCH_TYPE.substr,
            },
            build_system_type: {
                name: 'build system',
                matchType: MATCH_TYPE.substr,
            },
            job_type_name: {
                name: 'job name',
                matchType: MATCH_TYPE.substr,
            },
            job_type_symbol: {
                name: 'job symbol',
                matchType: MATCH_TYPE.exactstr,
            },
            job_group_name: {
                name: 'group name',
                matchType: MATCH_TYPE.substr,
            },
            job_group_symbol: {
                name: 'group symbol',
                matchType: MATCH_TYPE.exactstr,
            },
            machine_name: {
                name: 'machine name',
                matchType: MATCH_TYPE.substr,
            },
            platform: {
                name: 'platform',
                matchType: MATCH_TYPE.substr,
            },
            tier: {
                name: 'tier',
                matchType: MATCH_TYPE.exactstr,
            },
            failure_classification_id: {
                name: 'failure classification',
                matchType: MATCH_TYPE.choice,
                choices: thClassificationTypes.classifications,
            },
            // text search across multiple fields
            searchStr: {
                name: 'search string',
                matchType: MATCH_TYPE.searchStr,
            },
        };

        const FILTER_GROUPS = {
          failures: thFailureResults.slice(),
          nonfailures: ['success', 'retry', 'usercancel', 'superseded'],
          'in progress': ['pending', 'running'],
        };

        // filter caches so that we only collect them when the filter params
        // change in the query string
        let cachedResultStatusFilters = {};
        let cachedClassifiedStateFilters = {};
        let cachedFieldFilters = {};
        let cachedFilterParams;

        /**
         * Checks for a filter change and, if detected, updates the cached filter
         * values from the query string.  Then publishes the global event
         * to re-render jobs.
         */
        $rootScope.$on('$locationChangeSuccess', function () {

            const newFilterParams = getNewFilterParams();
            if (!_.isEqual(cachedFilterParams, newFilterParams)) {
                cachedFilterParams = newFilterParams;
                refreshFilterCaches();
                $rootScope.$emit(thEvents.globalFilterChanged);
            }

        });

        function getNewFilterParams() {
            return _.pickBy($location.search(), function (value, field) {
                return field.startsWith(PREFIX);
            });
        }

        function refreshFilterCaches() {
            cachedResultStatusFilters = _getFiltersOrDefaults(RESULT_STATUS);
            cachedClassifiedStateFilters = _getFiltersOrDefaults(CLASSIFIED_STATE);
            cachedFieldFilters = getFieldFiltersObj();
        }

        function getFieldFiltersObj() {
            const fieldFilters = {};
            // get the search params and lay any defaults over it so we test
            // against those as well.
            const locationSearch = _.defaults({ ...$location.search() },
                                            _.mapKeys(DEFAULTS, function (value, key) {
                                                return _withPrefix(key);
                                            }));
            Object.entries(locationSearch).forEach(([field, values]) => {
                if (_isFieldFilter(field)) {
                    if (field === QS_SEARCH_STR) {
                        // we cache this one a little differently
                        fieldFilters[_withoutPrefix(field)] = decodeURIComponent(values).replace(/ +(?= )/g, ' ').toLowerCase().split(' ');
                    } else {
                        fieldFilters[_withoutPrefix(field)] = _toArray(values).map(v => String(v).toLowerCase());
                    }
                }
            });
            return fieldFilters;
        }

        function _getFiltersOrDefaults(field) {
            // NON_FIELD_FILTERS are filter params that don't have the prefix
            const qsField = NON_FIELD_FILTERS.includes(field) ? _withoutPrefix(field) : _withPrefix(field);
            const qsFieldSearch = $location.search()[qsField];
            const filters = (qsFieldSearch === undefined ? undefined : qsFieldSearch.slice());
            if (filters) {
                return _toArray(filters);
            } else if (DEFAULTS.hasOwnProperty(_withoutPrefix(field))) {
                return DEFAULTS[_withoutPrefix(field)].slice();
            }
            return [];
        }

        /**
         * Whether or not this job should be shown based on the current
         * filters.
         *
         * @param job - the job we are checking against the filters
         */
        function showJob(job) {
            // when runnable jobs have been added to a resultset, they should be
            // shown regardless of settings for classified or result state
            const status = getStatus(job);
            if (status !== 'runnable') {
                // test against resultStatus and classifiedState
                if (cachedResultStatusFilters.indexOf(status) === -1) {
                    return false;
                }
                if (!_checkClassifiedStateFilters(job)) {
                    return false;
                }
            }
            // runnable or not, we still want to apply the field filters like
            // for symbol, platform, search str, etc...
            return _checkFieldFilters(job);
        }

        function _checkClassifiedStateFilters(job) {
            const isClassified = _isJobClassified(job);
            if (!cachedClassifiedStateFilters.includes('unclassified') && !isClassified) {
                return false;
            }
            // If the filters say not to include classified, but it IS
            // classified, then return false, otherwise, true.
            return !(!cachedClassifiedStateFilters.includes('classified') && isClassified);
        }

        function _checkFieldFilters(job) {
          return Object.entries(cachedFieldFilters).every(([field, values]) => {
            let jobFieldValue = _getJobFieldValue(job, field);

            // If ``job`` does not have this field, then don't filter.
            // Consider it a pass.  i.e.: runnable jobs have no ``tier`` field.
            if (jobFieldValue) {
              // All filter values are stored as lower case strings
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
                  if (!values.includes(jobFieldValue)) {
                    return false;
                  }
                  break;

                case MATCH_TYPE.choice:
                  if (!values.includes(jobFieldValue)) {
                    return false;
                  }
                  break;
              }
            }
            return true;
          });
        }

        function addFilter(field, value) {
            // check for existing value
            const oldQsVal = _getFiltersOrDefaults(field);
            let newQsVal = null;

            // All filters support multiple values except NON_FIELD_FILTERS.
            if (oldQsVal && !NON_FIELD_FILTERS.includes(field)) {
                // set the value to an array
                newQsVal = _toArray(oldQsVal);
                newQsVal.push(value);
                newQsVal = [...new Set(newQsVal)];
            } else {
                newQsVal = value;
            }
            if (_matchesDefaults(field, newQsVal)) {
                newQsVal = null;
            }
            $timeout(() => $location.search(_withPrefix(field), newQsVal));
        }

        function removeFilter(field, value) {
            // default to just removing the param completely
            let newQsVal = null;

            if (value) {
                const oldQsVal = _getFiltersOrDefaults(field);
                if (oldQsVal && oldQsVal.length) {
                    newQsVal = oldQsVal.filter(filterValue => (filterValue !== value));
                }
                if (!newQsVal || !newQsVal.length || _matchesDefaults(field, newQsVal)) {
                    newQsVal = null;
                }
            }
            $timeout(() => $location.search(_withPrefix(field), newQsVal));
        }

        function replaceFilter(field, value) {
            // check for existing value
            $location.search(_withPrefix(field), value);
        }

        function clearAllFilters() {
            const locationSearch = $location.search();
            _stripFieldFilters(locationSearch);
            _stripClearableFieldFilters(locationSearch);
            $timeout(() => $location.search(locationSearch));
        }

        /**
         * reset the non-field (checkbox in the ui) filters to the default state
         * so the user sees everything.  Doesn't affect the field filters.  This
         * is used to undo the call to ``setOnlyUnclassifiedFailures``.
         */
        function resetNonFieldFilters() {
            const locationSearch = { ...$location.search() };
            delete locationSearch[QS_RESULT_STATUS];
            delete locationSearch[QS_CLASSIFIED_STATE];
            $timeout(() => $location.search(locationSearch));
        }

        /**
         * used mostly for resultStatus doing group toggles
         *
         * @param field
         * @param values - an array of values for the field
         * @param add - true if adding, false if removing
         */
        function toggleFilters(field, values, add) {
            const action = add ? addFilter : removeFilter;
            values.map(value => action(field, value));
            // Don't emit the filter changed state here: we'll
            // do that when the URL change signal gets fired (see
            // the locationChangeSuccess event, above)
        }

        function toggleInProgress() {
            toggleResultStatuses(['pending', 'running']);
        }

        function toggleResultStatuses(resultStatuses) {
            let rsValues = _getFiltersOrDefaults(RESULT_STATUS);
            if (difference(resultStatuses, rsValues).length === 0) {
                rsValues = difference(rsValues, resultStatuses);
            } else {
                rsValues = [...new Set(rsValues.concat(resultStatuses))];
            }
            // remove all query string params for this field if we match the defaults
            if (_matchesDefaults(RESULT_STATUS, rsValues)) {
                rsValues = null;
            }
            $timeout(() => $location.search(QS_RESULT_STATUS, rsValues));
        }

        function toggleClassifiedFilter(classifiedState) {
          const func = getClassifiedStateArray().includes(classifiedState) ? removeFilter : addFilter;
          func('classifiedState', classifiedState);
        }

        function toggleUnclassifiedFailures() {
            if (_isUnclassifiedFailures()) {
                resetNonFieldFilters();
            } else {
                setOnlyUnclassifiedFailures();
            }
        }

        /**
         * Set the non-field filters so that we only view unclassified failures
         */
        function setOnlyUnclassifiedFailures() {
            const locationSearch = { ...$location.search() };
            locationSearch[QS_RESULT_STATUS] = thFailureResults.slice();
            locationSearch[QS_CLASSIFIED_STATE] = ['unclassified'];
            $timeout(() => $location.search(locationSearch));
        }

        /**
         * Set the non-field filters so that we only view superseded jobs
         */
        function setOnlySuperseded() {
            const locationSearch = { ...$location.search() };
            locationSearch[QS_RESULT_STATUS] = 'superseded';
            locationSearch[QS_CLASSIFIED_STATE] = DEFAULTS.classifiedState.slice();
            $timeout(() => $location.search(locationSearch));
        }

        function getClassifiedStateArray() {
            const arr = _toArray($location.search()[QS_CLASSIFIED_STATE]) ||
                DEFAULTS.classifiedState;
            return arr.slice();
        }

        /**
         * Used externally to display the field filters.  Internally, we treat
         * the ``searchStr`` as a field filter, but the we don't want to expose
         * that outside of this class in this function.
         */
        function getFieldFiltersArray() {
            const fieldFilters = [];
            Object.entries($location.search()).forEach(([fieldName, values]) => {
                if (_isFieldFilter(fieldName)) {
                    const valArr = _toArray(values);
                    valArr.forEach((val) => {
                        if (fieldName !== QS_SEARCH_STR) {
                            fieldFilters.push({
                                field: _withoutPrefix(fieldName),
                                value: val,
                                key: fieldName,
                            });
                        }
                    });
                }
            });
            return fieldFilters;
        }

        function getNonFieldFiltersArray() {
            return Object.entries($location.search()).reduce((acc, [key, value]) => (
                NON_FIELD_FILTERS.includes(key) ? [...acc, { field: key, key, value }] : acc
            ), []);
        }

        function getFieldChoices() {
            const choices = { ...FIELD_CHOICES };
            delete choices.searchStr;
            return choices;
        }

        function getResultStatusArray() {
            const arr = _toArray($location.search()[QS_RESULT_STATUS]) ||
                DEFAULTS.resultStatus;
            return arr.slice();
        }

        function isJobUnclassifiedFailure(job) {
            return (thFailureResults.indexOf(job.result) !== -1 &&
                    !_isJobClassified(job));
        }

        function _isJobClassified(job) {
            return UNCLASSIFIED_IDS.indexOf(job.failure_classification_id) === -1;
        }

        /**
         * Removes field filters from the passed-in locationSearch without
         * actually setting it in the location bar
         */
        function _stripFieldFilters(locationSearch) {
            Object.keys(locationSearch).forEach((field) => {
                if (_isFieldFilter(field)) {
                    delete locationSearch[field];
                }
            });
            return locationSearch;
        }

        function _stripClearableFieldFilters(locationSearch) {
            Object.keys(locationSearch).forEach((field) => {
                if (_isClearableFilter(field)) {
                    delete locationSearch[field];
                }
            });
            return locationSearch;
        }

        function _isFieldFilter(field) {
            return field.startsWith(PREFIX) &&
                ['resultStatus', 'classifiedState'].indexOf(_withoutPrefix(field)) === -1;
        }

        function _isClearableFilter(field) {
            return NON_FIELD_FILTERS.indexOf(field) !== -1;
        }

        /**
         * Get the field from the job.  In most cases, this is very simple.  But
         * this function allows for some special cases, like ``platform`` which
         * shows to the user as a different string than what is stored in the job
         * object.
         */
        function _getJobFieldValue(job, field) {
            if (field === 'platform') {
                return thPlatformName(job[field]) + ' ' + job.platform_option;
            } else if (field === 'searchStr') {
                // lazily get this to avoid storing redundant information
                return job.getSearchStr();
            }

            return job[field];
        }

        /**
         * check if we're in the state of showing only unclassified failures
         */
        function _isUnclassifiedFailures() {
            return (_.isEqual(_toArray($location.search()[QS_RESULT_STATUS]), thFailureResults) &&
                    _.isEqual(_toArray($location.search()[QS_CLASSIFIED_STATE]), ['unclassified']));
        }

        function _matchesDefaults(field, values) {
            field = _withoutPrefix(field);
            if (DEFAULTS.hasOwnProperty(field)) {
                return values.length === DEFAULTS[field].length &&
                    intersection(DEFAULTS[field], values).length === DEFAULTS[field].length;
            }
            return false;
        }

        function _withPrefix(field) {
            return (!field.startsWith(PREFIX) && !NON_FIELD_FILTERS.includes(field)) ? PREFIX + field : field;
        }

        function _withoutPrefix(field) {
            return field.startsWith(PREFIX) ? field.replace(PREFIX, '') : field;
        }

        /**
         * Check the array if any elements contain a match for the ``val`` as a
         * substring.  These functions exist so we aren't creating functions
         * in a loop.
         */
        function _containsSubstr(arr, val) {
            return arr.some(arVal => val.includes(arVal));
        }

        function _containsAllSubstr(arr, val) {
            return arr.every(arVal => val.includes(arVal));
        }

        function _toArray(value) {
            if (value === undefined) {
                return value;
            }
            if (!Array.isArray(value)) {
                return [value];
            }
            return value;
        }

        // initialize caches on initial load
        cachedFilterParams = getNewFilterParams();
        refreshFilterCaches();

        // returns active filters starting with the prefix
        function getActiveFilters() {
            const filters = {};
            Object.keys($location.search()).forEach(function (key) {
                if (key.startsWith(PREFIX)) {
                    filters[key] = $location.search()[key];
                }
            });
            return filters;
        }

        /**
         * Externally available API fields
         */

        return {
            // check a job against the filters
            showJob: showJob,

            // refresh the filter caches before an operation
            refreshFilterCaches: refreshFilterCaches,

            // filter changing accessors
            addFilter: addFilter,
            removeFilter: removeFilter,
            replaceFilter: replaceFilter,
            resetNonFieldFilters: resetNonFieldFilters,
            clearAllFilters: clearAllFilters,
            toggleFilters: toggleFilters,
            toggleResultStatuses: toggleResultStatuses,
            toggleInProgress: toggleInProgress,
            toggleUnclassifiedFailures: toggleUnclassifiedFailures,
            toggleClassifiedFilter: toggleClassifiedFilter,
            setOnlySuperseded: setOnlySuperseded,
            getActiveFilters: getActiveFilters,

            // filter data read-only accessors
            getClassifiedStateArray: getClassifiedStateArray,
            getNonFieldFiltersArray: getNonFieldFiltersArray,
            getFieldFiltersArray: getFieldFiltersArray,
            getFieldFiltersObj: getFieldFiltersObj,
            getResultStatusArray: getResultStatusArray,
            isJobUnclassifiedFailure: isJobUnclassifiedFailure,
            getFieldChoices: getFieldChoices,

            // CONSTANTS
            filterGroups: FILTER_GROUPS,
            classifiedState: CLASSIFIED_STATE,
            resultStatus: RESULT_STATUS,
            tiers: TIERS,
        };
    }]);
