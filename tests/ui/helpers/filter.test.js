import { thAllResultStatuses } from '../../../ui/helpers/constants';
import {
  thDefaultFilterResultStatuses,
  thFilterDefaults,
  thMatchType,
  thFieldChoices,
  thFilterGroups,
  arraysEqual,
  matchesDefaults,
  getFieldChoices,
  hasUrlFilterChanges,
  reloadOnChangeParameters,
  allFilterParams,
} from '../../../ui/helpers/filter';

describe('matchesDefaults', () => {
  it('returns true when resultStatus matches defaults', () => {
    expect(matchesDefaults('resultStatus', thDefaultFilterResultStatuses)).toBe(
      true,
    );
  });

  it('returns true when classifiedState matches defaults', () => {
    expect(
      matchesDefaults('classifiedState', ['classified', 'unclassified']),
    ).toBe(true);
  });

  it('returns true when tier matches defaults', () => {
    expect(matchesDefaults('tier', ['1', '2'])).toBe(true);
  });

  it('returns false when values do not match defaults', () => {
    expect(matchesDefaults('resultStatus', ['success'])).toBe(false);
  });

  it('returns false for unknown fields', () => {
    expect(matchesDefaults('unknownField', ['value'])).toBe(false);
  });

  it('handles order-independent comparison', () => {
    expect(matchesDefaults('tier', ['2', '1'])).toBe(true);
  });
});

describe('getFieldChoices', () => {
  it('returns field choices without searchStr', () => {
    const choices = getFieldChoices();

    expect(choices.searchStr).toBeUndefined();
    expect(choices.job_type_name).toBeDefined();
    expect(choices.platform).toBeDefined();
  });

  it('does not modify the original thFieldChoices', () => {
    getFieldChoices();

    expect(thFieldChoices.searchStr).toBeDefined();
  });
});

describe('hasUrlFilterChanges', () => {
  it('returns false for identical URLs', () => {
    const url = '?repo=autoland&resultStatus=success';
    expect(hasUrlFilterChanges(url, url)).toBe(false);
  });

  it('returns true when filter parameter changes', () => {
    const oldUrl = '?repo=autoland&resultStatus=success';
    const newUrl = '?repo=autoland&resultStatus=testfailed';
    expect(hasUrlFilterChanges(oldUrl, newUrl)).toBe(true);
  });

  it('returns true when repo changes', () => {
    const oldUrl = '?repo=autoland';
    const newUrl = '?repo=try';
    expect(hasUrlFilterChanges(oldUrl, newUrl)).toBe(true);
  });

  it('returns false when non-filter parameters change', () => {
    const oldUrl = '?repo=autoland&selectedJob=123';
    const newUrl = '?repo=autoland&selectedJob=456';
    expect(hasUrlFilterChanges(oldUrl, newUrl)).toBe(false);
  });

  it('returns true when classifiedState changes', () => {
    const oldUrl = '?classifiedState=classified';
    const newUrl = '?classifiedState=unclassified';
    expect(hasUrlFilterChanges(oldUrl, newUrl)).toBe(true);
  });

  it('returns true when author filter is added', () => {
    const oldUrl = '?repo=autoland';
    const newUrl = '?repo=autoland&author=test@example.com';
    expect(hasUrlFilterChanges(oldUrl, newUrl)).toBe(true);
  });

  it('handles empty URLs', () => {
    expect(hasUrlFilterChanges('', '')).toBe(false);
  });
});

describe('reloadOnChangeParameters', () => {
  it('includes repo', () => {
    expect(reloadOnChangeParameters).toContain('repo');
  });

  it('includes revision', () => {
    expect(reloadOnChangeParameters).toContain('revision');
  });

  it('includes author', () => {
    expect(reloadOnChangeParameters).toContain('author');
  });

  it('includes date range parameters', () => {
    expect(reloadOnChangeParameters).toContain('startdate');
    expect(reloadOnChangeParameters).toContain('enddate');
  });

  it('includes change range parameters', () => {
    expect(reloadOnChangeParameters).toContain('fromchange');
    expect(reloadOnChangeParameters).toContain('tochange');
  });
});

