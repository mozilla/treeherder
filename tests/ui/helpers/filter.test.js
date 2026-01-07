import {
  thDefaultFilterResultStatuses,
  thFieldChoices,
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
});
