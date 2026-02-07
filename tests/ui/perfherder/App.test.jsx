/**
 * Tests for the Perfherder App component.
 *
 * This test suite covers:
 * - Component export validation (no react-hot-loader wrapper)
 * - Component structure verification
 *
 * Note: Integration tests for Perfherder App are in the integration folder.
 * Unit tests focus on the export/structure to verify RSPack migration.
 */

describe('Perfherder App Export', () => {
  it('exports App component without hot wrapper', async () => {
    // Verify the App is exported directly without react-hot-loader
    // This is a regression test for the RSPack migration
    const AppModule = await import('../../../ui/perfherder/App');
    expect(AppModule.default).toBeDefined();

    // The default export should be a React component, not wrapped in hot()
    // Hot-wrapped components have a different structure
    expect(typeof AppModule.default).toBe('function');
  });

  it('is a functional component', async () => {
    const AppModule = await import('../../../ui/perfherder/App');

    // Verify it's a functional component (no prototype.render)
    expect(AppModule.default).toBeDefined();
    expect(typeof AppModule.default).toBe('function');
    // Functional components don't have prototype.render
    expect(AppModule.default.prototype?.render).toBeUndefined();
  });

  it('is a valid React component', async () => {
    const AppModule = await import('../../../ui/perfherder/App');

    // Verify it's a valid React component function
    // Functional components are just functions
    expect(typeof AppModule.default).toBe('function');
    // Functional components don't have isReactComponent on prototype
    expect(AppModule.default.prototype?.isReactComponent).toBeUndefined();
  });
});
