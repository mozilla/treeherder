import { updateUrlSearch, replaceUrlSearch } from '../../../ui/helpers/router';

describe('updateUrlSearch', () => {
  const originalPushState = window.history.pushState;
  const originalDispatchEvent = window.dispatchEvent;
  let pushStateCalls = [];
  let dispatchedEvents = [];

  beforeEach(() => {
    pushStateCalls = [];
    dispatchedEvents = [];
    window.history.pushState = jest.fn((...args) => {
      pushStateCalls.push(args);
    });
    window.dispatchEvent = jest.fn((event) => {
      dispatchedEvents.push(event);
    });
  });

  afterEach(() => {
    window.history.pushState = originalPushState;
    window.dispatchEvent = originalDispatchEvent;
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

  it('dispatches popstate event to notify React Router', () => {
    updateUrlSearch('repo=autoland');

    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchedEvents[0]).toBeInstanceOf(PopStateEvent);
  });

  it('normalizes search string with leading ? to avoid double ??', () => {
    updateUrlSearch('?repo=autoland&selectedTaskRun=abc.0');

    expect(pushStateCalls[0][2]).toBe(
      `${window.location.pathname}?repo=autoland&selectedTaskRun=abc.0`,
    );
  });
});

describe('replaceUrlSearch', () => {
  const originalReplaceState = window.history.replaceState;
  const originalDispatchEvent = window.dispatchEvent;
  let replaceStateCalls = [];
  let dispatchedEvents = [];

  beforeEach(() => {
    replaceStateCalls = [];
    dispatchedEvents = [];
    window.history.replaceState = jest.fn((...args) => {
      replaceStateCalls.push(args);
    });
    window.dispatchEvent = jest.fn((event) => {
      dispatchedEvents.push(event);
    });
  });

  afterEach(() => {
    window.history.replaceState = originalReplaceState;
    window.dispatchEvent = originalDispatchEvent;
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

  it('dispatches popstate event to notify React Router', () => {
    replaceUrlSearch('repo=autoland');

    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchedEvents[0]).toBeInstanceOf(PopStateEvent);
  });

  it('normalizes search string with leading ? to avoid double ??', () => {
    replaceUrlSearch('?repo=try&selectedTaskRun=xyz.1');

    expect(replaceStateCalls[0][2]).toBe(
      `${window.location.pathname}?repo=try&selectedTaskRun=xyz.1`,
    );
  });
});
