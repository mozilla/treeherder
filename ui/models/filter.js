import cloneDeep from 'lodash/cloneDeep';

import {
  thDefaultRepo,
  thFailureResults,
  thPlatformMap,
} from '../helpers/constants';
import { isClassified } from '../helpers/job';
import {
  arraysEqual,
  matchesDefaults,
  thFieldChoices,
  thMatchType,
  thFilterDefaults,
  deprecatedThFilterPrefix,
  allFilterParams,
} from '../helpers/filter';
import { getAllUrlParams } from '../helpers/location';

export const getNonFilterUrlParams = () =>
  [...getAllUrlParams().entries()].reduce(
    (acc, [urlField, urlValue]) =>
      allFilterParams.includes(urlField.replace(deprecatedThFilterPrefix, ''))
        ? acc
        : { ...acc, [urlField]: urlValue },
    {},
  );

export const getFilterUrlParamsWithDefaults = () => {
  // Group multiple values for the same field into an array of values.
  // This handles the transition from our old url params to this newer, more
  // terse version.
  // Also remove usage of the 'filter-' prefix.
  const groupedValues = [...getAllUrlParams().entries()].reduce(
    (acc, [urlField, urlValue]) => {
      const field = urlField.replace(deprecatedThFilterPrefix, '');
      if (!allFilterParams.includes(field)) {
        return acc;
      }
      const value =
        field === 'author' ? [urlValue] : urlValue.toLowerCase().split(/,| /);

      return field in acc
        ? { ...acc, [field]: [...acc[field], ...value] }
        : { ...acc, [field]: value };
    },
    {},
  );

  return { ...cloneDeep(thFilterDefaults), ...groupedValues };
};

export default class FilterModel {
  constructor() {
    this.urlParams = getFilterUrlParamsWithDefaults();
  }

  // If a param matches the defaults, then don't include it.
  getUrlParamsWithoutDefaults = () => {
    // ensure the repo param is always set
    const params = {
      repo: thDefaultRepo,
      ...getNonFilterUrlParams(),
      ...this.urlParams,
    };

    return Object.entries(params).reduce(
      (acc, [field, value]) =>
        value.length && !matchesDefaults(field, value)
          ? { ...acc, [field]: value }
          : acc,
      {},
    );
  };

  addFilter = (field, value) => {
    const currentValue = this.urlParams[field];

    if (currentValue) {
      // set the value to an array
      const newQsVal = !Array.isArray(currentValue)
        ? [currentValue]
        : currentValue;
      newQsVal.push(value);
      this.urlParams[field] = [...new Set(newQsVal)];
    } else {
      this.urlParams[field] = [value];
    }
    this.push();
  };

  // Also used for non-filter params
  removeFilter = (field, value) => {
    if (value) {
      const currentValue = this.urlParams[field];

      if (currentValue && currentValue.length) {
        this.urlParams[field] = currentValue.filter(
          filterValue => filterValue !== value,
        );
      }
    } else {
      delete this.urlParams[field];
    }
    this.push();
  };

  getFilterQueryString = () =>
    new URLSearchParams(this.getUrlParamsWithoutDefaults()).toString();

  /**
   * Push all the url params to the url.  Components listening for hashchange
   * will get updates.
   */
  push = () => {
    const { origin } = window.location;

    window.location.href = `${origin}/#/jobs?${this.getFilterQueryString()}`;
  };

  setOnlySuperseded = () => {
    this.urlParams.resultStatus = 'superseded';
    this.urlParams.classifiedState = [...thFilterDefaults.classifiedState];
    this.push();
  };

  toggleFilter = (field, value) => {
    const action = !this.urlParams[field].includes(value)
      ? this.addFilter
      : this.removeFilter;
    action(field, value);
  };

  toggleInProgress = () => {
    this.toggleResultStatuses(['pending', 'running']);
  };

  /**
   * If none or only some of the statuses here are on, then set them all to on.
   * If they ARE all on, then set them to off.
   */
  toggleResultStatuses = resultStatuses => {
    const currentResultStatuses = this.urlParams.resultStatus;
    const allOn = resultStatuses.every(rs =>
      currentResultStatuses.includes(rs),
    );
    this.urlParams.resultStatus = allOn
      ? currentResultStatuses.filter(rs => !resultStatuses.includes(rs))
      : [...new Set([...resultStatuses, ...currentResultStatuses])];

    this.push();
  };

