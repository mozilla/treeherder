// Entry point for Integration Jest tests
import '@testing-library/jest-dom/jest-globals';

// Setup Polly.js for Jest environment
import { Polly } from '@pollyjs/core';
import PuppeteerAdapter from '@pollyjs/adapter-puppeteer';
import FsPersister from '@pollyjs/persister-fs';

// Register Polly adapters and persisters
Polly.register(PuppeteerAdapter);
Polly.register(FsPersister);

// Global test configuration
global.URL = process.env.TEST_URL || 'http://localhost:3000';

// Extend Jest timeout for integration tests
jest.setTimeout(60000);

// Setup global error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Mock console.warn for cleaner test output
// eslint-disable-next-line no-console
const originalWarn = console.warn;
beforeAll(() => {
  // eslint-disable-next-line no-console
  console.warn = (...args) => {
    // Filter out known warnings that don't affect tests
    const message = args.join(' ');
    if (
      message.includes('React.createFactory') ||
      message.includes('componentWillReceiveProps') ||
      message.includes('componentWillMount')
    ) {
      return;
    }
    originalWarn(...args);
  };
});

afterAll(() => {
  // eslint-disable-next-line no-console
  console.warn = originalWarn;
});
