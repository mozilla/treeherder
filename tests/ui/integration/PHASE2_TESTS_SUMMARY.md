# Phase 2 Package Upgrade Integration Tests

## Overview

This document summarizes the Puppeteer integration tests created to verify functionality for packages upgraded in Phase 2 of the dependency upgrade project.

## Created Files

### Test Files

1. **`keyboard-shortcuts/keyboard_shortcuts_integration_test.jsx`**
   - Tests for `react-hot-keys` (v2.7.3)
   - 7 test cases covering keyboard navigation and shortcuts

2. **`logviewer/logviewer_integration_test.jsx`**
   - Tests for `react-lazylog` (v4.5.3)
   - 9 test cases covering log viewing, scrolling, and highlighting

3. **`bug-highlighting/bug_highlighting_integration_test.jsx`**
   - Tests for `react-highlight-words` (v0.21.0)
   - 9 test cases covering bug list rendering and text highlighting

### Configuration Files

1. **`jest.integration.config.js`** (project root)
   - Jest configuration specifically for integration tests
   - Uses jest-puppeteer preset
   - Configures SWC transforms for fast test execution

2. **`README.md`** (this directory)
   - Comprehensive documentation on running and writing integration tests
   - Includes troubleshooting guide and best practices

### Package Updates

- Updated `package.json` script `test:integration` to use the new config file

## Test Coverage Details

### Keyboard Shortcuts Tests (react-hot-keys)

Tests verify that keyboard shortcuts work correctly in the job view:

- **Navigation**: j/k keys for next/previous job
- **Clear selection**: Escape key
- **Pin job**: Space bar
- **Focus filter**: f key
- **Toggle filters**: i key for in-progress filter
- **Input filtering**: Shortcuts don't fire when typing in input fields

**Key functionality tested:**

- KeyboardShortcuts component renders and wraps content with Hotkeys
- Navigation through jobs works with keyboard
- Escape clears selected job
- Space pins job to pinboard
- Filter key focuses the quick filter input
- Input field typing is properly filtered (doesn't trigger shortcuts)

### Logviewer Tests (react-lazylog)

Tests verify that the log viewer displays and interacts with large log files:

- **Rendering**: LazyLog component renders with log content
- **Scrolling**: Log content is scrollable with virtualization
- **Line selection**: Clicking lines highlights them
- **Error highlighting**: Error lines display with special styling
- **Search**: Search functionality works when enabled
- **URL persistence**: Line numbers persist in URL parameters
- **Line ranges**: Multiple line highlighting (e.g., 50-60)
- **Formatting**: Log lines display with color formatting
- **Tab integration**: LogviewerTab component renders LazyLog correctly

**Key functionality tested:**

- LazyLog renders and displays log lines
- Scrolling works and updates scroll position
- Line highlighting and selection
- Error line styling via errorLinesCss
- Search bar and highlighting
- Line number URL parameters
- Line range highlighting
- Color formatting from logFormatter
- Full-screen log viewer integration

### Bug Highlighting Tests (react-highlight-words)

Tests verify that bug list items display with highlighted search terms:

- **Rendering**: BugListItem components render correctly
- **Highlighting**: Search terms are highlighted in bug summaries
- **Bug links**: Bugzilla links are correctly displayed
- **Bug metadata**: Bug ID and summary text display
- **Resolved bugs**: Strike-through styling for resolved bugs
- **Duplicate bugs**: Duplicate bug indicators and links
- **Pin buttons**: Internal occurrence pin buttons are clickable
- **Case sensitivity**: Highlighter respects case-sensitive matching
- **Occurrence counts**: Internal bug occurrence counts display

**Key functionality tested:**

- BugListItem components render with data-testid
- Highlighter component highlights search terms with strong tags
- Bug links point to Bugzilla
- Bug IDs and summaries display correctly
- Strike-through class applies to resolved bugs
- Duplicate bug indicators work
- Pin buttons are interactive
- Case-sensitive highlighting
- Occurrence count text displays

## Running the Tests

### Prerequisites

1. **Start the development server:**

   ```bash
   pnpm start:local
   ```

   This starts the server at `http://localhost:5000` (default for integration tests)

2. **Install Puppeteer browser** (automatic):

   The test script automatically runs `node node_modules/puppeteer/install.mjs`

### Execute Tests

**Run all integration tests:**

```bash
pnpm test:integration
```

**Run a specific test suite:**

```bash
jest --config jest.integration.config.js tests/ui/integration/keyboard-shortcuts/keyboard_shortcuts_integration_test.jsx
```

**Run in headed mode (see browser):**

```bash
HEADLESS=false pnpm test:integration
```

### Expected Results

All tests should pass when:

1. The development server is running at `http://localhost:5000`
2. The Phase 2 packages are properly installed
3. The test data is available (or recordings are present)

## Test Architecture

### Polly.js Request Recording

Tests use Polly.js to record and replay HTTP requests:

- **First run**: Records requests to `tests/ui/integration/recordings/`
- **Subsequent runs**: Replays recorded requests for consistent, fast tests
- **Benefits**: No need for backend server after initial recording, deterministic tests

### Puppeteer Integration

Tests use jest-puppeteer for browser automation:

- **Browser**: Headless Chrome by default
- **Page object**: Global `page` object available in tests
- **Timeouts**: 60-second default timeout for async operations
- **Request interception**: Enabled for Polly.js recording

### Test Patterns

All tests follow this pattern:

1. **Setup Polly.js**: Configure recording/replay
2. **Navigate**: Go to the page under test
3. **Wait**: Wait for elements to load
4. **Interact**: Click, type, or trigger events
5. **Assert**: Verify expected behavior
6. **Cleanup**: Flush Polly recordings

## Maintenance Notes

### Updating Tests

When package versions change:

1. Review release notes for breaking changes
2. Update test assertions if behavior changes
3. Delete recordings if API responses change
4. Re-run tests to create new recordings

### Adding New Tests

To add tests for new packages:

1. Create a new directory under `tests/ui/integration/`
2. Create a test file with `_integration_test.jsx` suffix
3. Follow the pattern from existing tests
4. Update this summary document
5. Run tests to verify they work

### Troubleshooting

Common issues and solutions:

1. **Tests timeout**: Increase timeout or check server is running
2. **Elements not found**: Add explicit waits or check selectors
3. **Flaky tests**: Add delays after interactions, check for race conditions
4. **Recording issues**: Delete recordings directory and re-record

## Success Criteria

These tests are considered successful when:

1. All tests pass consistently
2. Coverage includes critical user workflows
3. Tests catch regressions in upgraded packages
4. Tests run in reasonable time (< 5 minutes total)
5. Tests are maintainable and well-documented

## Next Steps

After Phase 2 testing:

1. **Integrate into CI/CD**: Add to GitHub Actions workflow
2. **Monitor flakiness**: Track test stability over time
3. **Expand coverage**: Add more edge cases as needed
4. **Phase 3 testing**: Apply same patterns to Phase 3 packages
5. **Performance testing**: Consider adding performance benchmarks

## References

- [Main Integration Tests README](./README.md)
- [Treeherder CLAUDE.md](../../../CLAUDE.md)
- [Phase 2 Upgrade Plan](../../../docs/phase2-upgrade-plan.md)
- [Puppeteer Documentation](https://pptr.dev/)
- [Jest Puppeteer Plugin](https://github.com/smooth-code/jest-puppeteer)
- [Polly.js Documentation](https://netflix.github.io/pollyjs/)
