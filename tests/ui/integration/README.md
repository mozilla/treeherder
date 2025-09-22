# Treeherder Integration Tests

This directory contains Puppeteer-based integration tests for the Treeherder application. These tests run in a real browser environment and test end-to-end user workflows.

## Test Structure

```code
tests/ui/integration/
├── README.md                           # This file
├── test-setup.js                       # Basic test setup
├── helpers/
│   └── test-utils.js                   # Common test utilities and helpers
├── graphs-view/
│   └── graphs_view_integration_test.jsx # Existing Perfherder graphs tests
├── jobs-view/
│   └── jobs_view_integration_test.jsx  # Jobs view functionality tests
├── push-health/
│   └── push_health_integration_test.jsx # Push health functionality tests
├── navigation/
│   └── app_navigation_integration_test.jsx # Cross-app navigation tests
└── recordings/                         # HTTP request recordings (HAR files)
```

## Running Integration Tests

Integration tests are excluded from the regular Jest test suite and must be run separately:

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npm run test:integration -- --testPathPattern="jobs_view"

# Run tests in watch mode
npm run test:integration -- --watch
```

## Test Configuration

### Jest Configuration

- **Configuration**: [`jest-puppeteer.config.js`](../../../jest-puppeteer.config.js)
- **Environment**: Puppeteer with headless Chrome
- **Server**: Automatically starts development server (`yarn start`)
- **Timeout**: 60 seconds per test

### HTTP Request Recording

Tests use [Polly.js](https://netflix.github.io/pollyjs/) to record and replay HTTP requests:

- Recordings are stored in the `recordings/` directory as HAR files
- First test run records real HTTP requests
- Subsequent runs replay recorded requests for consistency
- Set `recordIfMissing: true` to update recordings when needed

## Test Categories

### 1. Jobs View Tests (`jobs-view/`)

Tests the main Treeherder jobs interface:

- **Navigation**: Repository switching, URL parameter handling
- **Filtering**: Search, result status, field filters
- **Job Selection**: Job details panel, job actions
- **Push List**: Push information, job group expansion
- **Keyboard Shortcuts**: Shortcut modal, key bindings
- **URL Handling**: Deep linking, parameter persistence

### 2. Push Health Tests (`push-health/`)

Tests the push health analysis interface:

- **Navigation**: Landing page, usage documentation
- **Health Analysis**: Revision-specific health data
- **Test Results**: Failure information, job metrics
- **Interaction**: Test group expansion, result filtering
- **My Pushes**: User-specific push data
- **Error Handling**: Invalid revisions, missing parameters
- **Performance**: Loading indicators, response times

### 3. Navigation Tests (`navigation/`)

Tests cross-application navigation and routing:

- **Cross-App Navigation**: Jobs ↔ Perfherder ↔ Push Health
- **URL Compatibility**: Legacy URL redirects, hash parameters
- **Error Handling**: 404 pages, malformed URLs
- **Browser Navigation**: Back/forward buttons, page refresh
- **Authentication**: Login callbacks, auth flows
- **Documentation**: User guide, API docs
- **Responsive**: Mobile and tablet viewports

### 4. Graphs View Tests (`graphs-view/`)

Existing tests for Perfherder graphs functionality:

- **Modal Interactions**: Add test data modal
- **View Toggling**: Table view ↔ Graphs view
- **HTTP Recording**: Request/response recording with Polly.js

## Test Utilities

The [`helpers/test-utils.js`](helpers/test-utils.js) file provides common utilities:

### Setup Functions

- `setupIntegrationTest(testName)` - Complete test setup with Polly.js
- `setupPollyForTest(testName)` - HTTP recording setup only

### Navigation Helpers

- `navigateAndWaitForLoad(page, url, options)` - Navigate and wait for page ready
- `waitForLoadingComplete(page, options)` - Wait for loading indicators to disappear

### Element Interaction

- `clickElement(page, selector, options)` - Click with retry logic
- `typeIntoField(page, selector, text, options)` - Type into input fields
- `waitForClickableElement(page, selector, options)` - Wait for interactive elements

### Content Verification

- `waitForTextContent(page, selector, expectedText, options)` - Wait for specific text
- `getTextContent(page, selector)` - Extract text content
- `getAttribute(page, selector, attribute)` - Get element attributes
- `isElementVisible(page, selector)` - Check element visibility

## Writing New Tests

### Basic Test Structure

```javascript
import { setupIntegrationTest } from '../helpers/test-utils';

describe('My Feature Tests', () => {
  const {
    context,
    navigateAndWaitForLoad,
    clickElement,
    // ... other helpers
  } = setupIntegrationTest('MyFeature');

  test('should do something', async () => {
    await navigateAndWaitForLoad(`${URL}/my-feature`);
    
    await clickElement('.my-button');
    
    // Assertions...
  });
});
```

### Best Practices

1. **Use Descriptive Test Names**: Clearly describe what functionality is being tested
2. **Wait for Elements**: Always wait for elements before interacting with them
3. **Handle Async Operations**: Use appropriate wait functions for loading states
4. **Test Error States**: Include tests for error conditions and edge cases
5. **Keep Tests Independent**: Each test should be able to run in isolation
6. **Use Page Object Pattern**: For complex pages, consider creating page object helpers
7. **Mock External Dependencies**: Use Polly.js recordings to avoid external API dependencies

### Common Patterns

```javascript
// Wait for page to load
await navigateAndWaitForLoad(`${URL}/jobs`);

// Wait for specific content
await waitForTextContent('.status', 'Success');

// Check if element exists
const hasButton = await isElementVisible('.action-button');
if (hasButton) {
  await clickElement('.action-button');
}

// Handle loading states
await waitForLoadingComplete();

// Verify URL changes
await page.waitForFunction(
  () => window.location.search.includes('param=value'),
  { timeout: 10000 }
);
```

## Debugging Tests

### Running Tests in Non-Headless Mode

Modify [`jest-puppeteer.config.js`](../../../jest-puppeteer.config.js):

```javascript
module.exports = {
  launch: {
    headless: false, // Set to false to see browser
    slowMo: 250,     // Slow down actions for debugging
  },
  // ...
};
```

### Adding Debug Information

```javascript
// Take screenshots for debugging
await page.screenshot({ path: 'debug-screenshot.png' });

// Log page content
const content = await page.content();
console.log(content);

// Log console messages
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
```

### Common Issues

1. **Timeouts**: Increase timeout values for slow-loading content
2. **Element Not Found**: Ensure selectors match actual DOM structure
3. **Race Conditions**: Use proper wait functions instead of fixed delays
4. **Network Issues**: Check Polly.js recordings for HTTP request problems
5. **Authentication**: Some features may require login state

## Maintenance

### Updating Recordings

When API responses change, update recordings by:

1. Delete relevant files in `recordings/` directory
2. Run tests to generate new recordings
3. Commit updated recording files

### Adding New Test Suites

1. Create new directory under `tests/ui/integration/`
2. Add test files with descriptive names
3. Use `setupIntegrationTest()` for consistent setup
4. Update this README with new test descriptions

### Performance Considerations

- Integration tests are slower than unit tests
- Run integration tests in CI but not on every commit
- Consider parallel test execution for large test suites
- Monitor test execution time and optimize slow tests
