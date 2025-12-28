# Biome Code Cleanup TODO

This document lists suggested code improvements identified during the Biome migration. Items are prioritized by impact and effort.

## Priority 1: Quick Wins (Low effort, High value)

### Fix Missing React Keys

**Rule:** `useJsxKeyInIterable`
**Current:** warn
**Files:**

- `ui/infra-compare/InfraCompareTable.jsx:74` - Add key to `<tbody>`
- `ui/infra-compare/InfraCompareTableControls.jsx:134` - Add key to `<InfraCompareTable>`
- `ui/perfherder/alerts/AlertHeader.jsx:233` - Add key to `<Link>`
- `ui/shared/AdditionalInformationTable.jsx:165` - Add key to `<tr>`
- `ui/shared/AdditionalInformationTable.jsx:183` - Add key to `<tr>`

**Why:** Missing keys can cause React rendering bugs and performance issues.

### Remove Unused Variables

**Rule:** `noUnusedVariables`
**Current:** warn
**Files:**

- `ui/perfherder/graphs/GraphsContainer.jsx:325` - `selectedDataPoint` unused
- `ui/perfherder/graphs/GraphsContainer.jsx:326` - `highlightAlerts` unused

**Why:** Dead code that should be removed.

### Fix Import Assignment

**Rule:** `noImportAssign`
**Current:** warn
**File:** `ui/taskcluster-auth-callback/TaskclusterCallback.jsx:30`

**Why:** Reassigning an imported variable is a bug - imports are read-only. Use a local variable instead.

---

## Priority 2: Code Quality (Medium effort, High value)

### Fix Async Promise Executor

**Rule:** `noAsyncPromiseExecutor`
**Current:** warn
**File:** `ui/shared/auth/AuthService.js:19`

**Why:** Async promise executors can silently swallow errors. Refactor to use async/await directly without wrapping in Promise.

### Enable React Hooks Exhaustive Dependencies

**Rule:** `useExhaustiveDependencies`
**Current:** off
**Estimated files:** ~10

**Why:** Missing dependencies in useEffect/useCallback can cause stale closures and subtle bugs.

### Enable Array Index Key Warnings

**Rule:** `noArrayIndexKey`
**Current:** off
**Estimated files:** ~5

**Why:** Using array index as key can cause issues when list items are reordered or filtered.

---

## Priority 3: Performance (Medium effort, Medium value)

### Fix Accumulating Spread Operations

**Rule:** `noAccumulatingSpread`
**Current:** off
**Files:** Multiple locations in reducers and helpers

**Why:** Spreading in a loop (e.g., `arr.reduce((acc, x) => [...acc, x])`) is O(n²). Use `push()` or `concat()` instead.

### Enable useFlatMap

**Rule:** `useFlatMap`
**Current:** off

**Why:** Replace `.map().flat()` with `.flatMap()` for better performance and readability.

---

## Priority 4: Accessibility (Higher effort, High value)

### Enable Semantic Elements

**Rule:** `useSemanticElements`
**Current:** off
**Estimated files:** ~15

**Why:** Using `role="button"` on `<div>` instead of `<button>` reduces accessibility. Requires careful testing.

### Enable ARIA Props Validation

**Rule:** `useAriaPropsSupportedByRole`
**Current:** off

**Why:** Ensures ARIA attributes are valid for the element's role.

### Enable SVG Accessibility

**Rule:** `noSvgWithoutTitle`
**Current:** off
**File:** `ui/shared/GraphIcon.jsx:28`

**Why:** SVGs should have titles for screen readers.

---

## Priority 5: Code Style (Optional)

### Enable Formatter

**Current:** disabled

Enabling the Biome formatter would standardize code style across the codebase. This is a large change that would touch many files. Consider doing this in a separate PR.

### Enable Import Organization

**Current:** disabled

Biome can auto-organize imports. This would be a large change affecting many files.

### Refactor Static-Only Classes

**Rule:** `noStaticOnlyClass`
**Current:** off
**Files:** Multiple files in `ui/models/`

**Why:** Classes with only static methods could be plain objects or ES modules. This is a stylistic preference.

---

## How to Enable Rules

To enable a rule, update `biome.json`:

```json
{
  "linter": {
    "rules": {
      "correctness": {
        "useJsxKeyInIterable": "error"  // Change from "warn" to "error"
      }
    }
  }
}
```

To auto-fix issues where possible:

```bash
pnpm biome lint --write
```

---

## Tracking Progress

- [ ] Priority 1: Quick Wins
- [ ] Priority 2: Code Quality
- [ ] Priority 3: Performance
- [ ] Priority 4: Accessibility
- [ ] Priority 5: Code Style (optional)
