import GraphsContainer from '../../../../ui/perfherder/graphs/GraphsContainer';

describe('GraphsContainer', () => {
  const buildInstance = () => {
    const instance = new GraphsContainer({
      // One minimal visible data point so initZoomDomain has x/y values.
      testData: [{ visible: true, data: [{ x: 1, y: 1 }] }],
      measurementUnits: new Set(),
      updateStateParams: () => {},
      timeRange: { value: 86400 },
    });
    // Stub the side-effecting mount helpers we are not exercising here.
    instance.addHighlights = () => {};
    instance.buildInitialRunsCache = () => {};
    instance.setState = () => {};
    return instance;
  };

  test('adds a resize listener on mount and removes the same handler on unmount', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const instance = buildInstance();

    instance.componentDidMount();
    const addedCall = addSpy.mock.calls.find(([type]) => type === 'resize');
    expect(addedCall).toBeDefined();

    instance.componentWillUnmount();
    const removedCall = removeSpy.mock.calls.find(
      ([type]) => type === 'resize',
    );
    expect(removedCall).toBeDefined();
    // The exact same handler reference must be removed, or the listener leaks.
    expect(removedCall[1]).toBe(addedCall[1]);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
