export const FILTER_PRESETS_STORAGE_KEY = 'thFilterPresets';
export const COACH_MARK_STORAGE_KEY = 'thAdvancedFilterCoachMarkSeen';
export const TYPEAHEAD_MAX_SUGGESTIONS = 20;

// filter field -> property on job objects in pushesStore.jobMap
export const TYPEAHEAD_FIELDS = {
  platform: 'platform',
  job_type_name: 'job_type_name',
  job_type_symbol: 'job_type_symbol',
  job_group_name: 'job_group_name',
  job_group_symbol: 'job_group_symbol',
};

// How far back the lazy push fetch looks for author/revision suggestions,
// and how many suggestions a datalist may hold (native datalist filters by
// typed prefix, so a generous cap keeps deep matches reachable).
export const PUSH_SUGGESTIONS_DAYS = 4;
export const PUSH_SUGGESTIONS_MAX = 200;

export const DATE_RANGE_PRESETS = [
  { label: 'last day', days: 1 },
  { label: '2 days', days: 2 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
];
