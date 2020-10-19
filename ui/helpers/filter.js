import pick from 'lodash/pick';
import isEqual from 'lodash/isEqual';

import { thFailureResults } from './constants';
import { extractSearchString, parseQueryParams } from './url';

// used with field-filters to determine how to match the value against the
// job field.
export const thMatchType = {
  exactstr: 'exactstr',
  substr: 'substr', // returns true if any values match the substring
  searchStr: 'searchStr', // returns true only if ALL the values match the substring
  choice: 'choice',
};

// choices available for the field filters
export const thFieldChoices = {
  job_type_name: { name: 'job name', matchType: thMatchType.substr },
  job_type_symbol: { name: 'job symbol', matchType: thMatchType.exactstr },
  job_group_name: { name: 'group name', matchType: thMatchType.substr },
  job_group_symbol: { name: 'group symbol', matchType: thMatchType.exactstr },
  machine_name: { name: 'machine name', matchType: thMatchType.substr },
  platform: { name: 'platform', matchType: thMatchType.substr },
  tier: { name: 'tier', matchType: thMatchType.exactstr },
  test_paths: { name: 'test path', matchType: thMatchType.substr },
  failure_classification_id: {
    name: 'failure classification',
    matchType: thMatchType.choice,
  },
  // text search across multiple fields
  searchStr: { name: 'search string', matchType: thMatchType.searchStr },
};

export const thDefaultFilterResultStatuses = [
  'testfailed',
  'busted',
  'exception',
  'success',
  'retry',
  'usercancel',
  'running',
  'pending',
  'runnable',
];

// changes to the url for any of these fields should reload the page
// because it changes the query to the db
export const reloadOnChangeParameters = [
  'repo',
  'revision',
  'author',
  'fromchange',
  'tochange',
  'startdate',
  'enddate',
  'nojobs',
];

// default filter values, when a filter is not specified in the query string
export const thFilterDefaults = {
  resultStatus: thDefaultFilterResultStatuses,
  classifiedState: ['classified', 'unclassified'],
  tier: ['1', '2'],
};

export const allFilterParams = [
  ...Object.keys(thFieldChoices),
  ...Object.keys(thFilterDefaults),
  ...reloadOnChangeParameters,
];

// compare 2 arrays, but ignore order
export const arraysEqual = function arraysEqual(arr1, arr2) {
  return arr1.length === arr2.length && arr1.every((v) => arr2.includes(v));
};

export const matchesDefaults = function matchesDefaults(field, values) {
  const defaults = thFilterDefaults[field];

  return defaults ? arraysEqual(values, defaults) : false;
};

export const thFilterGroups = {
  failures: thFailureResults.slice(),
  nonfailures: ['success', 'retry', 'usercancel', 'superseded'],
  'in progress': ['pending', 'running'],
};

// searchStr is internally treated as a field filter, but we don't want it
// exposed as such externally.
export const getFieldChoices = function getFieldChoices() {
  const choices = { ...thFieldChoices };

  delete choices.searchStr;
  return choices;
};

export const hasUrlFilterChanges = function hasUrlFilterChanges(
  oldURL,
  newURL,
) {
  const oldFilters = pick(
    parseQueryParams(extractSearchString(oldURL)),
    allFilterParams,
  );
  const newFilters = pick(
    parseQueryParams(extractSearchString(newURL)),
    allFilterParams,
  );

  return !isEqual(oldFilters, newFilters);
};

// DEPRECATED: Used to convert from old filter format to new.
export const deprecatedThFilterPrefix = 'filter-';
