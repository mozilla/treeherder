# Post-React 19 Upgrade Plan

## Executive Summary

With React 19.2.3 successfully installed, this document outlines the phased approach to continue modernizing the Treeherder frontend. The plan prioritizes stability, addresses technical debt, and modernizes outdated dependencies.

## Current State

**React Version:** 19.2.3 (completed)
**React Router:** 7.11.0 (completed)
**Class Components:** 57 (migration in progress)
**Files with PropTypes:** 142 (keep for documentation)
**Last Updated:** January 2026

## Key Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| PropTypes alternative? | Keep propTypes, no Zod | Zod is for runtime data validation, not React props. PropTypes serve as documentation. |
| Intermediate type safety? | JSDoc (optional) | Zero runtime cost, IDE support, converts directly to TypeScript |
| API type safety? | OpenAPI codegen + Zod | Generate types from backend schema; Zod for external APIs & forms |
| Class → functional timing? | Before TypeScript | Functional components are easier to type |
| Migration approach? | Batch by feature area | Balance between incremental risk and focused effort |
| First area to migrate? | job-view (8 components) | Core functionality, moderate size |
| Package upgrades timing? | Can run in parallel | Most packages work with class components |

## Priority Framework

| Priority | Criteria |
|----------|----------|
| **P0 - Critical** | Security issues, broken functionality, blocking other work |
| **P1 - High** | Deprecated/inactive packages, major ecosystem misalignment |
| **P2 - Medium** | Peer dependency warnings, routine updates that add value |
| **P3 - Low** | Nice-to-have updates, minor version bumps |

---

## Phase 1: React Router v7 Migration - COMPLETED ✅

**Completed:** January 2026

### What Was Done

1. Updated package: `react-router@7.11.0` installed, `react-router-dom` removed
2. Updated imports in 32 source files + 21 test files from `'react-router-dom'` to `'react-router'`
3. Removed future flags from `BrowserRouter` in `ui/App.jsx`
4. Added `TextEncoder`/`TextDecoder` polyfills to test setup (required by React Router v7)
5. Fixed `v7_relativeSplatPath` behavior change: converted relative links to absolute paths in:
   - `ui/perfherder/Navigation.jsx` - navigation menu links (`./graphs` → `/perfherder/graphs`, etc.)
   - `ui/perfherder/alerts/DownstreamSummary.jsx` - downstream alert links
6. All 424 tests pass, lint passes, build passes

### Notes

- One warning detected: `navigate()` called outside `useEffect` in `ui/helpers/url.js:200` (MyPushes component). This is non-blocking but could be cleaned up later.
- The `v7_relativeSplatPath` change affects how relative paths resolve in splat routes. In v7, relative paths resolve relative to the route path, not the full URL.

### React Router Resources

