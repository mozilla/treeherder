// Entry point for Jest tests
import '@testing-library/jest-dom/jest-globals';

const mockBuildUrl = jest.fn((root, taskId, path) => {
  return `${root}/${taskId}/artifacts/${path}`;
});
const mockTask = jest.fn(() => {
  return {
    tags: { test: 'test' },
    id: 'TASKID',
    payload: { env: { MOZHARNESS_TEST_PATHS: '{ "mock": ["mock.json"] }' } },
  };
});
const mockUse = jest.fn().mockImplementation(() => {
  return {
    createTask: jest.fn(() => {
      return 'ACTION_TASKID';
    }),
  };
});

// after upgrading taskcluster to 39.1.1, fail to `import taskcluster-client-web`
jest.mock('taskcluster-client-web', () => {
  return {
    Queue: jest.fn().mockImplementation(() => {
      return {
        buildUrl: mockBuildUrl,
        getLatestArtifact:
          'https://firefox-ci-tc.services.mozilla.com/api/queue/v1/task',
        task: mockTask,
        use: mockUse,
      };
    }),
    slugid: jest.fn(() => {
      return 'TEST_SLUGID';
    }),
  };
});

jest.setTimeout(10000);
