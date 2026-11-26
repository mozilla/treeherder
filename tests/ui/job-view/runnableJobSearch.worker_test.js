test('The worker entry point posts matching indices and transfers their buffer', async () => {
  const originalOnMessage = self.onmessage;
  const postMessage = jest.spyOn(self, 'postMessage').mockImplementation(() => {});
  global.WorkerGlobalScope = class WorkerGlobalScope {};

  try {
    await jest.isolateModulesAsync(async () => {
      await import('../../../ui/job-view/pushes/runnableJobSearch.worker');
    });

    self.onmessage({ data: ['test-linux64/opt', 'asan', 'build'] });
    expect(postMessage).not.toHaveBeenCalled();

    self.onmessage({ data: '!asan' });
    expect(postMessage).toHaveBeenCalledTimes(1);
    const [[result, transfer]] = postMessage.mock.calls;
    expect(result).toEqual({ query: '!asan', indices: Uint32Array.of(0, 2) });
    expect(transfer).toHaveLength(1);
    expect(transfer[0]).toBe(result.indices.buffer);
  } finally {
    postMessage.mockRestore();
    self.onmessage = originalOnMessage;
    delete global.WorkerGlobalScope;
  }
});