- [React Router v7 Upgrade Guide](https://reactrouter.com/upgrading/v6)
- [React Router v7 Changelog](https://reactrouter.com/changelog)

---

## Phase 2: Replace Inactive/Problematic Dependencies - COMPLETED ✅

**Completed:** January 2026

### Summary

1. **react-highlight-words** updated from 0.20.0 to 0.21.0
2. **react-lazylog** tested with React 19 - works correctly (react-virtualized supports React 19)
3. **react-hot-keys** tested with React 19 - works correctly (peer dep `>=16.9.0`)
4. **react-table-6** deferred to Phase 4 (works at runtime despite peer dep warning)
5. **react-linkify** kept at 0.2.2 (1.0.0-alpha not production-ready)

### 2.1 react-lazylog Status

**Current:** 4.5.3 (INACTIVE - mozilla-frontend-infra marked as archived)
**Usage:** 2 files (`ui/logviewer/App.jsx`, `ui/shared/tabs/LogviewerTab.jsx`)
**Status:** ✅ Works with React 19

The original `react-lazylog` from Mozilla is no longer maintained, but its dependency `react-virtualized` explicitly supports React 19 (`^16.3.0 || ^17.0.0 || ^18.0.0 || ^19.0.0`). Build and tests pass.

**Future:** If issues arise, migrate to `@melloware/react-logviewer`.

### 2.2 react-table-6 Replacement (Deferred)

**Current:** 6.11.0 (peer dependency warning)
**Usage:** 5 files in `ui/intermittent-failures/` and `ui/perfherder/`
**Risk:** High - Significant refactoring required

**Status:** Works at runtime despite peer dependency warning. Migration to TanStack Table v8 would require significant refactoring since it's headless (no built-in UI).

**Recommendation:** Defer to Phase 4. Document current behavior and monitor for actual issues.

### 2.3 react-highlight-words ✅

**Updated:** 0.20.0 → 0.21.0
**Usage:** 1 file (`ui/shared/tabs/failureSummary/BugListItem.jsx`)

### 2.4 react-linkify

**Current:** 0.2.2 → 1.0.0-alpha available
**Usage:** 2 files (`ui/shared/RevisionLinkify.jsx`, `ui/shared/BugLinkify.jsx`)

**Status:** Kept at 0.2.2. Alpha version is not production-ready.

### 2.5 react-hot-keys ✅

**Current:** 2.7.3
**Usage:** 1 file (`ui/job-view/KeyboardShortcuts.jsx`)
**Status:** Works with React 19 (peer dep `>=16.9.0`)

---

## Phase 3: Routine Dependency Updates (P2 - Medium Priority)

These updates are lower risk and can be batched together.

### 3.1 MUI Updates

```bash
pnpm add @mui/material@^7.3.0 @mui/x-date-pickers@^8.23.0
```

### 3.2 Build Tool Updates

```bash
pnpm add -D @rspack/cli@^1.7.0 @rspack/core@^1.7.0
pnpm add -D @swc/core@^1.15.8
pnpm add -D @babel/core@^7.28.0 @babel/preset-env@^7.28.0 @babel/preset-react@^7.28.0
pnpm add -D @biomejs/biome@^2.3.11
```

### 3.3 Testing Updates

```bash
pnpm add -D @testing-library/react@^16.3.0
pnpm add -D sass@^1.97.0
pnpm add -D markdownlint-cli@^0.47.0
```

### 3.4 Other Runtime Dependencies

```bash
pnpm add mobx@^6.15.0
pnpm add redoc@^2.5.0
pnpm add react-resizable-panels@^4.2.0  # Review changelog for breaking changes
```

---

## Phase 4: Major Version Upgrades (P3 - Low Priority)

These require more careful evaluation due to major version changes.

### 4.1 Font Awesome 7

**Current:** 6.7.2 → 7.1.0
**Impact:** All icon packages + react-fontawesome

**Considerations:**

- v6 icon packages are still compatible with new react-fontawesome
- Major Sass/SCSS changes (if using Sass for FA - verify)
- Shim files available for backward compatibility

**Action:** Evaluate benefits vs effort. Font Awesome provides backward compatibility, but changes may require updates to icon references.

**Resources:**

- [Font Awesome 7 What's Changed](https://docs.fontawesome.com/upgrade/whats-changed)
- [Font Awesome 7 React Upgrade](https://docs.fontawesome.com/upgrade/react)

### 4.2 Fuse.js 7

**Current:** 6.0.4 → 7.1.0
**Usage:** Fuzzy search functionality

**Action:** Review [changelog](https://github.com/krisk/Fuse/releases) for breaking changes. Test thoroughly.

### 4.3 query-string 9

**Current:** 7.0.1 → 9.3.1
**Usage:** 3 files in perfherder

**Action:** Major version jump - review API changes. May require updates to parse/stringify calls.

### 4.4 Jest 30

**Current:** 29.7.0 → 30.2.0
**Impact:** Test infrastructure

**Action:** Defer until Jest 30 has more adoption and stability. Current version works well.

### 4.5 fetch-mock 12

**Current:** 9.4.0 → 12.6.0 (dev dependency)
**Impact:** Test mocking

**Action:** Major version jump for dev dependency. Evaluate when Jest is updated.

---

## Phase 5: Codebase Modernization (P2 - Medium Priority)

This phase focuses on converting class components to functional components, which is a prerequisite for future TypeScript adoption.

### Class Component Inventory

| Area | Class Components | Files with PropTypes |
|------|------------------|---------------------|
| **perfherder** | 27 | ~40 |
| **shared** | 14 | ~30 |
| **job-view** | 8 | ~25 |
| **push-health** | 3 | ~10 |
| **intermittent-failures** | 3 | ~8 |
| **infra-compare** | 2 | ~4 |
| **Total** | **57** | **142** |

**Good news:** No Redux/withRouter HOCs to replace - already using Zustand + hooks.

### 5.1 Class → Functional Component Migration

**Strategy:** Batch by feature area (starting with job-view)
**Approach:** Convert components when touching files for other work, or in focused batches

#### Migration Order

| Order | Area | Components | Rationale |
|-------|------|------------|-----------|
| 1 | **job-view** | 8 | Core functionality, user priority |
| 2 | **shared** | 14 | Impacts all features |
| 3 | **push-health** | 3 | Small, isolated |
| 4 | **intermittent-failures** | 3 | Small, isolated |
| 5 | **infra-compare** | 2 | Smallest area |
| 6 | **perfherder** | 27 | Largest, save for last |

#### Job-View Components (First Batch)

| Component | Complexity | Notes |
|-----------|------------|-------|
| `job-view/KeyboardShortcuts.jsx` | Medium | Uses react-hot-keys |
| `job-view/headerbars/PrimaryNavBar.jsx` | Low | Simple UI |
| `job-view/headerbars/WatchedRepo.jsx` | Low | Simple UI |
| `job-view/details/PinBoard.jsx` | High | Complex state, key feature |
| `job-view/details/DetailsPanel.jsx` | High | Complex state |
| `job-view/details/tabs/SimilarJobsTab.jsx` | Medium | Data fetching |
| `job-view/details/tabs/AnnotationsTab.jsx` | Medium | Data fetching |
| `job-view/details/tabs/SideBySideVideo.jsx` | Low | Simple UI |

#### Conversion Pattern

```jsx
// Before: Class Component
class MyComponent extends Component {
  state = { count: 0 };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.id !== this.props.id) {
      this.fetchData();
    }
  }

  fetchData = () => { /* ... */ };

  render() {
    return <div>{this.state.count}</div>;
  }
}

// After: Functional Component
const MyComponent = ({ id }) => {
  const [count, setCount] = useState(0);

  const fetchData = useCallback(() => { /* ... */ }, []);

  useEffect(() => {
    fetchData();
  }, [id, fetchData]);

  return <div>{count}</div>;
};
```

### 5.2 PropTypes Strategy

**Current:** 142 files with propTypes (React 19 ignores them - no runtime validation)

#### Why NOT Zod for Props

| Concern | Issue |
|---------|-------|
| **Wrong use case** | Zod is for runtime validation of external data (APIs, forms), not React props |
| **Runtime overhead** | Would validate on every render |
| **Bundle size** | Adds ~12KB minified |
| **Double work** | Must remove when adding TypeScript |
| **No React integration** | Doesn't integrate with React's prop flow or devtools |

**When to use Zod:** API response validation, form schemas, environment config.

#### Recommended Approach: Keep PropTypes + JSDoc Bridge

1. **Keep propTypes** for now - they serve as documentation
2. **Add JSDoc annotations** for enhanced IDE support (optional, as you touch files)
3. **Convert to TypeScript** when ready (future phase)

```jsx
// JSDoc bridge pattern (optional enhancement)
/**
 * @typedef {Object} JobButtonProps
 * @property {string} jobId - The job identifier
 * @property {function} onClick - Click handler
 * @property {boolean} [isSelected] - Whether button is selected
 */

/** @param {JobButtonProps} props */
const JobButton = ({ jobId, onClick, isSelected = false }) => {
  // Component implementation
};

// Keep propTypes for runtime documentation
JobButton.propTypes = {
  jobId: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  isSelected: PropTypes.bool,
};
```

### 5.3 forwardRef Simplification

**File:** `ui/job-view/pushes/JobButton.jsx`

React 19 allows passing `ref` as a regular prop, making `forwardRef` unnecessary.

**Action:** Convert during job-view batch migration.

### 5.4 Future: TypeScript Migration (Deferred)

**Status:** Deferred - focus on functional components first

**Why functional components first:**

- Typing functional components is simpler (`FC<Props>` pattern)
- Hooks are easier to type than lifecycle methods
- Class component TypeScript typing is verbose and error-prone

**When ready, recommended approach:**

1. Add TypeScript configuration (`tsconfig.json`)
2. Allow `.tsx` files alongside `.jsx`
3. Convert file-by-file (same order as class→functional migration)
4. Remove propTypes as each file converts to TypeScript

### 5.5 Run React 19 Codemods

```bash
npx codemod@latest react/19/migration-recipe
```

**Action:** Run after class→functional migration to catch any remaining patterns.

---

## Phase 6: API Type Safety (P2 - Medium Priority)

This phase adds type safety to API calls, preparing for TypeScript migration while providing immediate IDE benefits.

### Strategy Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                     API Type Safety Strategy                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Treeherder API ──────────► OpenAPI TypeScript Generation       │
│  (/api/schema/)              (zero runtime cost, auto-sync)     │
│                                                                  │
│  Taskcluster API ─────────► taskcluster-client-web              │
│                              (already has TS types built-in)    │
│                                                                  │
│  Bugzilla API ────────────► Zod schemas                         │
│  (external)                  (runtime validation)               │
│                                                                  │
│  Form Input ──────────────► Zod + react-hook-form               │
│                              (validation + type inference)      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.1 OpenAPI Type Generation (Treeherder API)

**Purpose:** Generate TypeScript types from backend's OpenAPI schema
**Runtime Cost:** None (types exist only at build/dev time)
**Backend Endpoint:** `/api/schema/` (already exists)

#### Setup Steps

1. **Install openapi-typescript**

   ```bash
   pnpm add -D openapi-typescript
   ```

2. **Add generation script to package.json**

   ```json
   {
     "scripts": {
       "generate:types": "openapi-typescript http://localhost:8000/api/schema/ -o ui/types/api.d.ts",
       "generate:types:prod": "openapi-typescript https://treeherder.mozilla.org/api/schema/ -o ui/types/api.d.ts"
     }
   }
   ```

3. **Create types directory**

   ```bash
   mkdir -p ui/types
   echo '// Auto-generated types - do not edit manually' > ui/types/api.d.ts
   ```

4. **Add to .gitignore (optional)**

   ```text
   # Or commit the generated types for CI that can't reach the backend
   # ui/types/api.d.ts
   ```

#### Usage (works in JS with VS Code)

```javascript
// ui/models/job.js
/** @typedef {import('../types/api').components['schemas']['Job']} Job */
/** @typedef {import('../types/api').paths['/api/jobs/']['get']['responses']['200']['content']['application/json']} JobListResponse */

/**
 * @returns {Promise<{data: JobListResponse, failureStatus: number|null}>}
 */
static async getList(options, config = {}) {
  // IDE now provides autocomplete for response shape
}
```

### 6.2 Zod for External APIs

**Purpose:** Runtime validation for APIs you don't control
**Use Cases:** Bugzilla, external services, any API without type guarantees

#### Setup

```bash
pnpm add zod
```

#### Example: Bugzilla API Schema

```javascript
// ui/schemas/bugzilla.js
import { z } from 'zod';

export const BugSchema = z.object({
  id: z.number(),
  summary: z.string(),
  status: z.string(),
  resolution: z.string().optional(),
  product: z.string(),
  component: z.string(),
  // Add fields as needed
});

export const BugSearchResponseSchema = z.object({
  bugs: z.array(BugSchema),
});

// Usage with type inference
/** @typedef {z.infer<typeof BugSchema>} Bug */
/** @typedef {z.infer<typeof BugSearchResponseSchema>} BugSearchResponse */
```

#### Usage Pattern

```javascript
// ui/helpers/bugzilla.js
import { BugSearchResponseSchema } from '../schemas/bugzilla';

export async function searchBugs(query) {
  const response = await fetch(`${bzBaseUrl}/rest/bug?${query}`);
  const data = await response.json();

  // Validate and get typed result
  const result = BugSearchResponseSchema.safeParse(data);

  if (!result.success) {
    console.error('Bugzilla API response validation failed:', result.error);
    // Handle gracefully - maybe return empty or throw
  }

  return result.data; // Typed as BugSearchResponse
}
```

### 6.3 Zod for Form Validation

**Purpose:** Type-safe form validation with react-hook-form integration
**Benefit:** Single schema defines both validation rules AND TypeScript types

#### Form Validation Setup

```bash
pnpm add @hookform/resolvers
# zod already installed from 6.2
```

#### Example: Bug Filing Form

```javascript
// ui/schemas/forms.js
import { z } from 'zod';

export const BugFileFormSchema = z.object({
  summary: z.string()
    .min(10, 'Summary must be at least 10 characters')
    .max(255, 'Summary too long'),
  description: z.string()
    .min(20, 'Please provide more detail'),
  product: z.string().min(1, 'Product is required'),
  component: z.string().min(1, 'Component is required'),
  severity: z.enum(['blocker', 'critical', 'major', 'normal', 'minor', 'trivial']),
});

/** @typedef {z.infer<typeof BugFileFormSchema>} BugFileFormData */
```

#### Usage with react-hook-form

```jsx
// ui/shared/BugFiler.jsx (after converting to functional)
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BugFileFormSchema } from '../schemas/forms';

const BugFiler = () => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(BugFileFormSchema),
  });

  const onSubmit = (data) => {
    // data is typed as BugFileFormData
    // All validation already passed
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('summary')} />
      {errors.summary && <span>{errors.summary.message}</span>}
      {/* ... */}
    </form>
  );
};
```

### 6.4 Files to Create

| File | Purpose |
|------|---------|
| `ui/types/api.d.ts` | Auto-generated from OpenAPI |
| `ui/schemas/bugzilla.js` | Zod schemas for Bugzilla API |
| `ui/schemas/forms.js` | Zod schemas for form validation |
| `ui/schemas/index.js` | Re-exports all schemas |

### 6.5 Migration Path

| Step | Action | Benefit |
|------|--------|---------|
| 1 | Set up OpenAPI type generation | IDE autocomplete for Treeherder API |
| 2 | Add Zod schemas for Bugzilla | Runtime validation for external data |
| 3 | Add Zod schemas for forms | Type-safe form validation |
| 4 | Gradually add JSDoc annotations | Bridge to TypeScript |
| 5 | Convert to TypeScript | Full type safety |

### When NOT to Use Zod

| Scenario | Use Instead |
|----------|-------------|
| Treeherder API responses | OpenAPI-generated types |
| React component props | PropTypes → TypeScript |
| Internal function parameters | JSDoc → TypeScript |
| Taskcluster API | Built-in types from taskcluster-client-web |

---

## Implementation Timeline

| Phase | Priority | Dependencies | Recommended Order |
|-------|----------|--------------|-------------------|
| Phase 1: React Router v7 | P1 | None | ✅ Done |
| Phase 2: Problematic Dependencies | P1 | Phase 1 | ✅ Done |
| **Phase 7: Test Coverage** | **P1** | None | **IMMEDIATE - before merging PRs** |
| Phase 3: Routine updates | P2 | Phase 2 | Batch together |
| Phase 5: Class → Functional | P2 | None | After test coverage |
| Phase 6: API Type Safety | P2 | None | Can run in parallel |
| Phase 4: Major versions | P3 | Phase 3 | Later |
| Future: TypeScript | P3 | Phase 5, 6 | After modernization |

### Recommended Execution Order

```text
IMMEDIATE (before merging 10-PR stack):
├── Phase 7.1: Add pinnedJobs store tests
├── Phase 7.1: Add notifications store tests
├── Phase 7.2: Navigation tests (✅ already added)
└── Rebase later PRs with new tests

NOW:
├── Phase 7.3: Add E2E smoke test for jobs view
├── Phase 5.1: job-view class → functional (8 components)
├── Phase 6.1: OpenAPI type generation setup
└── Phase 3: Routine dependency updates

NEXT:
├── Phase 7: Increase auth coverage (39% → 70%)
├── Phase 5.1: shared class → functional (14 components)
├── Phase 6.2: Zod for Bugzilla API
├── Phase 6.3: Zod for form validation
├── Phase 5.1: push-health, intermittent-failures (6 components)
└── Phase 2.1: react-lazylog replacement (if needed)

LATER:
├── Phase 5.1: perfherder class → functional (27 components)
├── Phase 4: Major version upgrades
├── Phase 7.8: Consider Playwright for E2E
└── Future: TypeScript migration (types already in place!)
```

---

## Risk Assessment

| Phase | Risk Level | Mitigation |
|-------|------------|------------|
| Phase 1 | ~~Low~~ | ✅ Completed |
| **Phase 7** | **Low** | **Tests reduce risk of all other phases** |
| Phase 2.1 | Medium | Test first, have fallback |
| Phase 2.2 | High | Defer, works at runtime |
| Phase 3 | Low | Routine minor updates |
| Phase 4 | Medium-High | Careful testing, staged rollout |
| Phase 5 | Low-Medium | Incremental by area, test each batch |
| Phase 6 | Low | Types are additive, Zod validation is opt-in |

### PR Stack Risk Without Tests: HIGH

| Factor | Impact |
|--------|--------|
| 10 PRs with 232 files changed | Large blast radius |
| Redux → Zustand (4 stores) | Core state management change |
| React 18 → 19 | Framework upgrade |
| Router 6 → 7 | Navigation changes |
| Missing store tests | Can't verify Zustand migration |

**Mitigation:** Add tests to earlier PRs, rebase later PRs with test coverage in place.

---

## Quick Reference: Outdated Packages

### Needs Attention (Peer Dependency Warnings)

| Package | Current | Issue |
|---------|---------|-------|
| react-table-6 | 6.11.0 | React 19 peer dep warning (works at runtime, deferred to Phase 4) |

### Inactive/Unmaintained (Tested OK)

| Package | Current | Status |
|---------|---------|--------|
| react-lazylog | 4.5.3 | INACTIVE but ✅ works with React 19 (react-virtualized supports it) |

### Recently Updated

| Package | Previous | Current | Status |
|---------|----------|---------|--------|
| react-highlight-words | 0.20.0 | 0.21.0 | ✅ Done |

### Major Version Updates Available

| Package | Current | Latest | Priority |
|---------|---------|--------|----------|
| ~~react-router-dom~~ | ~~6.28.0~~ | 7.11.0 | ✅ Done |
| @fortawesome/* | 6.7.2 | 7.1.0 | P3 |
| fuse.js | 6.0.4 | 7.1.0 | P3 |
| query-string | 7.0.1 | 9.3.1 | P3 |
| jest | 29.7.0 | 30.2.0 | P3 |
| fetch-mock | 9.4.0 | 12.6.0 | P3 |

---

## Phase 7: Test Coverage Expansion (P1 - High Priority)

This phase addresses test coverage gaps exposed during the React 19 upgrade and ensures the stability of the 10-PR stack currently pending merge.

### Current Test Coverage

| Metric | Coverage | Target |
|--------|----------|--------|
| **Statements** | 66.33% | 75%+ |
| **Branches** | 50.92% | 65%+ |
| **Functions** | 55.04% | 70%+ |
| **Lines** | 66.79% | 75%+ |

**Test Files:** 68 test files for 231 source files (29% ratio)

### Testing Framework Assessment

| Framework | Current | Latest | Action |
|-----------|---------|--------|--------|
| Jest | 29.7.0 | 30.2.0 | **Keep** - v29 stable, v30 too new |
| @testing-library/react | 16.2.0 | 16.3.1 | Minor update OK |
| Puppeteer | 24.34.0 | Latest | Keep - already installed |
| Playwright | Not installed | - | Consider for new E2E tests |

**Recommendation:** No urgent framework upgrades. Current stack works well with React 19.

### Low Coverage Areas (Priority Fixes)

| Area | Coverage | Risk | Action |
|------|----------|------|--------|
| `ui/job-view/details/shared` | 0% | High | Add tests for shared detail components |
| `ui/login-callback` | 27.27% | Medium | Add auth flow tests |
| `ui/infra-compare` | 37.86% | Medium | Add comparison logic tests |
| `ui/taskcluster-auth-callback` | 30% | Medium | Add callback handling tests |
| `ui/shared/auth` | 39.79% | High | Add AuthService tests |

### 7.1 Missing Store Tests

The Zustand migration introduced new stores that need dedicated tests:

| Store | Test File | Status |
|-------|-----------|--------|
| `pushStore` | `tests/ui/job-view/stores/pushes_test.jsx` | ✅ Exists (11 tests) |
| `selectedJobStore` | `tests/ui/job-view/stores/selectedJob_test.jsx` | ✅ Exists |
| `pinnedJobsStore` | Missing | ❌ **Add tests** |
| `notificationStore` | Missing | ❌ **Add tests** |

#### Tests to Add

```javascript
// tests/ui/job-view/stores/pinnedJobs_test.jsx
describe('PinnedJobs Zustand store', () => {
  test('should pin a job');
  test('should unpin a job');
  test('should toggle pin board visibility');
  test('should clear all pinned jobs');
  test('should not pin duplicate jobs');
  test('should count pinned jobs correctly');
});

// tests/ui/shared/notifications_test.jsx
describe('Notifications Zustand store', () => {
  test('should add a notification');
  test('should remove a notification by id');
  test('should clear all notifications');
  test('should auto-expire notifications after timeout');
  test('should limit maximum notifications displayed');
});
```

### 7.2 Navigation & Routing Tests

Tests added during React Router v7 migration:

| Test File | Tests | Purpose |
|-----------|-------|---------|
| `tests/ui/perfherder/Navigation_test.jsx` | 6 | v7_relativeSplatPath fix |
| `tests/ui/perfherder/alerts-view/downstream_summary_test.jsx` | 4 | Downstream link paths |
| `tests/ui/job-view/AppRoutes_test.jsx` | 4 | Legacy URL redirects |

#### Additional Navigation Tests Needed

```javascript
// tests/ui/shared/LogoMenu_test.jsx
describe('LogoMenu navigation', () => {
  test('should navigate to all main routes');
  test('should display correct icons');
});

// tests/ui/job-view/headerbars/ReposMenu_test.jsx
describe('Repository switching', () => {
  test('should update URL when switching repos');
  test('should preserve other query params');
});
```

### 7.3 Integration/E2E Test Strategy

**Current State:** Puppeteer is installed but integration tests are essentially empty.

#### Recommended Approach

| Test Type | Tool | Use For |
|-----------|------|---------|
| **Unit/Component** | Jest + RTL | Individual components, hooks, stores |
| **Integration** | Jest + Puppeteer | Multi-component flows, API mocking |
| **E2E/Smoke** | Puppeteer or Playwright | Critical user paths, real API |

#### Critical User Flows to Test

| Flow | Priority | Complexity |
|------|----------|------------|
| Load jobs view, click on job, see details | P0 | Medium |
| Filter jobs by status/keyword | P0 | Low |
| Pin/unpin jobs, see pinboard | P1 | Low |
| Navigate between perfherder views | P1 | Low |
| Switch repositories | P1 | Low |
| View push health for a revision | P2 | Medium |

#### E2E Test File Structure

```text
tests/ui/integration/
├── test-setup.js          # Existing
├── jobs-view.test.js      # TO ADD: Main jobs flow
├── perfherder.test.js     # TO ADD: Performance alerts flow
├── push-health.test.js    # TO ADD: Push health flow
└── navigation.test.js     # TO ADD: Cross-app navigation
```

### 7.4 PR Stack Risk Mitigation

**Current Situation:** 10 PRs touching 232 files with ~16,000 lines changed

| PR Focus | Files Changed | Risk | Test Coverage |
|----------|---------------|------|---------------|
| Zustand: notifications | ~20 | Medium | ❌ No store tests |
| Zustand: pinnedJobs | ~25 | Medium | ❌ No store tests |
| Zustand: selectedJob | ~30 | Medium | ✅ Store tests exist |
| Zustand: pushStore | ~50 | High | ✅ Store tests exist |
| React Router future flags | ~10 | Low | ✅ AppRoutes tests |
| React 19 upgrade | ~100 | High | ⚠️ Partial |
| React Router v7 | ~55 | Medium | ✅ Navigation tests |

#### Recommendation: Add Tests Earlier in Stack

**YES - go back and add tests to earlier PRs before merging:**

1. **After Zustand notifications PR:** Add `notifications_test.jsx`
2. **After Zustand pinnedJobs PR:** Add `pinnedJobs_test.jsx`
3. **After React 19 PR:** Add smoke tests for critical flows
4. **After Router v7 PR:** Navigation tests already added ✅

**Rationale:**

- Catch regressions earlier in the stack
- Easier to debug failures (smaller change set)
- Prevent cascading issues in later PRs
- Rebasing later PRs is manageable with tests in place

### 7.5 Test Quality Improvements

#### Reduce act() Warning Noise

Already addressed in `tests/ui/test-setup.js`:

- Suppressed known async patterns
- Mocked @restart/ui/usePopper
- Added React 19 act environment flag

#### Testing Patterns to Adopt

| Pattern | Example | Benefit |
|---------|---------|---------|
| **Test stores directly** | `usePushStore.getState().fetchPushes()` | Fast, isolated |
| **Mock at boundaries** | `fetchMock.get('/api/jobs/')` | Realistic behavior |
| **Avoid implementation details** | Query by role, not class | Refactor-resistant |
| **Test user flows** | Click button → verify state change | User-focused |

### 7.6 Coverage Targets by Phase

| Milestone | Statement Coverage | Branch Coverage | Timeline |
|-----------|-------------------|-----------------|----------|
| **Current** | 66.33% | 50.92% | Now |
| **After store tests** | 70%+ | 55%+ | +1 week |
| **After navigation tests** | 72%+ | 58%+ | +2 weeks |
| **After E2E smoke tests** | 75%+ | 60%+ | +4 weeks |
| **Long-term target** | 80%+ | 70%+ | Ongoing |

### 7.7 Immediate Action Items

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P0 | Add `pinnedJobs_test.jsx` | 2h | Covers Zustand migration |
| P0 | Add `notifications_test.jsx` | 2h | Covers Zustand migration |
| P1 | Add E2E smoke test for jobs view | 4h | Catches critical regressions |
| P1 | Increase auth coverage | 3h | Security-critical path |
| P2 | Add infra-compare tests | 2h | Low-risk coverage gap |
| P2 | Add LogoMenu/ReposMenu tests | 2h | Navigation coverage |

### 7.8 Future Considerations

#### Vitest Migration (Defer)

| Consideration | Assessment |
|---------------|------------|
| Speed | Vitest is faster, but Jest is fast enough |
| React 19 | Both work well |
| Migration effort | Medium - different config, some API differences |
| Recommendation | **Defer** - not worth the churn during upgrades |

#### Playwright Adoption (Consider)

| Consideration | Assessment |
|---------------|------------|
| vs Puppeteer | Better DX, auto-waiting, better debugging |
| Migration | Would be new addition, not replacement |
| Use case | New E2E tests, not existing unit tests |
| Recommendation | **Consider** for new E2E test suite |

#### Visual Regression Testing (Optional)

| Tool | Use Case | Effort |
|------|----------|--------|
| Percy | Catch unintended visual changes | Medium |
| Chromatic | Storybook-based visual testing | Medium |
| Playwright snapshots | Built-in screenshot comparison | Low |

**Recommendation:** Defer visual regression testing until after core test coverage gaps are filled.

---

## References

- [React Router v7 Upgrade Guide](https://reactrouter.com/upgrading/v6)
- [Font Awesome 7 Migration](https://docs.fontawesome.com/upgrade/whats-changed)
- [TanStack Table v8](https://tanstack.com/table) (for future react-table migration)
- [react-lazylog GitHub (INACTIVE)](https://github.com/mozilla-frontend-infra/react-lazylog)
- [Jest 29 Documentation](https://jestjs.io/docs/29.x/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