  toggleClassifiedFilter = classifiedState => {
    this.toggleFilter('classifiedState', classifiedState);
  };

  toggleUnclassifiedFailures = () => {
    if (this.isUnclassifiedFailures()) {
      this.resetNonFieldFilters();
    } else {
      this.urlParams.resultStatus = [...thFailureResults];
      this.urlParams.classifiedState = ['unclassified'];
      this.push();
    }
  };

  replaceFilter = (field, value) => {
    this.urlParams[field] = !Array.isArray(value) ? [value] : value;
    this.push();
  };

  clearNonStatusFilters = () => {
    const { repo, resultStatus, classifiedState } = this.urlParams;

    this.urlParams = { repo, resultStatus, classifiedState };
    this.push();
  };

  /**
   * reset the non-field (checkbox in the ui) filters to the default state
   * so the user sees everything.  Doesn't affect the field filters.  This
   * is used to undo the call to ``setOnlyUnclassifiedFailures``.
   */
  resetNonFieldFilters = () => {
    const { resultStatus, classifiedState } = thFilterDefaults;

    this.urlParams.resultStatus = [...resultStatus];
    this.urlParams.classifiedState = [...classifiedState];
    this.push();
  };

  /**
   * Whether or not this job should be shown based on the current filters.
   *
   * @param job - the job we are checking against the filters
   */
  showJob = job => {
    // when runnable jobs have been added to a resultset, they should be
    // shown regardless of settings for classified or result state
    const { resultStatus } = job;

    if (resultStatus !== 'runnable') {
      // test against resultStatus and classifiedState
      if (!this.urlParams.resultStatus.includes(resultStatus)) {
        return false;
      }
      if (!this._checkClassifiedStateFilters(job)) {
        return false;
      }
    }
    // runnable or not, we still want to apply the field filters like
    // for symbol, platform, search str, etc...
    return this._checkFieldFilters(job);
  };

  _checkClassifiedStateFilters = job => {
    const { classifiedState } = this.urlParams;
    const isJobClassified = isClassified(job);

    if (!classifiedState.includes('unclassified') && !isJobClassified) {
      return false;
    }
    // If the filters say not to include classified, but it IS
    // classified, then return false, otherwise, true.
    return !(!classifiedState.includes('classified') && isJobClassified);
  };

  _checkFieldFilters = job =>
    Object.entries(this.urlParams).every(([field, values]) => {
      let jobFieldValue = this._getJobFieldValue(job, field);

      // If ``job`` does not have this field, then don't filter.
      // Consider it a pass.  i.e.: runnable jobs have no ``tier`` field.
      if (jobFieldValue) {
        // All filter values are stored as lower case strings
        jobFieldValue = String(jobFieldValue).toLowerCase();

        switch (thFieldChoices[field].matchType) {
          case thMatchType.substr:
            // at least ONE filter value must be a substring of this job's field.
            if (!values.some(val => jobFieldValue.includes(val))) {
              return false;
            }
            break;

          case thMatchType.searchStr:
            // ALL of the values must be in the searchStr for this job
            if (!values.every(val => jobFieldValue.includes(val))) {
              return false;
            }
            break;

          case thMatchType.exactstr:
          case thMatchType.choice:
            // ONE of the values must be an exact match for this job's field
            if (!values.includes(jobFieldValue)) {
              return false;
            }
            break;
        }
      }
      return true;
    });

  /**
   * Get the field from the job.  In most cases, this is very simple.  But
   * this allows for some special cases, like ``platform`` which
   * shows to the user as a different string than what is stored in the job
   * object.
   */
  _getJobFieldValue = (job, field) => {
    if (field === 'platform') {
      return `${thPlatformMap[job.platform] || job.platform} ${
        job.platform_option
      }`;
    }

    if (field === 'resultStatus') {
      // don't check this here.
      return null;
    }

    return job[field];
  };

  /**
   * check if we're in the state of showing only unclassified failures
   */
  isUnclassifiedFailures = () =>
    arraysEqual(this.urlParams.resultStatus, thFailureResults) &&
    arraysEqual(this.urlParams.classifiedState, ['unclassified']);
}
