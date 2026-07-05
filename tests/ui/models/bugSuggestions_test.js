import fetchMock from 'fetch-mock';

import BugSuggestionsModel, {
  bugSuggestionsCache,
  BUG_SUGGESTIONS_CACHE_LIMIT,
  BUG_SUGGESTIONS_CACHE_TTL_MS,
} from '../../../ui/models/bugSuggestions';
import { getProjectJobUrl } from '../../../ui/helpers/location';

describe('BugSuggestionsModel', () => {
  const jobUrl = (jobId) => getProjectJobUrl('/bug_suggestions/', jobId);
  const sampleSuggestions = [{ search: 'a failure', bugs: { open_recent: [] } }];

  afterEach(() => {
    fetchMock.reset();
    bugSuggestionsCache.clear();
  });

  test('caches non-empty results so a repeat get does not refetch', async () => {
    fetchMock.get(jobUrl(1), sampleSuggestions);

    const first = await BugSuggestionsModel.get(1);
    expect(first).toEqual(sampleSuggestions);
    expect(fetchMock.calls(jobUrl(1))).toHaveLength(1);

    const second = await BugSuggestionsModel.get(1);
    expect(second).toEqual(sampleSuggestions);
    // Served from cache; still only the one network call.
    expect(fetchMock.calls(jobUrl(1))).toHaveLength(1);
  });

  test('does not cache empty results, so a still-parsing job refetches', async () => {
    fetchMock.get(jobUrl(2), []);

    await BugSuggestionsModel.get(2);
    await BugSuggestionsModel.get(2);

    // Empty results are never cached, so both calls hit the network.
    expect(fetchMock.calls(jobUrl(2))).toHaveLength(2);
  });

  test('refetches once a cached entry is older than the TTL', async () => {
    fetchMock.get(jobUrl(3), sampleSuggestions);

    await BugSuggestionsModel.get(3);
    expect(fetchMock.calls(jobUrl(3))).toHaveLength(1);

    // Age the cached entry past its TTL.
    bugSuggestionsCache.get(3).timestamp -= BUG_SUGGESTIONS_CACHE_TTL_MS + 1;

    await BugSuggestionsModel.get(3);
    // Expired -> refetched.
    expect(fetchMock.calls(jobUrl(3))).toHaveLength(2);
  });

  test('evicts the oldest entry once the cache limit is exceeded', async () => {
    // Fill the cache to its limit with distinct jobIds.
    for (let jobId = 1; jobId <= BUG_SUGGESTIONS_CACHE_LIMIT; jobId++) {
      fetchMock.get(jobUrl(jobId), sampleSuggestions);
      await BugSuggestionsModel.get(jobId);
    }
    expect(bugSuggestionsCache.size).toBe(BUG_SUGGESTIONS_CACHE_LIMIT);
    expect(bugSuggestionsCache.has(1)).toBe(true);

    // One more job evicts the oldest (jobId 1).
    const overflowId = BUG_SUGGESTIONS_CACHE_LIMIT + 1;
    fetchMock.get(jobUrl(overflowId), sampleSuggestions);
    await BugSuggestionsModel.get(overflowId);

    expect(bugSuggestionsCache.size).toBe(BUG_SUGGESTIONS_CACHE_LIMIT);
    expect(bugSuggestionsCache.has(1)).toBe(false);
    expect(bugSuggestionsCache.has(overflowId)).toBe(true);
  });
});
