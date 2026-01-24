# Integration Tests

This directory contains Puppeteer-based end-to-end integration tests for Treeherder's frontend functionality.

## Test Coverage

### Phase 2 Package Upgrade Tests

These tests verify functionality for packages upgraded in Phase 2:

1. **Keyboard Shortcuts** (`keyboard-shortcuts/keyboard_shortcuts_integration_test.jsx`)
   - Tests `react-hot-keys` (v2.7.3)
   - Verifies keyboard navigation shortcuts (j/k for next/prev job, escape to clear, etc.)
   - Tests shortcut filtering when typing in input fields
   - Tests pinboard operations and quick filter focus

2. **Logviewer** (`logviewer/logviewer_integration_test.jsx`)
   - Tests `react-lazylog` (v4.5.3)
   - Verifies log rendering, scrolling, and virtualization
   - Tests line highlighting and selection
   - Tests search functionality
   - Tests error line styling
   - Tests line range highlighting from URLs

3. **Bug List Highlighting** (`bug-highlighting/bug_highlighting_integration_test.jsx`)
   - Tests `react-highlight-words` (v0.21.0)
   - Verifies bug list item rendering
   - Tests search term highlighting in bug summaries
   - Tests bug link display and resolved bug styling
   - Tests internal bug occurrence counts

## Running Integration Tests

### Prerequisites

1. **Install Puppeteer browser** (done automatically by the test script):

   ```bash
   pnpm test:integration
   ```

2. **Start the development server** (in a separate terminal):

   ```bash
   pnpm start:local
   ```

   Or to test against staging:

   ```bash
   pnpm start:stage
   ```

### Running Tests

**Run all integration tests:**

```bash
pnpm test:integration
```

**Run a specific test file:**

```bash
jest --config jest.integration.config.js tests/ui/integration/keyboard-shortcuts/keyboard_shortcuts_integration_test.jsx
```

**Run tests in headed mode (see browser):**

```bash
HEADLESS=false pnpm test:integration
```

### Configuration

- **Jest config**: `jest.integration.config.js` (at project root)
- **Puppeteer config**: `jest-puppeteer.config.js` (at project root)
- **Test setup**: `test-setup.js` (in this directory)

### Request Mocking

Tests use Polly.js to record and replay HTTP requests:

- **Recordings directory**: `tests/ui/integration/recordings/`
- **Recording mode**: `recordIfMissing` - creates recordings on first run, replays on subsequent runs
- **Adapters**: Puppeteer adapter for browser requests

## Writing New Integration Tests

### Test Structure

```javascript
import path from 'node:path';
import { Polly } from '@pollyjs/core';
import PuppeteerAdapter from '@pollyjs/adapter-puppeteer';
import FsPersister from '@pollyjs/persister-fs';
import { setupPolly } from 'setup-polly-jest';

Polly.register(PuppeteerAdapter);
Polly.register(FsPersister);

describe('My Feature Test', () => {
  const context = setupPolly({
    adapters: ['puppeteer'],
    adapterOptions: {
      puppeteer: { page },
    },
    persister: 'fs',
    persisterOptions: {
      fs: {
        recordingsDir: path.resolve(__dirname, '../recordings'),
      },
    },
    recordIfMissing: true,
    matchRequestsBy: {
      headers: {
        exclude: ['user-agent'],
      },
    },
  });

  beforeEach(async () => {
    jest.setTimeout(60000);
    await page.setRequestInterception(true);
    await page.setDefaultNavigationTimeout(10000);
    await page.goto(`${URL}/path`);
  });

  test('should do something', async () => {
    expect(context.polly).not.toBeNull();

    // Test code here

    await context.polly.flush();
  });
});
```

### Best Practices

1. **Use semantic selectors**: Prefer `data-testid`, class names, or accessible selectors over complex CSS
2. **Wait for elements**: Always use `waitForSelector` before interacting with elements
3. **Flush recordings**: Call `await context.polly.flush()` at the end of each test
4. **Set timeouts**: Use `jest.setTimeout()` for slow operations
5. **Handle missing data gracefully**: Check if elements exist before asserting on them
6. **Test user-facing behavior**: Focus on what users see and do, not implementation details

### Global Variables

- **`URL`**: Base URL for the application (`http://localhost:5000` by default)
- **`page`**: Puppeteer page instance (provided by jest-puppeteer)
- **`browser`**: Puppeteer browser instance (provided by jest-puppeteer)

## Troubleshooting

### Tests timeout

- Increase timeout in `beforeEach`: `jest.setTimeout(120000)`
- Check that the dev server is running
- Verify the URL is correct

### Browser not found

- Run `node node_modules/puppeteer/install.mjs` to download Chromium
- Or use system Chrome: Set `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` and configure executablePath

### Request recording issues

- Delete recordings directory and re-run to create fresh recordings
- Check network connectivity if recording external APIs
- Verify Polly.js adapter is properly configured

### Flaky tests

- Add explicit waits with `waitForTimeout` after interactions
- Use `waitForSelector` with appropriate timeouts
- Check for race conditions in async operations
- Use `networkidle0` or `networkidle2` for navigation waits

## CI/CD Integration

To run integration tests in CI:

```bash
# Start server in background
pnpm start:local &
SERVER_PID=$!

# Wait for server to be ready
sleep 10

# Run tests
pnpm test:integration

# Cleanup
kill $SERVER_PID
```

## Additional Resources

- [Puppeteer Documentation](https://pptr.dev/)
- [Jest Puppeteer Documentation](https://github.com/smooth-code/jest-puppeteer)
- [Polly.js Documentation](https://netflix.github.io/pollyjs/)
- [Treeherder CLAUDE.md](../../../CLAUDE.md) - Project-specific guidance
