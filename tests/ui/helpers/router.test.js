import { updateUrlSearch, replaceUrlSearch } from '../../../ui/helpers/router';

describe('updateUrlSearch', () => {
  const originalPushState = window.history.pushState;
  let pushStateCalls = [];

  beforeEach(() => {
    pushStateCalls = [];
    window.history.pushState = jest.fn((...args) => {
      pushStateCalls.push(args);
    });
  });

  afterEach(() => {
    window.history.pushState = originalPushState;
  });

  it('calls pushState with the correct URL', () => {
    updateUrlSearch('repo=autoland&revision=abc123');

    expect(window.history.pushState).toHaveBeenCalledTimes(1);
    expect(pushStateCalls[0][2]).toBe(
      `${window.location.pathname}?repo=autoland&revision=abc123`,
    );
  });

  it('passes empty object as state', () => {
    updateUrlSearch('test=value');

    expect(pushStateCalls[0][0]).toEqual({});
  });

  it('handles empty search string', () => {
    updateUrlSearch('');

    expect(pushStateCalls[0][2]).toBe(`${window.location.pathname}?`);
  });

  it('handles search with special characters', () => {
    updateUrlSearch('author=test%40example.com&msg=hello+world');

    expect(pushStateCalls[0][2]).toBe(
      `${window.location.pathname}?author=test%40example.com&msg=hello+world`,
    );
  });
});

describe('replaceUrlSearch', () => {
  const originalReplaceState = window.history.replaceState;
  let replaceStateCalls = [];

  beforeEach(() => {
    replaceStateCalls = [];
    window.history.replaceState = jest.fn((...args) => {
      replaceStateCalls.push(args);
    });
  });

  afterEach(() => {
    window.history.replaceState = originalReplaceState;
  });

  it('calls replaceState with the correct URL', () => {
    replaceUrlSearch('repo=try&selectedJob=12345');

    expect(window.history.replaceState).toHaveBeenCalledTimes(1);
    expect(replaceStateCalls[0][2]).toBe(
      `${window.location.pathname}?repo=try&selectedJob=12345`,
    );
  });

  it('passes empty object as state', () => {
    replaceUrlSearch('test=value');

    expect(replaceStateCalls[0][0]).toEqual({});
  });

  it('handles empty search string', () => {
    replaceUrlSearch('');

    expect(replaceStateCalls[0][2]).toBe(`${window.location.pathname}?`);
  });
});
