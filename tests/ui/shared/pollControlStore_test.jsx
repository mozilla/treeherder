import {
  usePollControlStore,
  setKeepAlive,
  toggleKeepAlive,
  setPollingPaused,
} from '../../../ui/shared/stores/pollControlStore';

describe('pollControlStore', () => {
  beforeEach(() => {
    usePollControlStore.setState({ keepAlive: false, pollingPaused: false });
  });

  test('defaults to keep-alive off and not paused', () => {
    const state = usePollControlStore.getState();
    expect(state.keepAlive).toBe(false);
    expect(state.pollingPaused).toBe(false);
  });

  test('setKeepAlive and toggleKeepAlive update keepAlive', () => {
    setKeepAlive(true);
    expect(usePollControlStore.getState().keepAlive).toBe(true);

    toggleKeepAlive();
    expect(usePollControlStore.getState().keepAlive).toBe(false);
  });

  test('setPollingPaused updates pollingPaused', () => {
    setPollingPaused(true);
    expect(usePollControlStore.getState().pollingPaused).toBe(true);
  });
});
