# Push Health Functions Analysis

## Overview

This document analyzes the push health API endpoints and their supporting functions to identify usage patterns, redundancy, and opportunities for consolidation.

---

## API Endpoints (push.py)

### 1. `health_new_failures` (lines 449-543)

**Status:** ⚠️ **Should be deprecated** - Replaced by the combination of `health_summary_new_failures` + `health_details_new_failures`

**Usage:**

- Returns complete health data for a single push
- Only includes jobs with `failure_classification_id=6` (new unclassified failures)
- Requires `revision` parameter

**Returns:**

- Full response including:
  - Commit history
  - Status counts
  - All test/build/lint failure details
  - Jobs list

**Redundancy:**

- This is the **OLD monolithic endpoint** that has been replaced by the split endpoints below
- Does everything in one request, which can be slow
- Should be deprecated in favor of the progressive loading approach

---

### 2. `health_summary` (lines 246-350)

**Status:** ✅ **Keep** - Used for general health summaries across multiple pushes

**Usage:**

- Returns health summary for one or more pushes
- Can query by `revision` (comma-separated list), `author`, or `count`
- Gets **ALL** failures regardless of classification
- Supports multiple repositories with `all_repos` parameter
- Optionally includes commit history with `with_history` parameter

**Returns:**

- Summary data per push:
  - Failure counts (tests, builds, lints)
  - Status object
  - Metrics with results only (not detailed failures)
  - Optional commit history

**Unique capabilities:**

- Handles multiple pushes at once
- Queries by author across repos
- No classification filtering (gets all failures)

**Not redundant:** This serves a different use case than the new_failures endpoints

---

### 3. `health_summary_new_failures` (lines 546-582)

**Status:** ✅ **Keep** - Part of the new progressive loading pattern

**Usage:**

- Fast endpoint that returns only basic push metadata
- Designed for immediate page load (before expensive queries complete)
- Requires `revision` parameter

**Returns:**

- Lightweight response:
  - Revision and push ID
  - Commit history
  - Status counts

**Does NOT include:**

- Any test/build/lint failure details
- Jobs list
- Failure classifications

**Redundancy:**

- **Not redundant** - This is intentionally minimal for performance
- Should be called concurrently with `health_details_new_failures`

---

### 4. `health_details_new_failures` (lines 585-705)

**Status:** ✅ **Keep** - Part of the new progressive loading pattern

**Usage:**

- Returns detailed failure information for a push
- Supports filtering by classification IDs (default: "6")
- Supports limiting number of failures with `limit` parameter
- Requires `revision` parameter

**Query Parameters:**

- `revision`: Push revision (required)
- `limit`: Max failures to return (optional)
- `classification_ids`: Comma-separated IDs like "6" or "1,6,8" (default: "6")
  - 1 = Fixed by commit
  - 6 = New failure (not classified)
  - 8 = Intermittent

**Returns:**

- Detailed response:
  - All test/build/lint failure details
  - Jobs list
  - Metrics with full details
  - Metadata about limits and filtering

**Does NOT include:**

