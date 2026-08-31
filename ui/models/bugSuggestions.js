import { getProjectJobUrl } from '../helpers/location';

// Per-session, bounded cache of bug-suggestion responses keyed by jobId. The
// Failure Summary tab unmounts/remounts every time the user switches tabs (or
// re-selects a job), which would otherwise refetch and re-process the same
// suggestions on every remount. See ui/models/push.js `decisionTaskIdCache`
// for the same pattern.
//
// Entries carry a timestamp and expire after BUG_SUGGESTIONS_CACHE_TTL_MS so a
// long-lived session (e.g. a dashboard left open for days) eventually picks up
// a newly-filed bug once the backend's own cache has refreshed. The backend
// caches error summaries for 24h, so a shorter TTL here mostly bounds the
// worst case rather than surfacing new bugs faster.
export const bugSuggestionsCache = new Map();
export const BUG_SUGGESTIONS_CACHE_LIMIT = 50;
export const BUG_SUGGESTIONS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export default class BugSuggestionsModel {
  static async get(jobId) {
    const cached = bugSuggestionsCache.get(jobId);
    if (cached && Date.now() - cached.timestamp < BUG_SUGGESTIONS_CACHE_TTL_MS) {
      return cached.data;
    }

    const resp = await fetch(getProjectJobUrl('/bug_suggestions/', jobId));
    const suggestions = await resp.json();

    // Only cache meaningful results. An empty array means "no failures yet" or
    // "log parsing still in progress"; leaving those uncached lets a later
    // revisit pick up suggestions once the log finishes parsing.
    if (Array.isArray(suggestions) && suggestions.length > 0) {
      // A stale entry past its TTL is being replaced; drop it first so the
      // refreshed entry counts as the newest for eviction ordering.
      bugSuggestionsCache.delete(jobId);
      // Evict the oldest entry once we exceed the limit (Map preserves
      // insertion order).
      if (bugSuggestionsCache.size >= BUG_SUGGESTIONS_CACHE_LIMIT) {
        bugSuggestionsCache.delete(bugSuggestionsCache.keys().next().value);
      }
      bugSuggestionsCache.set(jobId, { data: suggestions, timestamp: Date.now() });
    }

    return suggestions;
  }
}
