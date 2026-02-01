# Job Selection Race Condition Fix

## Problem

When rapidly clicking jobs in the Treeherder job view (4-6 times), the details panel would close unexpectedly even though a job appeared visually selected. The URL would show the job as deselected.

This was particularly noticeable when:

- Clicking jobs across different pushes
- Clicking jobs further down the list
- Clicking multiple jobs in quick succession

## Root Causes Identified

### 1. Stale jobMap Closure in URL-First Architecture

The original "URL-first" architecture had a race condition:

1. Click job → `selectJobViaUrl(job)` → URL updates
2. URL change triggers `syncSelectionFromUrl(jobMap)` in React useEffect
3. The `jobMap` in the effect closure could be stale during rapid clicks
4. When job not found in stale `jobMap` → `doClearSelectedJob()` → panel closes

### 2. React Re-render Between mousedown and click Events

When clicking a job:

1. `mousedown` fires → job selected → React re-renders button (adds selected styling)
2. DOM changes between `mousedown` and `mouseup`
3. `click` event fires with target as parent element (e.g., `<tbody>`) instead of the button
4. `clearIfEligibleTarget` sees `<tbody>` as an eligible clear target and incorrectly clears the just-selected job

### 3. Incorrect Truthy Check for Pinned Jobs

`doClearSelectedJob({})` was sometimes called with an empty object `{}`, which is truthy in JavaScript. The check `if (!countPinnedJobs)` failed because `!{}` is `false`, preventing visual deselection.

## Solution

### Fix 1: Dispatch SELECT_JOB Directly on Click

Modified `selectJobViaUrl` to dispatch `SELECT_JOB` with the job object directly before updating the URL. This bypasses the need to look up the job from the potentially stale `jobMap`.

```javascript
export const selectJobViaUrl = (job) => {
  return (dispatch) => {
    if (job) {
      lastJobSelectionTime = Date.now();
      dispatch({ type: SELECT_JOB, job }); // Direct update, no lookup needed
    }
    const taskRun = job ? getTaskRunStr(job) : null;
    const params = setUrlParams([['selectedTaskRun', taskRun]]);
    dispatch(pushRoute({ search: params }));
  };
};
```

### Fix 2: Skip Re-lookup When State Matches URL

Modified the `SYNC_JOB_FROM_URL` reducer case to check if Redux state already matches the URL before attempting a re-lookup from `jobMap`:

```javascript
case SYNC_JOB_FROM_URL: {
  const selectedTaskRun = getUrlParam('selectedTaskRun');
  const currentTaskRun = state.selectedJob
    ? getTaskRunStr(state.selectedJob)
    : null;
  if (selectedTaskRun === currentTaskRun) {
    return state; // Already in sync, skip re-lookup
  }
  return doSyncSelectionFromUrl(jobMap, notify);
}
```

### Fix 3: Track Selection Timestamp to Prevent Race Condition

Added timestamp tracking to detect when a job was just selected (within 100ms):

```javascript
let lastJobSelectionTime = 0;

export const wasJobJustSelected = () => {
  return Date.now() - lastJobSelectionTime < 100;
};
```

Used in `PushList.jsx` to prevent `clearIfEligibleTarget` from clearing a just-selected job:

```javascript
if (isEligible) {
  if (wasJobJustSelected()) {
    return; // Don't clear if job was just selected
  }
  clearJobViaUrl();
}
```

### Fix 4: Properly Handle Empty Object for Pinned Jobs Check

Fixed `doClearSelectedJob` to properly check for pinned jobs regardless of whether the parameter is a number or an empty object:

```javascript
const hasPinnedJobs =
  typeof countPinnedJobs === 'number'
    ? countPinnedJobs > 0
    : Object.keys(countPinnedJobs || {}).length > 0;

if (!hasPinnedJobs) {
  // Clear visual selection
}
```

### Fix 5: Scroll Selected Job Into View on Page Load

Added scroll functionality to `doSelectJob` so that when a page loads with a `selectedTaskRun` URL parameter, the selected job scrolls into view above the details panel:

```javascript
requestAnimationFrame(() => {
  const buttonEl = document.querySelector(
    `#push-list button[data-job-id='${job.id}']`,
  );
  if (buttonEl && typeof buttonEl.scrollIntoView === 'function') {
    buttonEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
```

## Files Changed

| File | Changes |
|------|---------|
| `ui/job-view/redux/stores/selectedJob.js` | Added timestamp tracking, direct SELECT_JOB dispatch, reducer sync check, fixed pinned jobs check, added scroll-into-view |
| `ui/job-view/pushes/PushList.jsx` | Added `wasJobJustSelected()` check in `clearIfEligibleTarget` |
| `tests/ui/job-view/stores/selectedJob_test.jsx` | Updated tests to expect SELECT_JOB action before URL update, changed `toBeUndefined()` to `toBeNull()` |

## Verification

1. **Rapid clicking test**: Click 6+ different jobs rapidly - details panel stays open and updates with each click
2. **Cross-push clicking**: Click jobs in different pushes - selection works correctly
3. **Clear on empty space**: Click empty space in push list - details panel closes correctly
4. **Visual deselection**: When clicking empty space, previously selected job returns to normal styling
5. **Page reload**: Load page with `selectedTaskRun` URL param - job scrolls into view
6. **Back/forward navigation**: Browser back/forward buttons work correctly
7. **All existing tests pass**: `pnpm test -- tests/ui/job-view/stores/selectedJob_test.jsx`

## Commits

1. `fix: Clicking different jobs eventually closes details panel now fixed` - Main fix for race conditions
2. `fix: Scroll selected job into view on page load` - Added scroll-into-view functionality