describe('allFilterParams', () => {
  it('includes field choices', () => {
    expect(allFilterParams).toContain('job_type_name');
    expect(allFilterParams).toContain('platform');
    expect(allFilterParams).toContain('tier');
  });

  it('includes filter defaults', () => {
    expect(allFilterParams).toContain('resultStatus');
    expect(allFilterParams).toContain('classifiedState');
  });

  it('includes reload parameters', () => {
    expect(allFilterParams).toContain('repo');
    expect(allFilterParams).toContain('revision');
    expect(allFilterParams).toContain('author');
  });

  it('thDefaultFilterResultStatuses contains expected statuses', () => {
    expect(thDefaultFilterResultStatuses).toContain('testfailed');
    expect(thDefaultFilterResultStatuses).toContain('busted');
    expect(thDefaultFilterResultStatuses).toContain('exception');
    expect(thDefaultFilterResultStatuses).toContain('success');
    expect(thDefaultFilterResultStatuses).toContain('retry');
    expect(thDefaultFilterResultStatuses).toContain('usercancel');
    expect(thDefaultFilterResultStatuses).toContain('running');
    expect(thDefaultFilterResultStatuses).toContain('pending');
    expect(thDefaultFilterResultStatuses).toContain('runnable');
  });
});

describe('thMatchType', () => {
  it('defines all expected match types', () => {
    expect(thMatchType.exactstr).toBe('exactstr');
    expect(thMatchType.substr).toBe('substr');
    expect(thMatchType.searchStr).toBe('searchStr');
    expect(thMatchType.choice).toBe('choice');
  });
});

describe('thFieldChoices', () => {
  it('contains job_type_name with substr match', () => {
    expect(thFieldChoices.job_type_name).toEqual({
      name: 'job name',
      matchType: 'substr',
    });
  });

  it('contains job_type_symbol with exactstr match', () => {
    expect(thFieldChoices.job_type_symbol).toEqual({
      name: 'job symbol',
      matchType: 'exactstr',
    });
  });

  it('contains platform with substr match', () => {
    expect(thFieldChoices.platform).toEqual({
      name: 'platform',
      matchType: 'substr',
    });
  });

  it('contains tier with exactstr match', () => {
    expect(thFieldChoices.tier).toEqual({
      name: 'tier',
      matchType: 'exactstr',
    });
  });

  it('contains searchStr field', () => {
    expect(thFieldChoices.searchStr).toEqual({
      name: 'search string',
      matchType: 'searchStr',
    });
  });
});

describe('thFilterDefaults', () => {
  it('has default resultStatus values', () => {
    expect(thFilterDefaults.resultStatus).toEqual(
      thDefaultFilterResultStatuses,
    );
  });

  it('has default classifiedState values', () => {
    expect(thFilterDefaults.classifiedState).toEqual([
      'classified',
      'unclassified',
    ]);
  });

  it('has default tier values', () => {
    expect(thFilterDefaults.tier).toEqual(['1', '2']);
  });
});

describe('thFilterGroups', () => {
  it('groups failures correctly', () => {
    expect(thFilterGroups.failures).toContain('testfailed');
    expect(thFilterGroups.failures).toContain('busted');
    expect(thFilterGroups.failures).toContain('exception');
  });

  it('groups nonfailures correctly', () => {
    expect(thFilterGroups.nonfailures).toEqual([
      'success',
      'retry',
      'usercancel',
      'superseded',
    ]);
  });

  it('groups in progress correctly', () => {
    expect(thFilterGroups['in progress']).toEqual(['pending', 'running']);
  });
});

describe('arraysEqual', () => {
  it('returns true for identical arrays', () => {
    expect(arraysEqual(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
  });

  it('returns true for arrays with same elements in different order', () => {
    expect(arraysEqual(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
  });

  it('returns false for arrays with different lengths', () => {
    expect(arraysEqual(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
  });

  it('returns false for arrays with different elements', () => {
    expect(arraysEqual(['a', 'b', 'c'], ['a', 'b', 'd'])).toBe(false);
  });

  it('handles empty arrays', () => {
    expect(arraysEqual([], [])).toBe(true);
  });

  it('handles single element arrays', () => {
    expect(arraysEqual(['a'], ['a'])).toBe(true);
    expect(arraysEqual(['a'], ['b'])).toBe(false);
  });
});
