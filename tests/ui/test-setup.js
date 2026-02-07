/* global globalThis */
// Entry point for Jest tests
import '@testing-library/jest-dom/jest-globals';
import { TextEncoder, TextDecoder } from 'util';

// React Router v7 requires TextEncoder/TextDecoder which aren't in jsdom by default
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Configure React 18 act environment for testing
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock ResizeObserver which is required by @melloware/react-logviewer
// but not available in jsdom
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }

  observe() {}

  unobserve() {}

  disconnect() {}
};

// JSDOM doesn't implement scrollIntoView, so we mock it
Element.prototype.scrollIntoView = jest.fn();

// Suppress known act() warnings that don't affect test outcomes
// These are caused by:
// 1. React.lazy/Suspense async loading
// 2. Cross-test async timing in Jest's parallel execution
// 3. Third-party libraries (Popper.js, react-router) with async state updates
// 4. AuthService/Login async cleanup after tests complete
// Note: Some warnings may still appear in Jest's output due to its console capture timing
const suppressedPatterns = [
  'suspended resource finished loading inside a test',
  'An update to App inside a test was not wrapped in act',
  'An update to Router inside a test was not wrapped in act',
  'An update to Connect(',
];

/* eslint-disable no-console */
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args
    .map((arg) => (typeof arg === 'string' ? arg : String(arg)))
    .join(' ');
  if (suppressedPatterns.some((pattern) => message.includes(pattern))) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Mock @restart/ui's usePopper to prevent async positioning updates that cause act() warnings
// React Bootstrap's DropdownMenu uses Popper.js which triggers async state updates outside React's control
// This mock provides enough functionality for tooltips and overlays to render while avoiding async warnings
jest.mock('@restart/ui/usePopper', () => {
  // eslint-disable-next-line global-require
  const React = require('react');
  return function usePopper(_referenceElement, _popperElement, options) {
    const [state] = React.useState({
      placement: options?.placement || 'bottom',
      styles: {
        popper: {
          position: 'absolute',
          top: '0',
          left: '0',
        },
        arrow: {},
      },
      attributes: {
        popper: {
          'data-popper-placement': options?.placement || 'bottom',
        },
      },
    });

    return {
      ...state,
      update: jest.fn(() => Promise.resolve(state)),
      forceUpdate: jest.fn(),
      arrowStyles: {},
      outOfBoundaries: false,
    };
  };
});

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
