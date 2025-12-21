# Zustand Migration Notes for Job Selection

This document captures learnings from fixing the job selection race condition that should inform the Zustand migration.

## The Race Condition Problem

When clicking jobs rapidly, the details panel would sometimes disappear while the job button remained visually selected. The root cause was **selection logic duplicated in two places**:

1. `PushJobs.selectJob` was calling `setSelected(true)` and tracking the instance
2. `doSelectJob` in the Redux reducer was also trying to select/deselect jobs

This caused a race condition where:

1. PushJobs called `jobInstance.setSelected(true)`
2. PushJobs tracked the instance via `setCurrentlySelectedInstance(job.id, jobInstance)`
3. PushJobs dispatched `setSelectedJob(job)`
4. `doSelectJob` called `getCurrentlySelectedInstance()` - returning the instance we just tracked!
5. `doSelectJob` called `selected.setSelected(false)` - **immediately deselecting the job**

## The Fix

We centralized all selection logic in `doSelectJob` and simplified `PushJobs.selectJob` to only dispatch the action:

```javascript
// PushJobs.jsx - simplified
const selectJob = useCallback(
  (job) => {
    // Let doSelectJob handle all selection logic
    setSelectedJob(job);
  },
  [setSelectedJob],
);
```

## Recommendations for Zustand Migration

### 1. Move Instance Tracking INTO the Store

Instead of module-level variables in `useJobButtonRegistry.js`:

```javascript
// Current approach (module-level tracking)
let currentlySelectedInstance = null;
let currentlySelectedJobId = null;
```

Move this into the Zustand store:

```javascript
// Recommended Zustand store structure
const useJobSelectionStore = create((set, get) => ({
  selectedJob: null,
  selectedInstance: null, // Track the imperative handle here!

  selectJob: (job) => {
    const { selectedInstance } = get();

    // Deselect old job using tracked instance
    if (selectedInstance) {
      selectedInstance.setSelected(false);
    }

    // Find and select new job
    const newInstance = findJobInstance(job.id);
    if (newInstance) {
      newInstance.setSelected(true);
    }

    // Update URL
    const taskRun = job ? getTaskRunStr(job) : null;
    setUrlParam('selectedTaskRun', taskRun);

    set({
      selectedJob: job,
      selectedInstance: newInstance
    });
  },

  clearSelectedJob: (countPinnedJobs) => {
    if (!countPinnedJobs) {
      const { selectedInstance } = get();
      if (selectedInstance) {
        selectedInstance.setSelected(false);
      }
      set({ selectedJob: null, selectedInstance: null });
    }
  }
}));
```

### 2. Benefits of This Approach

1. **Single source of truth** - Selection state and instance tracking are co-located
2. **No race conditions** - The store action handles everything atomically
3. **Testable** - Can mock the store in tests without module-level state
4. **Debuggable** - Zustand devtools will show the selection state changes

### 3. Class Components to Convert

These class components interact with job selection and would benefit from conversion to functional components with Zustand hooks:

| Component | Priority | Reason |
|-----------|----------|--------|
| `KeyboardShortcuts.jsx` | High | Uses `changeJob()` which does DOM queries for navigation |
| `PinBoard.jsx` | Medium | Interacts with selection when pinning jobs |
| `App.jsx` | Lower | Main orchestration, larger effort |

### 4. DOM Query Dependencies

The current code relies on DOM queries in several places:

- `findJobInstance(jobId)` - queries `#push-list button[data-job-id='${jobId}']`
- `findSelectedInstance()` - queries `#push-list .job-btn.selected-job`
- `findGroupElement(job)` - queries `#push-list span[data-group-key='${groupMapKey}']`

These could potentially be replaced with registry lookups if the job button registry is enhanced to track more information.

### 5. Files Modified in This Fix

For reference, these files were modified to fix the race condition:

- `ui/hooks/useJobButtonRegistry.js` - Added instance tracking functions
- `ui/helpers/job.js` - Modified `findInstance` to traverse DOM, `findSelectedInstance` to use tracking
- `ui/job-view/redux/stores/selectedJob.js` - Modified `doSelectJob` and `doClearSelectedJob`
- `ui/job-view/pushes/PushJobs.jsx` - Simplified `selectJob` to only dispatch action
- `tests/ui/job-view/selected_job_test.jsx` - Added `#push-list` wrapper and registry cleanup

## Testing Considerations

When testing job selection with Zustand:

1. Clear the store state between tests
2. If using instance tracking in the store, ensure tests wrap components in `#push-list`
3. Consider mocking `findJobInstance` to return controlled test instances
