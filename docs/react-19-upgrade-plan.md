# React 19 Upgrade Plan

## Executive Summary

**Current Version:** React 18.3.1
**Target Version:** React 19.x
**Overall Assessment:** The codebase is in good shape for upgrade. No React 18.3 deprecation warnings detected at runtime. Most deprecated patterns have already been avoided.

## Pre-Upgrade Checklist

### Required Changes (Blockers)

- [x] Using `createRoot` instead of `ReactDOM.render` - Already done
- [x] No `ReactDOM.hydrate` usage - Already done
- [x] No string refs - Already done
- [x] No legacy context (`contextTypes`, `getChildContext`) - Already done
- [x] No `findDOMNode` usage - Already done
- [x] No `react-test-renderer/shallow` - Already done
- [x] No `React.createFactory` - Already done
- [x] **Fix `defaultProps` on function components** - Fixed in `ui/perfherder/Validation.jsx`

### Required Fix: defaultProps on Function Component - COMPLETED

**File:** `ui/perfherder/Validation.jsx`

**Status:** Fixed - Converted `defaultProps` to ES6 default parameters using destructuring:

```jsx
// Changed from defaultProps to destructuring with defaults
const Validation = (props) => {
  const { projects = [], frameworks = [] } = props;
  // ... rest of component
```

## Deprecations (Non-Blocking but Recommended)

### 1. propTypes (143 files)

React 19 silently ignores `propTypes` - they won't cause errors but also won't validate. Consider:

- **Option A:** Keep them for documentation purposes (no runtime validation)
- **Option B:** Gradually migrate to TypeScript
- **Option C:** Remove them entirely

**Recommendation:** Keep for now, migrate to TypeScript incrementally.

**Files using propTypes:** 143 files in `ui/` directory

### 2. forwardRef (1 file)

React 19 allows passing `ref` as a regular prop to function components, making `forwardRef` unnecessary in many cases.

**File:** `ui/job-view/pushes/JobButton.jsx`

**Recommendation:** Low priority. Can update later for cleaner code.

### 3. Class Components with defaultProps (1 file)

Class components still support `defaultProps` in React 19, so these are fine.

**File:** `ui/job-view/details/PinBoard.jsx` - No change needed (class component)

## Third-Party Dependencies to Verify

Before upgrading, verify React 19 compatibility for these key dependencies:

| Package | Current Version | React 19 Support |
|---------|----------------|------------------|
| react-bootstrap | 2.10.10 | Check changelog |
| react-router-dom | 6.28.0 | Check changelog |
| @mui/material | 7.1.2 | Likely supported |
| @fortawesome/react-fontawesome | 0.2.6 | Check changelog |
| react-helmet | 6.1.0 | Check changelog |
| react-lazylog | 4.5.3 | Check changelog |
| react-hot-keys | 2.7.3 | Check changelog |
| react-table-6 | 6.11.0 | May need update |
| react-tabs | 6.1.0 | Check changelog |
| redoc | 2.4.0 | Check changelog |
| victory | 37.3.6 | Check changelog |
| @testing-library/react | 16.2.0 | Supports React 19 |
| styled-components | 6.1.19 | Check changelog |

## React Router v7 Preparation

Console warnings indicate React Router future flags should be enabled:

```jsx
// In router configuration, add future flags:
<BrowserRouter future={{
  v7_startTransition: true,
  v7_relativeSplatPath: true
}}>
```

## Upgrade Steps

### Phase 1: Pre-Upgrade Fixes (Before Upgrading)

1. [x] Fix `defaultProps` in `ui/perfherder/Validation.jsx` - DONE
2. [ ] Add React Router v7 future flags
3. [x] Run full test suite to establish baseline - All 421 tests pass
4. [ ] Verify all third-party dependencies support React 19

### Phase 2: Upgrade React

```bash
pnpm add react@^19.0.0 react-dom@^19.0.0
pnpm add -D @types/react@^19.0.0 @types/react-dom@^19.0.0
```

### Phase 3: Post-Upgrade Verification

1. [ ] Run `pnpm build` - check for build errors
2. [ ] Run `pnpm test` - check for test failures
3. [ ] Run `pnpm lint` - check for lint errors
4. [ ] Manual testing of key workflows
5. [ ] Check browser console for new warnings

### Phase 4: Optional Cleanup (Post-Upgrade)

1. [ ] Consider removing propTypes (143 files) or migrating to TypeScript
2. [ ] Update `forwardRef` usage in `JobButton.jsx` to use ref as prop
3. [ ] Run codemods for any remaining patterns:

   ```bash
   npx codemod@latest react/19/migration-recipe
   ```

## New React 19 Features to Leverage (Optional)

After successful upgrade, consider adopting:

- **ref as prop:** No need for `forwardRef` in new components
- **Improved error handling:** `onCaughtError` and `onUncaughtError` callbacks
- **use() hook:** For reading resources in render
- **Actions:** Async transitions with `useTransition`
- **useOptimistic:** For optimistic UI updates
- **useFormStatus/useFormState:** For form handling

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Third-party package incompatibility | Medium | High | Test in dev first, check changelogs |
| Test failures | Low | Medium | Fix before merging |
| Runtime errors | Low | High | Thorough QA testing |
| Performance regression | Low | Medium | Monitor after deploy |

## Timeline Estimate

- Phase 1 (Pre-upgrade fixes): 1-2 hours
- Phase 2 (Upgrade): 30 minutes
- Phase 3 (Verification): 2-4 hours
- Phase 4 (Optional cleanup): As time permits

## References

- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [React 19 Release Notes](https://react.dev/blog/2024/12/05/react-19)
- [React Router v7 Migration](https://reactrouter.com/v6/upgrading/future)
