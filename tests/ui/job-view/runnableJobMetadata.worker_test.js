describe('runnable job metadata worker', () => {
  const artifact = 'https://taskcluster.example.com/full-task-graph.json';
  const originalOnMessage = self.onmessage;
  const originalFetch = global.fetch;
  const originalWorkerGlobalScope = global.WorkerGlobalScope;

  beforeEach(async () => {
    global.WorkerGlobalScope = class WorkerGlobalScope {};
    global.fetch = jest.fn();
    jest.spyOn(self, 'postMessage').mockImplementation(() => {});
    await jest.isolateModulesAsync(async () => {
      await import('../../../ui/job-view/pushes/runnableJobMetadata.worker');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    self.onmessage = originalOnMessage;
    global.fetch = originalFetch;
    global.WorkerGlobalScope = originalWorkerGlobalScope;
  });

  test('fetches the graph and projects metadata, including legacy chunk counts', async () => {
    const label = 'test-linux64/opt-mochitest-media-2';
    const unchunked = 'test-linux64/opt-single-task-2';
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        [label]: { task: { extra: { treeherder: { tier: 1 }, chunks: 4 } } },
        [unchunked]: {
          task: { extra: { treeherder: { tier: 1 }, chunks: { total: 1 } } },
        },
        'not-indexed-in-treeherder': { task: {} },
      }),
    });

    await self.onmessage({ data: artifact });

    expect(global.fetch).toHaveBeenCalledWith(artifact);
    expect(self.postMessage).toHaveBeenCalledWith({
      metadata: {
        [label]: {
          tier: 1,
          chunkPattern: 'test-linux64/opt-mochitest-media-*/4',
          specialized: false,
          buildDependency: undefined,
        },
        [unchunked]: {
          tier: 1,
          chunkPattern: unchunked,
          specialized: false,
          buildDependency: undefined,
        },
      },
    });
  });

  test('reports a missing graph artifact to the picker', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404 });

    await self.onmessage({ data: artifact });

    expect(self.postMessage).toHaveBeenCalledWith({
      error: 'Task graph returned 404',
    });
  });
});
