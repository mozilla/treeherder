import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Per-tab controls for the jobs-view push/job polling lifecycle.
// - keepAlive: user opted (via the toolbar coffee mug) to keep a backgrounded
//   tab polling for the longer idle window. Default off, not persisted, so a
//   forgotten tab is never accidentally kept alive.
// - pollingPaused: polling has been stopped because the tab sat in the
//   background past its idle limit. Cleared automatically when the tab is
//   brought back to the foreground.
export const usePollControlStore = create(
  devtools(
    (set) => ({
      keepAlive: false,
      pollingPaused: false,

      setKeepAlive: (keepAlive) => set({ keepAlive }),
      toggleKeepAlive: () => set((state) => ({ keepAlive: !state.keepAlive })),
      setPollingPaused: (pollingPaused) => set({ pollingPaused }),
    }),
    { name: 'poll-control-store' },
  ),
);

// Standalone functions for use outside React components.
export const setKeepAlive = (keepAlive) =>
  usePollControlStore.getState().setKeepAlive(keepAlive);
export const toggleKeepAlive = () =>
  usePollControlStore.getState().toggleKeepAlive();
export const setPollingPaused = (pollingPaused) =>
  usePollControlStore.getState().setPollingPaused(pollingPaused);
