import { allFilterParams } from '../../../helpers/filter';

import {
  FILTER_PRESETS_STORAGE_KEY,
  COACH_MARK_STORAGE_KEY,
  PUSH_SUGGESTIONS_MAX,
  TYPEAHEAD_FIELDS,
  TYPEAHEAD_MAX_SUGGESTIONS,
} from './constants';

export const getFieldValueSuggestions = (jobMap, field) => {
  const jobProperty = TYPEAHEAD_FIELDS[field];

  if (!jobProperty) {
    return [];
  }
  const values = new Set();

  for (const job of Object.values(jobMap)) {
    if (job[jobProperty]) {
      values.add(job[jobProperty]);
    }
  }
  return [...values].sort().slice(0, TYPEAHEAD_MAX_SUGGESTIONS);
};

// Distinct author emails and short revision hashes from a list of push
// objects, for the push-range datalists. Revisions keep push order (most
// recent first) rather than sorting, since recency is the useful order.
export const getPushSuggestions = (pushes) => {
  const authors = new Set();
  const revisions = new Set();

  for (const push of pushes) {
    if (push.author) {
      authors.add(push.author);
    }
    if (push.revision) {
      revisions.add(push.revision.slice(0, 12));
    }
  }
  return {
    authors: [...authors].sort().slice(0, PUSH_SUGGESTIONS_MAX),
    revisions: [...revisions].slice(0, PUSH_SUGGESTIONS_MAX),
  };
};

export const isValidDate = (str) => !str || !Number.isNaN(Date.parse(str));

export const isValidDateRange = (start, end) =>
  isValidDate(start) &&
  isValidDate(end) &&
  (!start || !end || Date.parse(start) <= Date.parse(end));

export const getDateDaysAgo = (days) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const loadPresets = () => {
  try {
    return JSON.parse(localStorage.getItem(FILTER_PRESETS_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
};

const storePresets = (presets) => {
  try {
    localStorage.setItem(FILTER_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage is disabled/not supported; presets just won't persist.
  }
  return presets;
};

export const savePreset = (name, params) =>
  storePresets([...loadPresets().filter((p) => p.name !== name), { name, params }]);

export const deletePreset = (name) =>
  storePresets(loadPresets().filter((p) => p.name !== name));

export const buildPresetParams = (filterModel) =>
  Object.entries(filterModel.getUrlParamsWithoutDefaults()).reduce(
    (acc, [field, value]) =>
      field !== 'repo' && allFilterParams.includes(field)
        ? { ...acc, [field]: value }
        : acc,
    {},
  );

export const getPresetQueryString = (params, repo) =>
  new URLSearchParams({ repo, ...params }).toString();

export const getActiveFilterCount = (filterModel) =>
  Object.keys(buildPresetParams(filterModel)).filter((f) => f !== 'searchStr')
    .length;

export const hasSeenCoachMark = () => {
  try {
    return !!localStorage.getItem(COACH_MARK_STORAGE_KEY);
  } catch {
    // If storage is unavailable, treat as seen so we never nag on every load.
    return true;
  }
};

export const markCoachMarkSeen = () => {
  try {
    localStorage.setItem(COACH_MARK_STORAGE_KEY, '1');
  } catch {
    // Ignore; the coach mark will show again next session at worst.
  }
};
