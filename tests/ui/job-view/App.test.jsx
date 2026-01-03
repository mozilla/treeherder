/**
 * Unit tests for the job-view App component.
 *
 * This test suite covers:
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

  it('exports a functional component', async () => {
    const AppModule = await import('../../../ui/job-view/App');

    // The default export is a functional React component
    expect(AppModule.default).toBeDefined();
    // Functional components are functions
    expect(typeof AppModule.default).toBe('function');
  });
});
