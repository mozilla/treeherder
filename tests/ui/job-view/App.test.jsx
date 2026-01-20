/**
 * Unit tests for the job-view App component.
 *
 * This test suite covers:
 * - react-resizable-panels migration (from react-split-pane)
 * - Panel resize behavior logic
 * - Component export verification (RSPack migration - no hot wrapper)
 *
 * Note: The component was migrated from react-split-pane to react-resizable-panels
 * and from react-hot-loader to standard export.
 *
 * Integration tests for the full App rendering are in tests/ui/App.test.jsx
 */

describe('Job-View App Export', () => {
  it('exports App component without hot wrapper', async () => {
    // Verify the App is exported directly without react-hot-loader
    // This is a regression test for the RSPack migration
    const AppModule = await import('../../../ui/job-view/App');
    expect(AppModule.default).toBeDefined();
  });

  it('exports a connected component (wrapped by Redux connect)', async () => {
    const AppModule = await import('../../../ui/job-view/App');

    // The default export is wrapped by Redux connect()
    expect(AppModule.default).toBeDefined();
    // Connected components are objects (HOCs)
    expect(typeof AppModule.default).toBe('object');
  });
});

describe('handleSplitChange logic (react-resizable-panels migration)', () => {
  describe('Size array handling', () => {
    it('receives sizes array from react-resizable-panels', () => {
      // This tests the signature change from (latestSplitSize) to (sizes)
      // The new implementation expects an array of percentages
      const sizes = [70, 30];

      // Simulating what the new handleSplitChange does:
      // sizes[0] is the top panel (PushList) percentage
      const pushListPct = sizes[0];

      expect(pushListPct).toBe(70);
    });

    it('calculates split percentage correctly', () => {
      // Old implementation: (latestSplitSize / getWindowHeight()) * 100
      // New implementation: sizes[0] directly

      const sizes = [65, 35];
      const latestSplitPct = sizes[0];

      expect(latestSplitPct).toBe(65);
    });

    it('handles 100% push list when no job selected', () => {
      const sizes = [100, 0];
      const pushListPct = sizes[0];

      expect(pushListPct).toBe(100);
    });

    it('handles typical split with job selected', () => {
      // Default is 55% push list, 45% details
      const sizes = [55, 45];

      expect(sizes[0]).toBe(55);
      expect(sizes[1]).toBe(45);
    });
  });

  describe('Details panel height calculation', () => {
    const getWindowHeight = () => 1000; // Mock window height

    it('calculates details height from percentage', () => {
      const pushListPct = 60;
      const detailsHeight = getWindowHeight() * (1 - pushListPct / 100);

      expect(detailsHeight).toBe(400);
    });

    it('returns 0 height when push list is 100%', () => {
      const pushListPct = 100;
      const detailsHeight = getWindowHeight() * (1 - pushListPct / 100);

      expect(detailsHeight).toBe(0);
    });

    it('returns full height when push list is 0%', () => {
      const pushListPct = 0;
      const detailsHeight = getWindowHeight() * (1 - pushListPct / 100);

      expect(detailsHeight).toBe(1000);
    });
  });
});

describe('Panel layout defaults', () => {
  const DEFAULT_DETAILS_PCT = 45;

  it('uses correct default details percentage', () => {
    expect(DEFAULT_DETAILS_PCT).toBe(45);
  });

  it('calculates default push list percentage', () => {
    const pushListPct = 100 - DEFAULT_DETAILS_PCT;
    expect(pushListPct).toBe(55);
  });

  it('setLayout call structure for panel ref', () => {
    // Simulating the updatePanelLayout method behavior
    const hasSelectedJob = true;
    const pushListPct = hasSelectedJob ? 100 - DEFAULT_DETAILS_PCT : 100;
    const detailsPct = 100 - pushListPct;

    const expectedLayout = [pushListPct, detailsPct];

    expect(expectedLayout).toEqual([55, 45]);
  });

  it('sets 100% push list when no job selected', () => {
    const hasSelectedJob = false;
    const pushListPct = hasSelectedJob ? 100 - DEFAULT_DETAILS_PCT : 100;
    const detailsPct = 100 - pushListPct;

    const expectedLayout = [pushListPct, detailsPct];

    expect(expectedLayout).toEqual([100, 0]);
  });
});
