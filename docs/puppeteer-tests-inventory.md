# Treeherder Puppeteer Tests Inventory

This document provides a comprehensive inventory of all Puppeteer-based integration tests in the Treeherder project, detailing what functionality each test covers and how they are organized.

## Overview

Treeherder uses Puppeteer for end-to-end integration testing to ensure the web application works correctly in a real browser environment. These tests complement the unit tests by validating complete user workflows and cross-component interactions.

### Test Framework Configuration

- **Framework**: Jest + Puppeteer
- **Configuration**: [`jest-puppeteer.config.js`](../jest-puppeteer.config.js)
- **Environment**: Headless Chrome (configurable)
- **HTTP Recording**: Polly.js for request/response mocking
- **Test Location**: [`tests/ui/integration/`](../tests/ui/integration/)
- **Timeout**: 60 seconds per test
- **Server**: Automatically starts development server (`yarn start`)

### Running Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npm run test:integration -- --testPathPattern="jobs_view"

# Run tests in watch mode
npm run test:integration -- --watch
```

## Test Structure

```code
tests/ui/integration/
├── README.md                           # Test documentation
├── test-setup.js                       # Basic test setup
├── helpers/
│   └── test-utils.js                   # Common test utilities
├── graphs-view/
│   └── graphs_view_integration_test.jsx # Perfherder graphs tests
├── jobs-view/
│   └── jobs_view_integration_test.jsx  # Jobs view functionality tests
├── push-health/
│   └── push_health_integration_test.jsx # Push health functionality tests
├── navigation/
│   └── app_navigation_integration_test.jsx # Cross-app navigation tests
└── recordings/                         # HTTP request recordings (HAR files)
```

## Test Suites

### 1. Jobs View Integration Tests

File: [`tests/ui/integration/jobs-view/jobs_view_integration_test.jsx`](../tests/ui/integration/jobs-view/jobs_view_integration_test.jsx)

#### Basic Navigation and Layout (3 tests)

- **Load jobs view with default repository**
  - Verifies main navigation presence
  - Checks repository selector functionality
  - Validates push list container
  - Confirms page title is "Treeherder Jobs View"

- **Display repository selector with available repositories**
  - Tests repository dropdown functionality
  - Verifies common repositories (autoland, mozilla-central) are available
  - Ensures dropdown menu appears correctly

- **Switch repositories when selected**
  - Tests repository switching functionality
  - Validates URL parameter updates (`repo=mozilla-central`)
  - Confirms navigation between repositories

#### Job Filtering (3 tests)

- **Show and hide field filter panel**
  - Tests filter button toggle functionality
  - Verifies filter panel visibility states
  - Ensures proper show/hide behavior

- **Filter jobs by search text**
  - Tests search input functionality
  - Validates URL parameter updates (`searchStr=test`)
  - Confirms search filter application

- **Filter jobs by result status**
  - Tests result status dropdown filtering
  - Validates status filter selection (e.g., "testfailed")
  - Confirms URL parameter updates (`resultStatus=testfailed`)

#### Job Selection and Details (2 tests)

- **Select a job and show details panel**
  - Tests job button clicking
  - Verifies details panel appearance
  - Confirms job selection state (visual feedback)

- **Show job actions in details panel**
  - Tests job actions availability
  - Verifies retry/retrigger button presence
  - Validates action button functionality

#### Push List Functionality (2 tests)

- **Display push information**
  - Tests push header display
  - Verifies author information presence
  - Confirms revision information display

- **Expand and collapse job groups**
  - Tests job group expansion functionality
  - Verifies job count changes after expansion
  - Validates group interaction behavior

#### Keyboard Shortcuts (1 test)

- **Show keyboard shortcuts modal**
  - Tests '?' key shortcut functionality
  - Verifies shortcuts modal appearance
  - Confirms modal dismissal with Escape key

#### URL Parameter Handling (2 tests)

- **Handle revision parameter**
  - Tests URL with revision parameter
  - Validates parameter preservation
  - Ensures page loads without errors

- **Handle multiple filter parameters**
  - Tests complex URL parameter combinations
  - Verifies all parameters are preserved
  - Confirms filter UI reflects URL state

Total Jobs View Tests: 13

### 2. Push Health Integration Tests

File: [`tests/ui/integration/push-health/push_health_integration_test.jsx`](../tests/ui/integration/push-health/push_health_integration_test.jsx)

#### Navigation and Basic Layout (2 tests)

- **Load push health landing page**
  - Tests push health navigation presence
  - Verifies main content area
  - Confirms page title is "Push Health"
  - Validates "My Pushes" or landing content

- **Navigate to usage page**
  - Tests usage link navigation
  - Verifies URL change to `/push-health/usage`
  - Confirms usage documentation content

#### Push Health Analysis (3 tests)

- **Load push health for specific revision**
  - Tests revision-specific health data loading
  - Verifies push information display
  - Validates health metrics or test results presence

- **Display test failure information**
  - Tests failure section display
  - Verifies failure details presentation
  - Validates classification groups functionality

- **Show job metrics and statistics**
  - Tests job metrics display
  - Verifies success/failure count presentation
  - Validates platform information display

#### Test Result Interaction (2 tests)

- **Expand and collapse test groups**
  - Tests expandable group functionality
  - Verifies content expansion behavior
  - Validates collapse/expand animations

- **Filter test results**
  - Tests filter control functionality
  - Verifies filter application behavior
  - Validates URL parameter updates or UI changes

#### My Pushes Functionality (2 tests)

- **Display user pushes when logged in**
  - Tests authentication state handling
  - Verifies user push display or login prompt
  - Validates appropriate messaging for auth states

- **Handle empty push list gracefully**
  - Tests empty state display
  - Verifies appropriate messaging
  - Validates graceful handling of no data

#### Error Handling (2 tests)

- **Handle invalid revision gracefully**
  - Tests error message display for invalid revisions
  - Verifies 404 or error page functionality
  - Validates appropriate error messaging

- **Handle missing repository parameter**
  - Tests parameter validation
  - Verifies error handling or redirection
  - Validates proper error states

#### Push Health Performance and Loading (2 tests)

- **Show loading indicators during data fetch**
  - Tests loading spinner visibility
  - Verifies loading state management
  - Validates loading indicator cleanup

- **Load within reasonable time**
  - Tests page load performance (< 15 seconds)
  - Verifies functional page state after loading
  - Validates performance benchmarks

Total Push Health Tests: 13

### 3. App Navigation Integration Tests

File: [`tests/ui/integration/navigation/app_navigation_integration_test.jsx`](../tests/ui/integration/navigation/app_navigation_integration_test.jsx)

#### Cross-App Navigation (3 tests)

- **Navigate between different Treeherder apps**
  - Tests Jobs ↔ Perfherder ↔ Push Health navigation
  - Verifies correct page titles for each app
  - Validates seamless app switching

- **Maintain proper favicon for each app**
  - Tests favicon changes per app (tree_open.png, line_chart.png, push-health-ok.png)
  - Verifies visual branding consistency
  - Validates app-specific iconography

- **Handle deep linking with parameters**
  - Tests parameter preservation across navigation
  - Verifies complex URL parameter handling
  - Validates deep link functionality

#### URL Compatibility and Redirects (3 tests)

- **Handle legacy URL formats**
  - Tests old `.html` format redirects (`perf.html` → `/perfherder`)
  - Verifies `pushhealth.html` → `/push-health` redirect
  - Validates backward compatibility

- **Handle root URL redirect**
  - Tests root URL (`/`) redirect to `/jobs`
  - Verifies default landing page behavior
  - Validates proper routing

- **Preserve hash parameters during redirects**
  - Tests hash parameter conversion to search parameters
  - Verifies parameter preservation during redirects
  - Validates URL format migration

#### Error Pages and 404 Handling (2 tests)

- **Handle invalid routes gracefully**
  - Tests 404 page display or redirection
  - Verifies graceful handling of non-existent routes
  - Validates error page functionality

- **Handle malformed URLs**
  - Tests malformed parameter handling
  - Verifies page loading with invalid parameters
  - Validates robust URL parsing

#### Browser Navigation (2 tests)

- **Handle browser back and forward buttons**
  - Tests browser history navigation
  - Verifies back/forward button functionality
  - Validates proper page state restoration

- **Handle page refresh**
  - Tests parameter preservation on refresh
  - Verifies page functionality after reload
  - Validates state persistence

#### Authentication Flow (2 tests)

- **Handle login callback route**
  - Tests login callback page functionality
  - Verifies authentication flow handling
  - Validates login state management

- **Handle taskcluster auth callback**
  - Tests TaskCluster authentication callback
  - Verifies auth provider integration
  - Validates callback processing

#### Documentation and Help (2 tests)

- **Load user guide**
  - Tests user guide page loading
  - Verifies documentation content display
  - Validates help system functionality

- **Load API documentation**
  - Tests API documentation (Redoc) loading
  - Verifies documentation system integration
  - Validates API reference accessibility

#### Navigation Performance and Loading (2 tests)

- **Load apps within reasonable time**
  - Tests load performance for all apps (< 15 seconds)
  - Verifies functional state after loading
  - Validates performance benchmarks across apps

- **Handle concurrent navigation**
  - Tests rapid navigation between apps
  - Verifies stability under concurrent requests
  - Validates proper state management

#### Mobile and Responsive Behavior (2 tests)

- **Handle mobile viewport**
  - Tests mobile viewport functionality (375x667)
  - Verifies responsive design behavior
  - Validates mobile user experience

- **Handle tablet viewport**
  - Tests tablet viewport functionality (768x1024)
  - Verifies responsive design adaptation
  - Validates tablet user experience

Total Navigation Tests: 18

### 4. Graphs View Integration Tests

File: [`tests/ui/integration/graphs-view/graphs_view_integration_test.jsx`](../tests/ui/integration/graphs-view/graphs_view_integration_test.jsx)

#### Perfherder Graphs Functionality (2 tests)

- **Record requests**
  - Tests HTTP request recording with Polly.js
  - Verifies "Add test data" modal functionality
  - Validates framework dropdown (9 frameworks expected)
  - Tests modal interaction and data loading

- **Clicking on Table View / Graphs view button should toggle between views**
  - Tests view toggle button functionality
  - Verifies button text changes ("Table View" ↔ "Graphs View")
  - Validates view switching behavior
  - Tests with specific performance data URL parameters

Total Graphs View Tests: 2

## Test Utilities and Helpers

### Core Utilities

File: [`tests/ui/integration/helpers/test-utils.js`](../tests/ui/integration/helpers/test-utils.js)

#### Setup Functions

- `setupIntegrationTest(testName)` - Complete test setup with Polly.js recording
- `setupPollyForTest(testName)` - HTTP recording setup only

#### Navigation Helpers

- `navigateAndWaitForLoad(page, url, options)` - Navigate and wait for page ready
- `waitForLoadingComplete(page, options)` - Wait for loading indicators to disappear

#### Element Interaction

- `clickElement(page, selector, options)` - Click with retry logic and fallback
- `typeIntoField(page, selector, text, options)` - Type into input fields with clearing
- `waitForClickableElement(page, selector, options)` - Wait for interactive elements

#### Content Verification

- `waitForTextContent(page, selector, expectedText, options)` - Wait for specific text
- `getTextContent(page, selector)` - Extract text content from elements
- `getAttribute(page, selector, attribute)` - Get element attributes
- `isElementVisible(page, selector)` - Check element visibility with timeout

#### Configuration Constants

- `DEFAULT_TIMEOUT`: 30000ms (30 seconds)
- `NAVIGATION_TIMEOUT`: 10000ms (10 seconds)

### HTTP Request Recording

- **Framework**: Polly.js with Puppeteer adapter
- **Storage**: File system persister (HAR format)
- **Location**: `tests/ui/integration/recordings/`
- **Behavior**: Records missing requests, replays existing ones
- **Configuration**: Excludes user-agent headers from matching

## Test Coverage Summary

| Test Suite | Test Count | Primary Focus |
|------------|------------|---------------|
| Jobs View | 13 | Main Treeherder interface, job management, filtering |
| Push Health | 13 | Health analysis, test results, error handling |
| Navigation | 18 | Cross-app routing, URL handling, responsive design |
| Graphs View | 2 | Perfherder graphs, view toggling |
| **Total** | **46** | **Complete end-to-end workflows** |

## Key Testing Patterns

### 1. Page Load Validation

- Title verification
- Essential element presence
- Loading state management
- Error handling

### 2. User Interaction Testing

- Button clicks with retry logic
- Form input and submission
- Dropdown and modal interactions
- Keyboard shortcuts

### 3. URL Parameter Handling

- Parameter preservation
- Deep linking support
- Filter state synchronization
- Navigation history

### 4. Cross-Browser Compatibility

- Responsive design testing
- Mobile and tablet viewports
- Performance benchmarking
- Accessibility considerations

### 5. Error State Testing

- Invalid input handling
- Network error scenarios
- Authentication state management
- Graceful degradation

## Maintenance and Best Practices

### Recording Management

- HTTP recordings stored in `recordings/` directory
- Recordings organized by test suite and scenario
- Update recordings when API responses change
- Version control includes recording files

### Test Reliability

- Retry logic for flaky interactions
- Proper wait conditions for async operations
- Timeout management for slow operations
- Cleanup procedures for test isolation

### Performance Considerations

- Tests run in headless mode by default
- Parallel execution capability
- Network request mocking for consistency
- Load time benchmarking (< 15 seconds)

### Debugging Support

- Non-headless mode available for debugging
- Screenshot capture capability
- Console log monitoring
- Detailed error reporting

## Future Enhancements

### Potential Test Additions

- Perfherder alerts and analysis workflows
- Advanced job filtering and search scenarios
- Multi-repository comparison features
- Performance regression detection
- Accessibility compliance testing

### Infrastructure Improvements

- Visual regression testing integration
- Cross-browser testing (Firefox, Safari)
- Mobile device emulation
- CI/CD pipeline optimization
- Test result reporting and analytics

---

*This inventory was generated on 2025-09-14 and reflects the current state of Puppeteer tests in the Treeherder project. For the most up-to-date information, refer to the actual test files and the [integration tests README](../tests/ui/integration/README.md).*