- Commit history (that's in summary endpoint)

**Redundancy:**

- **Not redundant** - This complements `health_summary_new_failures`
- Together they enable progressive page loading

---

## Supporting Functions (tests.py)

### 5. `get_test_failure_jobs` (lines 190-229)

**Status:** ✅ **Keep** - Used by general health endpoints

**Usage:**

- Gets **ALL** test failure jobs for a push (no classification filtering)
- Also fetches passing jobs of same types for accurate `totalJobs` calculation

**Query:**

```python
Job.objects.filter(
    push=push,
    tier__lte=2,
    result="testfailed",
)
.exclude(lint, mozlint, build jobs)
```

**Returns:**

- `(result_status, jobs)` tuple
- `jobs` dict grouped by job type name

**Called by:**

- `health_summary` endpoint

**Redundancy:**

- **Not redundant** - Needed for endpoints that want ALL failures, not just specific classifications

---

### 6. `get_test_failures` (lines 232-280)

**Status:** ✅ **Keep** - Used by general health endpoints

**Usage:**

- Gets test failures from given jobs (no classification filtering)
- Fetches intermittent and fixed-by-commit history
- Sets classifications based on history analysis
- Applies failure filtering rules

**Process:**

1. Queries FailureLines for the push
2. Builds test failure data structures
3. Fetches historical classification data (intermittent, fixed-by-commit)
4. Classifies failures based on history
5. Groups failures by classification

**Returns:**

- `(result, failures)` tuple
- `result`: "pass", "fail", "unknown", or "none"
- `failures`: Grouped failures dict

**Called by:**

- `health_summary` endpoint

**Redundancy:**

- **Not redundant** - Needed for endpoints that want ALL failures with historical classification

---

### 7. `get_test_failure_jobs_by_classification` (lines 301-353)

**Status:** ⚠️ **Potentially redundant with parameter enhancement**

**Usage:**

- Gets test failure jobs filtered by `failure_classification_id`
- Default: `classification_ids=[6]` (new failures only)
- Also fetches passing jobs for totalJobs calculation

**Query:**

```python
Job.objects.filter(
    push=push,
    tier__lte=2,
    result="testfailed",
    failure_classification_id__in=classification_ids,
)
.exclude(lint, mozlint, build jobs)
```

**Returns:**

- `(result_status, jobs)` tuple
- Same format as `get_test_failure_jobs`

**Called by:**

- `health_new_failures` endpoint
- `health_details_new_failures` endpoint

**Redundancy analysis:**

- **Could be consolidated** with `get_test_failure_jobs` by adding an optional `classification_ids` parameter
- If `classification_ids=None`, query ALL failures (current `get_test_failure_jobs` behavior)
- If `classification_ids` provided, filter by those IDs (current `get_test_failure_jobs_by_classification` behavior)

---

### 8. `get_test_failures_by_classification` (lines 356-514)

**Status:** ⚠️ **Potentially redundant with parameter enhancement**

**Usage:**

- Gets test failures filtered by classification IDs with optional limit
- Default: `classification_ids=[6]`
- Includes performance optimization: queries FailureLine by push + classification directly
- Conditionally skips expensive history queries when `classification_ids=[6]`

**Key optimization:**

```python
# OLD approach (slow): Filter jobs first, then query failure lines by job IDs
# NEW approach (fast): Query failure lines directly by push and classification_id
failure_lines = FailureLine.objects.filter(
    job_log__job__push=push,
    job_log__job__failure_classification_id__in=classification_ids,
)
```

**Parameters:**

- `push`: Push object
- `jobs`: Pre-fetched jobs dict
- `result_status`: Set of result statuses
- `classification_ids`: List of IDs (default: [6])
- `limit`: Optional limit on failures returned

**Returns:**

- `(result, failures)` tuple
- Same format as `get_test_failures`

**Called by:**

- `health_new_failures` endpoint
- `health_details_new_failures` endpoint

**Redundancy analysis:**

- **Could be consolidated** with `get_test_failures` by:
  - Adding optional `classification_ids` parameter
  - Adding optional `limit` parameter
  - Applying the FailureLine query optimization to both paths
- If `classification_ids=None`, get ALL failures (current `get_test_failures` behavior)
- If `classification_ids` provided, filter and optimize (current `get_test_failures_by_classification` behavior)

---

## Recommendations

### 1. Deprecate `health_new_failures` endpoint

**Reason:** Replaced by the progressive loading pattern

**Migration path:**

- Frontend should call both:
  1. `health_summary_new_failures` (returns immediately with basic data)
  2. `health_details_new_failures` (returns when detailed query completes)

**Timeline:**

- Mark as deprecated in API docs
- Monitor usage via analytics
- Remove after migration period (e.g., 3-6 months)

---

### 2. Consolidate job-fetching functions

**Combine:** `get_test_failure_jobs` + `get_test_failure_jobs_by_classification`

**Proposed signature:**

```python
def get_test_failure_jobs(push, classification_ids=None):
    """
    Get test failure jobs for a push.

    Args:
        push: Push object
        classification_ids: Optional list of classification IDs to filter by.
                           If None, returns ALL failed jobs.
                           Common values: [6] (new), [1,6,8] (all failures)

    Returns:
        (result_status, jobs) tuple
    """
```

**Benefits:**

- Single function to maintain
- Consistent query pattern
- Optional filtering without code duplication

**Migration:**

- Update callers:
  - `health_summary`: `get_test_failure_jobs(push)` (no change)
  - `health_details_new_failures`: `get_test_failure_jobs(push, classification_ids=[6])`

---

### 3. Consolidate failure-fetching functions

**Combine:** `get_test_failures` + `get_test_failures_by_classification`

**Proposed signature:**

```python
def get_test_failures(push, jobs, result_status=set(), classification_ids=None, limit=None):
    """
    Get test failures for a push with optional filtering.

    Args:
        push: Push object
        jobs: Dict of jobs by job type name
        result_status: Set of result statuses
        classification_ids: Optional list of classification IDs to filter by.
                           If None, returns ALL failures.
                           If provided, uses optimized query path.
        limit: Optional limit on number of failures to return.
               Only applies when classification_ids is provided.

    Returns:
        (result, failures) tuple
    """
```

**Implementation approach:**

1. If `classification_ids=None`:
   - Use existing `get_test_failures` logic (query all FailureLines)
   - Always fetch and apply history-based classification
2. If `classification_ids` provided:
   - Use optimized FailureLine query (filter by push + classification_id directly)
   - Conditionally fetch history only if needed (skip for [6])
   - Apply limit if provided

**Benefits:**

- Single function with optimized paths for different use cases
- Reduces code duplication
- Centralizes the performance optimization logic

**Migration:**

- Update callers:
  - `health_summary`: `get_test_failures(push, jobs, result_status)` (no change)
  - `health_details_new_failures`: `get_test_failures(push, jobs, result_status, classification_ids=[6], limit=100)`

---

## Summary Matrix

| Function | Status | Used By | Can Consolidate? |
|----------|--------|---------|------------------|
| `health_new_failures` | ⚠️ Deprecate | Legacy endpoint | Yes - replace with summary + details |
| `health_summary` | ✅ Keep | Multi-push queries | No - unique use case |
| `health_summary_new_failures` | ✅ Keep | Progressive loading | No - performance critical |
| `health_details_new_failures` | ✅ Keep | Progressive loading | No - performance critical |
| `get_test_failure_jobs` | ⚠️ Consolidate | health_summary | Yes - merge with _by_classification |
| `get_test_failures` | ⚠️ Consolidate | health_summary | Yes - merge with _by_classification |
| `get_test_failure_jobs_by_classification` | ⚠️ Consolidate | new_failures endpoints | Yes - add params to get_test_failure_jobs |
| `get_test_failures_by_classification` | ⚠️ Consolidate | new_failures endpoints | Yes - add params to get_test_failures |

---

## Implementation Priority

1. **High Priority:** Consolidate `get_test_failure_jobs` functions
   - Low risk - internal API only
   - Reduces maintenance burden
   - Preserves performance optimizations

2. **High Priority:** Consolidate `get_test_failures` functions
   - Low risk - internal API only
   - Reduces code duplication
   - Centralizes optimization logic

3. **Medium Priority:** Deprecate `health_new_failures` endpoint
   - Requires frontend migration
   - Monitor usage first
   - Document migration path

4. **Low Priority:** Consider consolidating all health endpoints
   - Could have single `/health/` endpoint with parameters
   - Would require API versioning strategy
   - Postpone until clear need arises
