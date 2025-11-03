# Bootstrap 5 Migration - Deep Component Investigation

**Date:** 2025-11-01
**Purpose:** Comprehensive investigation of spacing, proportions, and font sizes on the main Treeherder page after Bootstrap 4 to Bootstrap 5 migration
**Scope:** Main Jobs View page component hierarchy from top to bottom
**Updated:** 2025-11-01 with real visual measurements from production vs local

---

## ACTUAL MEASUREMENTS: Production vs Local

**Methodology:** Using browser MCP tools to measure computed styles on both environments
**Production URL:** <https://treeherder.mozilla.org/jobs?repo=autoland>
**Local URL:** <http://localhost:5001/jobs?repo=autoland>

### Top Navbar Measurements

| Element | Production (Actual) | Local (Actual) | Difference | Status |
|---------|-------------------|---------------|------------|--------|
| Top navbar height | 34px | 33px | -1px | ⚠️ MISMATCH |
| Top navbar padding-top | 1px | 2px | +1px | ⚠️ MISMATCH |
| Top navbar line-height | 19.88px | 28px | +8.12px | ⚠️ MISMATCH |
| Nav menu button font-size | 13px | 12.25px (0.875rem) | -0.75px | ❌ CRITICAL |
| Nav menu button height | 30px | 30px | 0px | ✅ MATCH |
| Nav menu button line-height | 19.5px | 19.5px | 0px | ✅ MATCH |
| Secondary navbar height | 34px | 33px | -1px | ⚠️ MISMATCH |
| Filter chicklets font-size | 14px (1rem) | 12.25px (0.875rem) | -1.75px | ❌ CRITICAL |

### Root Cause Analysis

**CRITICAL ISSUE: `.btn-view-nav` font-size override**

**Location:** `ui/css/treeherder-navbar.css:402`

```css
.btn-view-nav,
.btn-view-nav:visited {
  background-color: transparent;
  border-color: #373d40;
  color: lightgray;
  border-radius: 0;
  border-bottom: 0;
  border-top: 0;
  border-right: 0;
  font-size: 0.875rem;  /* ← THIS OVERRIDES --bs-btn-font-size custom property! */
}
```

**Why this is a problem:**

1. `.nav-menu-btn` sets `--bs-btn-font-size: 13px` (custom property)
2. Bootstrap 5's `.btn` class uses `font-size: var(--bs-btn-font-size, 1rem)`
3. `.btn-view-nav` has higher specificity and sets `font-size: 0.875rem` (12.25px)
4. Direct `font-size` property wins over custom property reference
5. **Result:** All navbar buttons render at 12.25px instead of 13px

**Same issue affects:**

- All top navbar buttons (Push Health, Infra, Repos, Tiers, Filters, Help)
- Filter chicklets in secondary navbar
- Any button with `.btn-view-nav` class

**Fix Required:**
Remove `font-size: 0.875rem;` from `.btn-view-nav` on line 402, or change it to use custom property.

---

## Executive Summary

This investigation examines the entire component hierarchy of the main Treeherder Jobs View page to identify styling inconsistencies resulting from the Bootstrap 4 → Bootstrap 5 migration. The analysis covers:

1. **Component hierarchy** from `App.jsx` down to individual buttons and links
2. **Bootstrap 4 → 5 class changes** that may have been missed
3. **Font size inheritance issues** where global styles conflict with component-specific needs
4. **Spacing and proportion problems** from Bootstrap's changed defaults
5. **CSS conflicts** between custom styles and Bootstrap 5 conventions

---

## Application Structure Overview

### Entry Point

**File:** `ui/index.jsx`

**CSS Load Order:**

1. `ui/css/bootstrap-custom.scss` - Custom Bootstrap 5 build with Treeherder variables
2. `ui/css/treeherder-custom-styles.css` - Global custom styles
3. `ui/css/treeherder-navbar.css` - Navigation bar styles
4. `ui/css/treeherder-base.css` - Base styles

**Critical Observations:**

- Bootstrap 5 is customized with `$font-size-root: 14px` (line 5) to maintain original sizing
- Font family set to `"Helvetica Neue", Helvetica, Arial, sans-serif` (line 11)
- Line height: `1.42857143` to match Bootstrap 4 (line 14)

---

## Component Hierarchy Analysis (Top to Bottom)

### Level 1: Root Application (`ui/App.jsx`)

**Purpose:** Router setup and main app container
**Bootstrap Components:** None (React Router only)
**Issues:** None identified

---

### Level 2: Main Jobs View (`ui/job-view/App.jsx`)

**Component Structure:**

```
App
├── KeyboardShortcuts
├── PrimaryNavBar (Level 3)
├── SplitPane
│   ├── ActiveFilters (Level 3)
│   ├── UpdateAvailable (Level 3)
│   ├── PushList (Level 3)
│   └── DetailsPanel (Level 3)
└── Notifications
```

**Critical CSS Files:**

- `ui/css/treeherder.css`
- `ui/css/treeherder-navbar-panels.css`
- `ui/css/treeherder-notifications.css`
- `ui/css/treeherder-details-panel.css`
- `ui/css/failure-summary.css`
- `ui/css/treeherder-job-buttons.css`
- `ui/css/treeherder-pushes.css`
- `ui/css/treeherder-pinboard.css`

**Layout Structure:**

- Uses `SplitPane` for resizable layout (horizontal split)
- Top section: Filters + Push List (default 60% height when job selected)
- Bottom section: Details Panel (default 40% height when job selected)

**Issues Identified:**

- SplitPane height calculations may not account for changed navbar heights in Bootstrap 5
- Global container class `height-minus-navbars` may need recalculation

---

## Level 3A: Primary Navigation Bar

### Component: `PrimaryNavBar` (`ui/job-view/headerbars/PrimaryNavBar.jsx`)

**Component Structure:**

```
PrimaryNavBar
├── #global-navbar-container
│   └── #th-global-top-nav-panel
│       └── #th-global-navbar (navbar navbar-dark)
│           ├── #th-global-navbar-top
│           │   ├── LogoMenu
│           │   └── .navbar-right
│           │       ├── NotificationsMenu
│           │       ├── Button (Push Health link) ← ISSUE
│           │       ├── InfraMenu
│           │       ├── ReposMenu
│           │       ├── TiersMenu
│           │       ├── FiltersMenu
│           │       ├── HelpMenu
│           │       └── Login
│           └── SecondaryNavBar
```

**Styling Files:**

- Primary: `ui/css/treeherder-navbar.css`
- Bootstrap: `ui/css/bootstrap-custom.scss`

### Issues Identified

#### Issue 1: Top Navbar Buttons Font Size - ❌ CRITICAL

**Status:** PARTIALLY FIXED - Custom properties set but being overridden by `.btn-view-nav`

**ACTUAL BEHAVIOR (via browser MCP measurement):**

- **Production:** 13px (matching target)
- **Local:** 12.25px (0.875rem - WRONG)
- **Target:** 13px

**Root Cause:** CSS Cascade/Specificity Issue

**Current Code:** `ui/css/treeherder-navbar.css:80-91`

```css
.nav-menu-btn {
  margin-right: -4px;
  padding-left: 14px;
  padding-right: 14px;
  /* Use Bootstrap 5 custom properties for sizing */
  --bs-btn-font-size: 13px;        /* ✅ Custom property is set correctly */
  --bs-btn-padding-y: 5.25px;
  --bs-btn-padding-x: 14px;
  --bs-btn-line-height: 19.5px;    /* ✅ !important removed (fixed) */
  height: 30px;
  min-height: 30px;
}
```

**Conflicting Code:** `ui/css/treeherder-navbar.css:393-402`

```css
.btn-view-nav,
.btn-view-nav:visited {
  background-color: transparent;
  border-color: #373d40;
  color: lightgray;
  border-radius: 0;
  border-bottom: 0;
  border-top: 0;
  border-right: 0;
  font-size: 0.875rem;  /* ❌ THIS IS THE PROBLEM - Overrides custom property! */
}
```

**Why Custom Property Doesn't Work:**

1. Bootstrap 5's `.btn` uses: `font-size: var(--bs-btn-font-size, 1rem)`
2. `.nav-menu-btn` sets: `--bs-btn-font-size: 13px` ✅
3. But `.btn-view-nav` has: `font-size: 0.875rem` ❌
4. Direct `font-size` property beats `var(--bs-btn-font-size)` in cascade
5. Result: Computed font-size = 12.25px (0.875rem at 14px root)

**Fix Required:**
Remove line 402: `font-size: 0.875rem;` from `.btn-view-nav` class

**Affects:**

- All top navbar buttons (Push Health, Infra, Repos, Tiers, Filters, Help, Login)
- Filter chicklets in secondary navbar
- Any button with both `.btn-view-nav` and `.nav-menu-btn` classes

#### Issue 2: Navbar Container Height - ⚠️ MISMATCH

**Status:** CHANGED IN LOCAL - Now 33px vs 34px in production

**ACTUAL BEHAVIOR (via browser MCP measurement):**

- **Production:** 34px total height (padding-top: 1px + content + border)
- **Local:** 33px total height (padding-top: 2px + content + border)
- **Difference:** -1px (local is shorter)

**Current Code:** `ui/css/treeherder-navbar.css:11-20`

```css
#th-global-navbar-top {
  padding-left: 0;
  padding-top: 2px;  /* ✅ FIXED: Changed from 1.5px to 2px (no fractional pixels) */
  border-bottom: 1px solid black;
  justify-content: space-between;
  display: flex;
  width: 100%;
  background-color: #222;
  line-height: 2;  /* ← UNITLESS LINE-HEIGHT: Multiplier based on font-size */
}
```

**Why Height Differs:**

1. Production padding-top: 1px (not 1.5px or 2px - likely from old Bootstrap 4 CSS)
2. Local padding-top: 2px (our fix to avoid fractional pixels)
3. **Result:** Local navbar is 1px shorter than production

**Additional Line-Height Issue:**

- Production line-height: 19.88px (computed)
- Local line-height: 28px (computed from `line-height: 2` × 14px font)
- Unitless `line-height: 2` multiplies by container's font-size

**Decision Required:**

- Keep 2px padding (cleaner, no fractional pixels) and accept 1px difference?
- OR change back to 1px to match production exactly?
- OR investigate why production has 1px instead of documented 1.5px?

#### Issue 3: Dropdown Caret Hidden Globally

**Location:** `ui/css/treeherder-navbar.css:587-590`

```css
/* Remove caret from repository dropdown toggle */
.no-caret::after {
  display: none !important;
}
```

**Problem:** This class name suggests it's specific, but there may be other places where carets are hidden globally

**Search needed for:**

- `.nav-menu-btn::after`
- `.dropdown-toggle::after`
- Global `::after { display: none }` rules

---

### Component: `SecondaryNavBar` (`ui/job-view/headerbars/SecondaryNavBar.jsx`)

**Component Structure:**

```
SecondaryNavBar (.watched-repo-navbar)
├── .watched-repos
│   └── WatchedRepo components (1-3 repos)
├── .resultStatusChicklets
│   ├── TierIndicator
│   └── Filter chicklets (colored buttons)
└── .navbar-right
    ├── Quick filter input
    ├── Unclassified failures button
    ├── Group state toggle
    └── Duplicate jobs toggle
```

**Styling:** `ui/css/treeherder-navbar.css:113-308`

### Issues Identified

#### Issue 4: Filter Chicklet Buttons - ❌ CRITICAL (Same as Issue 1)

**Status:** BROKEN BY `.btn-view-nav` OVERRIDE

**ACTUAL BEHAVIOR (via browser MCP measurement):**

- **Production:** 14px (1rem - CORRECT)
- **Local:** 12.25px (0.875rem - WRONG)
- **Target:** 14px (1rem) to match production

**Root Cause:** **SAME AS ISSUE 1** - `.btn-view-nav` sets `font-size: 0.875rem` on line 402

**Current Code (All 10 chicklet variants):** `ui/css/treeherder-navbar.css:188-308`

```css
.btn.btn-view-nav.btn-orange-filter-chicklet,
.btn.btn-view-nav.btn-orange-filter-chicklet:hover {
  --bs-btn-color: #dd6602;
  --bs-btn-hover-color: #dd6602;
  --bs-btn-active-color: #dd6602;
  --bs-btn-font-size: 1rem;  /* ✅ CORRECT: 1rem = 14px matches production */
  --bs-btn-padding-y: 0.5rem;
  --bs-btn-padding-x: 0.125rem;
  color: #dd6602;  /* ✅ Duplicate font-size removed */
}
```

**Why It Doesn't Work:**

1. Chicklet classes set `--bs-btn-font-size: 1rem` (14px) ✅
2. But all chicklets also have `.btn-view-nav` class
3. `.btn-view-nav` overrides with `font-size: 0.875rem` (12.25px) ❌
4. **Result:** Chicklets render at 12.25px instead of 14px

**Fix Required:**
**Same fix as Issue 1** - Remove `font-size: 0.875rem;` from `.btn-view-nav` (line 402)

**Note:** Original investigation incorrectly assumed chicklets should be 12px. Production measurement confirms they should be 14px (1rem).

#### Issue 5: Secondary Navbar Height Not Explicit

**Location:** `ui/css/treeherder-navbar.css:117-136`

```css
.watched-repo-navbar {
  overflow: visible;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  display: flex;
  align-items: center;
  background-color: #354048;
  min-height: 33px;  /* ← MINIMUM but not fixed */
}
```

**Problem:**

- Uses `min-height: 33px` but not `height: 33px`
- If content grows (larger font, more padding), navbar expands
- Causes cumulative height calculation errors for the main content area

**Bootstrap 4 → 5 Impact:**

- Bootstrap 4 had more predictable heights
- Bootstrap 5 flex layouts are more dynamic
- **Result:** Secondary navbar may be 33-38px depending on content

---

## Level 3B: Active Filters Bar

### Component: `ActiveFilters` (`ui/job-view/headerbars/ActiveFilters.jsx`)

**Current Structure (Problematic):**
Based on the plan document, this component has a 3-line layout issue due to `.form-inline` being removed in Bootstrap 5.

### Issue 6: Form Inline Removed in Bootstrap 5

**Bootstrap 4 Code (Old):**

```jsx
<form className="form-inline">
  <div className="form-group input-group-sm new-filter-input">
    {/* Filter inputs */}
  </div>
</form>
```

**Bootstrap 4 → 5 Changes:**

- **Bootstrap 4:** `.form-inline` made form controls display inline with flexbox
- **Bootstrap 5:** `.form-inline` class removed entirely
- **Migration Required:** Replace with `d-flex flex-row align-items-center gap-2`

**Problem:**

- Without `.form-inline`, form elements stack vertically (block display)
- Creates a 3-line layout instead of single-line horizontal layout
- Affects visual appearance and takes up excessive vertical space

**Expected Fix Classes:**

```jsx
<Form className="d-flex flex-row align-items-center gap-2">
  <Form.Select size="sm" className="flex-shrink-0">...</Form.Select>
  <Form.Control size="sm" className="flex-grow-1">...</Form.Control>
  <Button size="sm">add</Button>
  <Button size="sm">cancel</Button>
</Form>
```

---

## Level 3C: Push List Area

### Component: `PushList` → `Push` (`ui/job-view/pushes/Push.jsx`)

**Component Structure:**

```
PushList
└── Push (for each push)
    ├── PushHeader
    │   ├── .push-bar
    │   │   ├── .push-title-left
    │   │   │   ├── RevisionList
    │   │   │   │   └── Revision components ← ISSUE 7
    │   │   │   └── PushHealthSummary
    │   │   └── .push-counts
    │   │       └── JobCount badges
    │   └── PushActionMenu
    └── PushJobs
        └── Platform
            └── JobsAndGroups
                └── JobButton / JobGroup ← ISSUE 8
```

**Styling Files:**

- Primary: `ui/css/treeherder-pushes.css`
- Jobs: `ui/css/treeherder-job-buttons.css`

### Issues Identified

#### Issue 7: Revision Links Font Size

**Location:** `ui/shared/Revision.jsx:84-100`

```jsx
<div className="revision d-flex flex-nowrap" data-testid="revision">
  <span className="pe-1 text-nowrap">
    <a
      title={`Open that revision ${commitRevision} on ${repo.url}`}
      href={repo.getRevisionHref(commitRevision)}
      className={commitShaClass}  // ← commit-sha class
    >
      {commitRevision.substring(0, 12)}
    </a>
  </span>
  {/* ... more content */}
</div>
```

**CSS:** `ui/css/treeherder-pushes.css:124-143`

```css
.revision {
  font-size: 12px;
}

.revision a {
  font-size: inherit; /* Inherit from parent instead of global anchor styles */
}

.commit-sha {
  font-size: 11px;
  font-family: Consolas, 'Liberation Mono', Menlo, Courier, monospace;
}

.commit-sha a {
  font-size: inherit; /* Inherit from parent */
}
```

**Problem Analysis:**

1. `.revision` sets font-size to `12px`
2. Links should inherit this size via `font-size: inherit`
3. **BUT** if there's a global anchor style setting font-size, it may override

**Check Required:** `ui/css/treeherder-custom-styles.css`

- Look for `a { font-size: ... }` rules
- Bootstrap 5's `$link-*` variables may be affecting this

**Bootstrap 4 → 5 Impact:**

- Bootstrap 4: Links didn't have default font-size
- Bootstrap 5: Links may inherit from new defaults
- **Symptom:** Revision links appear 14px instead of 11-12px

#### Issue 8: Job Buttons Font Size

**Location:** `ui/css/treeherder-job-buttons.css:10-18`

```css
.job-btn {
  background: transparent;
  padding: 0 2px 0 2px !important;
  vertical-align: 0;
  line-height: 1.32 !important;
  display: none;
  transition: transform 0.1s;
  font-size: 12px !important;  /* ← HARD-CODED: Should use Bootstrap 5 system */
}
```

**Problems:**

1. `font-size: 12px !important` - Hard-coded, can't be themed
2. Using `!important` prevents customization
3. Same issue in `.group-btn`, `.runnable-job-btn` (lines 20-85)

**Bootstrap 4 → 5 Impact:**

- Bootstrap 4: Could override button font-size easily
- Bootstrap 5: Should use CSS custom properties
- **Current:** Works, but not maintainable or themeable

#### Issue 9: Push Bar Layout and Spacing

**Location:** `ui/css/treeherder-pushes.css:5-48`

```css
.push-bar {
  border-top: 1px solid black;
  padding: 2px 0 1px 34px;  /* ← FRACTIONAL PADDING */
  white-space: nowrap;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  justify-content: space-between;
}

.push-title-left {
  flex: 0 0 24.2em;  /* ← EM-BASED: Changes with font-size */
  padding-right: 10px;
}
```

**Problems:**

1. `padding: 2px 0 1px 34px` - Fractional vertical padding (2px and 1px)
2. `.push-title-left { flex: 0 0 24.2em }` - Basis in `em` means it changes with font-size
3. If font-size changes even slightly, the layout shifts

**Bootstrap 4 → 5 Impact:**

- Bootstrap 4: `$font-size-base: 14px`
- Bootstrap 5 custom: `$font-size-base: 1rem` (also 14px, but calculated)
- **Potential Issue:** If root font-size isn't exactly 14px, `24.2em` width will be wrong

---

## Level 3D: Details Panel (Bottom Panel)

### Component: `DetailsPanel` (`ui/job-view/details/DetailsPanel.jsx`)

**Component Structure:**

```
DetailsPanel
├── PinBoard (collapsible, fixed ~100px height) ← ISSUE 10
│   ├── Pinned job chips
│   ├── Classification dropdown
│   ├── Bug number input
│   └── Action buttons
└── #details-panel-content
    ├── SummaryPanel (#summary-panel, left side, 310px fixed width)
    │   ├── #summary-panel-content
    │   │   ├── StatusPanel
    │   │   ├── ClassificationsPanel
    │   │   └── LogUrls
    │   └── ActionBar (bottom) ← ISSUE 11
    └── TabsPanel (#tabs-panel, right side, flex-grow)
        ├── .details-panel-navbar
        │   ├── Tab headers
        │   └── Close button
        └── Tab content
            ├── FailureSummaryTab ← ISSUE 12
            ├── AnnotationsTab
            ├── PerformanceTab
            └── SimilarJobsTab
```

**Styling Files:**

- Primary: `ui/css/treeherder-details-panel.css`
- Failure Summary: `ui/css/failure-summary.css`

### Issues Identified

#### Issue 10: Details Panel Root Font Size

**Location:** `ui/css/treeherder-details-panel.css:5-17`

```css
#details-panel {
  font-size: 12px;  /* ← PANEL BASE SIZE: All children inherit */
  height: 100%;
}

#details-panel a {
  font-size: inherit;  /* ← CORRECT: Links inherit panel size */
  color: #337ab7;
}

#details-panel a:visited {
  color: purple;
}
```

**Analysis:**

- **Good:** Consistent approach - panel sets size, children inherit
- **Good:** Links explicitly set to `inherit`
- **Problem:** If ANY link has a more specific selector with font-size, it will override

**Check Required:** Look for patterns like:

```css
#details-panel .some-component a { font-size: 14px; }  /* ← Would override inherit */
```

#### Issue 11: ActionBar Dropdown Menu Alignment

**Location:** `ui/job-view/details/summary/ActionBar.jsx`

**Reported Issue from Plan:**
> "Inspect Task" menu item misaligned

**Likely Causes:**

1. **Bootstrap 4 → 5 Dropdown Structure Change:**

   ```jsx
   // Bootstrap 4 (reactstrap)
   <DropdownMenu>
     <DropdownItem>Inspect Task</DropdownItem>
   </DropdownMenu>

   // Bootstrap 5 (react-bootstrap)
   <Dropdown.Menu>
     <Dropdown.Item>Inspect Task</Dropdown.Item>
   </Dropdown.Menu>
   ```

2. **Possible Issues:**
   - Extra wrapper `div` between `Dropdown.Menu` and `Dropdown.Item`
   - Missing `as={ButtonGroup}` on dropdown wrapper
   - CSS from Bootstrap 4 still targeting old class names

**CSS to Check:** `ui/css/treeherder-details-panel.css:209-223`

```css
.details-panel-navbar .actionbar-nav > li > a,
.details-panel-navbar .actionbar-nav > li > .btn {
  color: #9fa3a5;
  padding: 4px 15px;
  margin-bottom: 4px;
  display: inline-block;
}
```

**Problem:** Using `li` selectors but react-bootstrap may not use `<li>` elements

#### Issue 12: Failure Summary Tab - Multiple Font Size Issues

**Component:** `ui/shared/tabs/failureSummary/SuggestionsListItem.jsx` & `BugListItem.jsx`

##### Issue 12a: Action Buttons Too Large

**Current Code (from plan):**

```jsx
<Button
  className="bg-light py-1 px-2"
  variant="outline-secondary"
  style={{ fontSize: '8px' }}  /* ← INLINE STYLE: Anti-pattern */
>
```

**CSS:** `ui/css/failure-summary.css:5-12`

```css
/* Failure action buttons - use Bootstrap 5 custom properties */
.failure-action-btn {
  --bs-btn-font-size: 8px;
  --bs-btn-padding-y: 0.25rem;
  --bs-btn-padding-x: 0.5rem;
  --bs-btn-line-height: 1;
  font-size: 8px;  /* ← DUPLICATE: Set in both places */
}
```

**Problems:**

1. Some components use inline `style={{ fontSize: '8px' }}`
2. CSS class exists but may not be applied to all buttons
3. Both custom property AND direct font-size (redundant)

**Bootstrap 4 → 5 Impact:**

- Bootstrap 4: Button sizes were `btn-sm`, `btn-lg`
- Bootstrap 5: Same, but default size increased slightly
- **Without** explicit sizing, buttons default to 14px instead of 8px

##### Issue 12b: Bug Links Font Size

**CSS:** `ui/css/failure-summary.css:14-26`

```css
/* Bug suggestions and links */
.failure-summary-bugs {
  font-size: 12px;
}

.failure-summary-bugs a {
  font-size: inherit;
  color: #337ab7;
}

.failure-summary-bugs a:visited {
  color: purple;
}
```

**Analysis:**

- **Good:** Container sets size, links inherit
- **Check Required:** Ensure `.failure-summary-bugs` class is applied to parent elements
- **Possible Issue:** If class is missing from JSX, links will be default size (14px)

##### Issue 12c: "Show More" Button Border and Underline

**Current Code (from plan):**

```jsx
<Button
  variant="link"  // ← WRONG VARIANT: "link" adds underline
  onClick={this.clickShowMore}
  className="bg-light px-2 py-1 btn btn-outline-secondary btn-xs my-2"
>
```

**Bootstrap 4 → 5 Changes:**

- Bootstrap 4: `variant="link"` - Styled like a link but acted like a button
- Bootstrap 5: Same behavior, but link decoration defaults changed
- **Problem:** `variant="link"` conflicts with `btn-outline-secondary` (both set colors)
- **Result:** No border, has underline (link style wins)

**CSS:** `ui/css/failure-summary.css:28-34`

```css
/* Show more button */
.show-more-suggestions {
  --bs-btn-font-size: 11px;
  --bs-btn-padding-y: 0.25rem;
  --bs-btn-padding-x: 0.5rem;
  font-size: 11px;
}
```

**Fix Required:** Change `variant="link"` to `variant="outline-dark"` or `variant="outline-secondary"`

---

## Level 4: Shared Components

### Component: `BugFiler` (`ui/shared/BugFiler.jsx`)

**Modal with Form Inputs**

#### Issue 13: Form Input Height Too Large

**Location:** Lines 1-100 (form controls throughout)

**Bootstrap 4 Code:**

```jsx
<Form.Control
  type="text"
  placeholder="e.g. Firefox, Toolkit, Testing"
  className="flex-fill flex-grow-1"  // ← Bootstrap 4 classes
/>
```

**Bootstrap 4 → 5 Changes:**

- Bootstrap 4: `.form-control` had specific height (~38px with padding)
- Bootstrap 5: `.form-control` height increased slightly (~38-40px)
- **Missing:** `size="sm"` prop to reduce height

**Fix Required:** Add `size="sm"` to all `Form.Control` components:

```jsx
<Form.Control
  size="sm"  // ← Add this
  type="text"
  placeholder="e.g. Firefox, Toolkit, Testing"
  className="flex-grow-1"
/>
```

**Also:**

- Change `flex-fill` to `flex-grow-1` (Bootstrap 5 naming)

---

## Bootstrap 4 → Bootstrap 5 Class Changes Summary

### Classes Removed in Bootstrap 5

| Bootstrap 4 Class | Bootstrap 5 Replacement | Usage in Treeherder |
|-------------------|-------------------------|---------------------|
| `.form-inline` | `.d-flex .flex-row .align-items-center .gap-2` | `ActiveFilters.jsx` ✅ NEEDS FIX |
| `.form-group` | Just remove (not needed) | Multiple files |
| `.btn-block` | `.d-grid .gap-2` or `.w-100` | Check all Button components |
| `.media` | Use flex utilities | Check if used anywhere |
| `.badge-pill` | `.rounded-pill` | Check badge components |
| `.close` | `.btn-close` | Modal components |
| `.left-*`, `.right-*` (float) | `.float-start`, `.float-end` | Check alignment utils |
| `.ml-*`, `.mr-*`, `.pl-*`, `.pr-*` | `.ms-*`, `.me-*`, `.ps-*`, `.pe-*` | ✅ LIKELY CONVERTED |

### Classes Changed in Bootstrap 5

| Bootstrap 4 | Bootstrap 5 | Notes |
|-------------|-------------|-------|
| `.ml-auto` | `.ms-auto` | Margin left → Margin start |
| `.mr-auto` | `.me-auto` | Margin right → Margin end |
| `.pl-3` | `.ps-3` | Padding left → Padding start |
| `.pr-3` | `.pe-3` | Padding right → Padding end |
| `.text-left` | `.text-start` | Alignment |
| `.text-right` | `.text-end` | Alignment |
| `.rounded-left` | `.rounded-start` | Border radius |
| `.rounded-right` | `.rounded-end` | Border radius |

**Status in Codebase:**

- Looking at `Revision.jsx:88`, we see `className="pe-1"` ✅ Converted correctly
- Need to search entire codebase for any remaining `.ml-`, `.mr-`, `.pl-`, `.pr-` classes

---

## Font Size Hierarchy Issues

### Root Level

**File:** `ui/css/bootstrap-custom.scss:5`

```scss
$font-size-root: 14px; // Set root font size to 14px
```

**Impact:** ALL `rem` units based on this. `1rem = 14px`

### Global/Custom Styles

**File:** `ui/css/treeherder-custom-styles.css:39-65`

```css
.font-size-11 { font-size: 11px; }
.font-size-12 { font-size: 12px; }
.font-size-14 { font-size: 14px; }
.font-size-16 { font-size: 16px; }
.font-size-18 { font-size: 18px; }
.font-size-20 { font-size: 20px; }
.font-size-24 { font-size: 24px; }
```

**Good:** Utility classes exist for explicit sizing

### Component-Specific Font Sizes

#### Navigation Elements

- **Top navbar buttons:** Target = 13px, Current = 13px with `!important` (treeherder-navbar.css:88)
- **Filter chicklets:** Target = 12px, Current = 14px (1rem) (treeherder-navbar.css:194)
- **Quick filter input:** Target = 13px (implied from navbar height)

#### Push List Elements

- **Revision links:** Target = 12px, Current = may be 14px if inheritance broken (treeherder-pushes.css:125)
- **Commit SHA:** Target = 11px, Current = 11px (treeherder-pushes.css:137)
- **Platform names:** Target = 12px (treeherder-pushes.css:160)
- **Job buttons:** Target = 12px, Current = 12px with `!important` (treeherder-job-buttons.css:17)

#### Details Panel Elements

- **Panel base:** 12px (treeherder-details-panel.css:6)
- **Tab headers:** 12px inherited (treeherder-details-panel.css:189)
- **Failure action buttons:** Target = 8px, Current = varies (some inline, some class)
- **Bug links:** Target = 12px, Current = should inherit
- **Show more button:** Target = 11px, Current = 11px (failure-summary.css:30)

### Font Size Inheritance Issues

**Problem Pattern:**

```css
/* Parent sets size */
.parent { font-size: 12px; }

/* Child explicitly inherits */
.parent a { font-size: inherit; }

/* BUT if there's a global anchor rule... */
a { font-size: 14px; }  /* ← This would override inherit if specificity is equal */
```

**Check Required:** Look for global anchor styles in:

1. `treeherder-custom-styles.css`
2. `bootstrap-custom.scss` - Check `$link-font-size` variable
3. Any remaining Bootstrap 4 override CSS

---

## Spacing and Proportion Issues

### Padding Issues

#### Fractional Pixel Padding

**Problem Locations:**

1. `treeherder-navbar.css:13` - `padding-top: 1.5px`
2. `treeherder-pushes.css:7` - `padding: 2px 0 1px 34px` (vertical: 2px and 1px)

**Issue:** Browsers handle fractional pixels differently

- Chrome: Rounds to nearest pixel
- Firefox: May render as fractional (sub-pixel rendering)
- Safari: Varies by retina/non-retina display

**Result:** Inconsistent heights across browsers/displays

#### Hard-Coded Pixel Padding vs. Bootstrap Utilities

**Current:** Many components use hard-coded padding

```css
.btn-push {
  padding-left: 9px;
  padding-right: 10px;  /* ← Not in Bootstrap's spacing scale */
}
```

**Bootstrap 5 Spacing Scale:**

```scss
$spacer: 1rem; // 14px at root
$spacers: (
  0: 0,           // 0px
  1: 0.25rem,     // 3.5px
  2: 0.5rem,      // 7px
  3: 0.75rem,     // 10.5px
  4: 1rem,        // 14px
  5: 1.5rem,      // 21px
);
```

**Issue:** Padding values like `9px`, `10px` don't align with scale

- Should use `px-2` (7px) or `px-3` (10.5px)
- OR add custom spacer: `6: 0.625rem` (8.75px ≈ 9px)

### Margin Issues

#### Button Margins in Navbar

**File:** `treeherder-navbar.css:81`

```css
.nav-menu-btn {
  margin-right: -4px;  /* ← NEGATIVE: Overlaps adjacent elements */
}
```

**Bootstrap 4 → 5:**

- Bootstrap 4: Negative margins worked with specific button spacing
- Bootstrap 5: Button spacing may have changed
- **Check:** Are buttons overlapping or too far apart?

### Height and Line-Height Issues

#### Navbar Line Heights

**Inconsistent Units:**

```css
/* Unitless (multiplier) */
#th-global-navbar-top { line-height: 2; }           /* 2× font-size */

/* Pixel value */
.nav-menu-btn { line-height: 19.5px !important; }  /* Fixed */

/* Fractional ratio */
.job-btn { line-height: 1.32 !important; }         /* 1.32× font-size */
```

**Problem:** Mixing unit types makes it hard to align elements

- Unitless: Changes with font-size
- Pixel: Always fixed
- **Result:** Buttons may not align vertically in navbar

#### Button Heights

**Multiple Height Specifications:**

```css
.nav-menu-btn {
  line-height: 19.5px !important;
  height: 30px;
  min-height: 30px;
}
```

**Question:** Why both `height` and `min-height`?

- If content fits, `height: 30px` enforces it
- `min-height: 30px` is redundant if `height` is set
- **Possible Issue:** Content may overflow if both are set and content is taller

---

## CSS Conflicts and Specificity Issues

### !important Overuse

**Locations with !important:**

1. `treeherder-navbar.css:88-89` - Font-size and line-height
2. `treeherder-navbar.css:409, 410` - Background and border color
3. `treeherder-job-buttons.css:12, 14, 17` - Padding and font-size
4. `treeherder-job-buttons.css:22, 24` - Group button padding and line-height
5. `failure-summary.css:53` - Show/hide button font-size

**Problem:**

- `!important` prevents Bootstrap 5 theming from working
- Can't use CSS custom properties to theme if `!important` overrides
- Makes maintenance difficult

**Bootstrap 5 Best Practice:**

- Use CSS custom properties: `--bs-btn-font-size: 13px;`
- Let Bootstrap's cascade handle the rest
- Only use `!important` for true overrides of third-party CSS

### Specificity Issues

#### Navbar Button Styling

**Current Cascade:**

```css
/* Base button (specificity: 0,1,0) */
.btn { font-size: 1rem; }

/* Bootstrap 5 custom property (specificity: 0,1,0) */
.btn { font-size: var(--bs-btn-font-size, 1rem); }

/* Treeherder override (specificity: 0,2,0) */
.btn.btn-view-nav { font-size: 0.875rem; }

/* Navbar menu button (specificity: 0,1,0 + !important) */
.nav-menu-btn { font-size: 13px !important; }
```

**Problem:** The `!important` wins, but prevents customization

**Suggested Specificity:**

```css
/* Let Bootstrap handle base */
.btn { font-size: var(--bs-btn-font-size, 1rem); }

/* Set custom property for navbar buttons */
.navbar .btn,
.navbar .nav-menu-btn {
  --bs-btn-font-size: 13px;
}
```

#### Link Styling in Details Panel

**Potential Conflict:**

```css
/* Global details panel links (specificity: 1,0,1) */
#details-panel a {
  font-size: inherit;
  color: #337ab7;
}

/* Failure summary links (specificity: 0,1,1) */
.failure-summary-bugs a {
  font-size: inherit;
  color: #337ab7;
}
```

**If there's a global `a { font-size: 14px; }` (specificity: 0,0,1):**

- `#details-panel a` wins (ID selector)
- `.failure-summary-bugs a` wins over global `a`
- **BUT** if not applied correctly, global `a` might leak through

---

## Bootstrap 5 Custom Properties Not Fully Utilized

### Current Approach (Inconsistent)

**Some files use custom properties:**

```css
.nav-menu-btn {
  --bs-btn-font-size: 13px;
  font-size: 13px !important;  /* ← Redundant and prevents theming */
}
```

**Some files use direct properties:**

```css
.job-btn {
  font-size: 12px !important;  /* ← No custom property */
}
```

### Bootstrap 5 Custom Properties Available

#### Button Properties

```css
--bs-btn-padding-x
--bs-btn-padding-y
--bs-btn-font-size
--bs-btn-font-weight
--bs-btn-line-height
--bs-btn-color
--bs-btn-bg
--bs-btn-border-color
--bs-btn-border-width
--bs-btn-border-radius
--bs-btn-hover-color
--bs-btn-hover-bg
--bs-btn-hover-border-color
--bs-btn-active-color
--bs-btn-active-bg
--bs-btn-active-border-color
--bs-btn-disabled-color
--bs-btn-disabled-bg
--bs-btn-disabled-border-color
```

#### Badge Properties

```css
--bs-badge-padding-x
--bs-badge-padding-y
--bs-badge-font-size
--bs-badge-font-weight
--bs-badge-color
--bs-badge-bg
--bs-badge-border-radius
```

### Recommended Refactoring

**Instead of:**

```css
.my-button {
  font-size: 12px !important;
  padding: 4px 8px !important;
  line-height: 1.2 !important;
}
```

**Use:**

```css
.my-button {
  --bs-btn-font-size: 12px;
  --bs-btn-padding-y: 4px;
  --bs-btn-padding-x: 8px;
  --bs-btn-line-height: 1.2;
}
```

**Benefits:**

1. No `!important` needed
2. Properties can still be overridden by child elements
3. Themeable - can change values in one place
4. Consistent with Bootstrap 5 patterns

---

## Layout Issues from Bootstrap 4 → 5 Changes

### Grid System Changes

**Bootstrap 4:**

```jsx
<Row>
  <Col xs={12} sm={6} md={4}>...</Col>
</Row>
```

**Bootstrap 5 (Same):**

```jsx
<Row>
  <Col xs={12} sm={6} md={4}>...</Col>
</Row>
```

**No breaking changes in grid system API** ✅

### Flexbox Utilities

**Most utilities the same, but some additions in Bootstrap 5:**

- Added: `.gap-*` utilities (better than margins)
- Added: `.d-*-grid` display utilities
- Changed: `.order-*` renamed to `.order-{breakpoint}-*`

**Check Required:** Look for custom margin classes that could be replaced with `.gap-*`

Example:

```jsx
// Old way
<div className="d-flex">
  <div className="mr-2">Item 1</div>  {/* ← Should be .me-2 now */}
  <div className="mr-2">Item 2</div>
  <div>Item 3</div>
</div>

// New way (Bootstrap 5)
<div className="d-flex gap-2">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

---

## Critical Files Requiring Changes

### High Priority (Visual Impact)

1. **`ui/css/treeherder-navbar.css`**
   - Lines 80-92: `.nav-menu-btn` - Remove `!important`, use custom properties only
   - Lines 188-308: Filter chicklets - Change `--bs-btn-font-size: 1rem` to `0.857rem` (12px)
   - Line 13: Change `padding-top: 1.5px` to `padding-top: 2px`

2. **`ui/job-view/headerbars/ActiveFilters.jsx`**
   - Replace `.form-inline` with Bootstrap 5 flex utilities
   - Add `size="sm"` to all form controls

3. **`ui/css/treeherder-job-buttons.css`**
   - Lines 10-18, 20-27: Remove `!important` from font-size and line-height
   - Consider using CSS custom properties instead

4. **`ui/css/treeherder-pushes.css`**
   - Lines 125-143: Verify `.revision a` and `.commit-sha a` font-size inheritance works
   - Line 7: Change `padding: 2px 0 1px 34px` to `padding: 2px 0 2px 34px`

5. **`ui/css/failure-summary.css`**
   - Lines 6-12: Remove duplicate `font-size: 8px` (keep only custom property)
   - Lines 30-34: Remove duplicate `font-size: 11px`

### Medium Priority (Consistency)

6. **`ui/shared/BugFiler.jsx`**
   - Add `size="sm"` prop to all `Form.Control` components
   - Change `flex-fill` to `flex-grow-1`

7. **`ui/shared/tabs/failureSummary/SuggestionsListItem.jsx`**
   - Change `variant="link"` to `variant="outline-dark"`
   - Apply `.show-more-suggestions` class
   - Remove inline `style={{ fontSize: '8px' }}`
   - Apply `.failure-action-btn` class to action buttons

8. **`ui/css/treeherder-details-panel.css`**
   - Verify all link `font-size: inherit` rules are working
   - Check dropdown menu alignment (may need JSX changes)

### Low Priority (Enhancement)

9. **`ui/css/treeherder-custom-styles.css`**
   - Document purpose of each utility class
   - Consider if any can be removed in favor of Bootstrap 5 utilities

10. **Global Search Tasks:**
    - Search for remaining `.ml-`, `.mr-`, `.pl-`, `.pr-` classes
    - Search for `.form-group` and `.form-inline`
    - Search for inline `style={{ fontSize: ... }}` patterns

---

## Recommended Investigation Commands

### Search for Bootstrap 4 Classes

```bash
# Find margin/padding classes that need update
grep -r "className.*ml-\|mr-\|pl-\|pr-" ui/ --include="*.jsx"

# Find removed classes
grep -r "className.*form-inline\|form-group" ui/ --include="*.jsx"
grep -r "className.*btn-block" ui/ --include="*.jsx"

# Find inline styles with fontSize
grep -r 'style={{.*fontSize' ui/ --include="*.jsx"
```

### Search for !important Overuse

```bash
# Find all !important in CSS
grep -r "!important" ui/css/

# Count usage
grep -r "!important" ui/css/ | wc -l
```

### Search for Hard-Coded Font Sizes

```bash
# Find font-size in CSS (not in comments)
grep -r "font-size:" ui/css/ | grep -v "^[[:space:]]*//"

# Find pixel values
grep -r "font-size:.*px" ui/css/
```

---

## Visual Regression Testing Checklist

### Navbar (Top and Secondary)

- [ ] Top navbar height is exactly 41px (including border)
- [ ] Secondary navbar height is exactly 33px
- [ ] All buttons in top navbar have consistent height (30px)
- [ ] Filter chicklets are 12px font-size
- [ ] Filter chicklets have consistent vertical alignment
- [ ] Dropdowns open without expanding navbar height
- [ ] No text truncation or overflow in navbar items

### Push List Area

- [ ] Revision links are 12px font-size
- [ ] Commit SHA is 11px font-size with monospace font
- [ ] Job buttons are 12px font-size
- [ ] Job buttons align horizontally (no vertical offset)
- [ ] Platform names are 12px font-size
- [ ] Push bar has consistent height across all pushes
- [ ] No layout shift when expanding/collapsing job groups

### Details Panel

- [ ] Panel content is 12px base font-size
- [ ] All links in panel are 12px (inherit correctly)
- [ ] Tab headers are 12px with 33px navbar height
- [ ] Failure action buttons are 8px font-size
- [ ] Bug links are 12px font-size
- [ ] "Show more" button has border and no underline (11px font)
- [ ] ActionBar dropdown items align properly

### Active Filters Bar

- [ ] Filter form displays on single line (not 3 lines)
- [ ] Form controls are small size (not large)
- [ ] Add/Cancel buttons align with form inputs
- [ ] No excessive vertical space taken

### BugFiler Modal

- [ ] All form inputs are small size
- [ ] Input heights are consistent
- [ ] Modal fits on screen without scrolling (for typical bug)

---

## Cross-Browser Testing Required

**Browsers to Test:**

1. **Chrome** (latest)
2. **Firefox** (latest)
3. **Safari** (latest, macOS only)

**Focus Areas:**

1. **Fractional padding rendering:**
   - Check `padding-top: 1.5px` renders consistently
   - Check `padding: 2px 0 1px 34px` renders consistently

2. **Font rendering:**
   - Small fonts (8px, 11px) may render differently
   - Check if 8px font is readable on all browsers

3. **Flexbox:**
   - Ensure `.gap-*` utilities work (recent Bootstrap 5 addition)
   - Check multi-line flex layouts wrap correctly

4. **Subpixel rendering:**
   - Check on retina vs non-retina displays
   - Verify heights are consistent

---

## Performance Considerations

### CSS Custom Properties Performance

**Bootstrap 5 uses CSS custom properties extensively**

**Pros:**

- Faster than JavaScript theme switching
- Cascade works naturally
- Easy to override

**Cons:**

- Slightly more expensive than static values (negligible)
- Not cached as efficiently as static CSS

**Recommendation:** Use custom properties as planned - performance impact is minimal

### CSS Specificity and Cascade

**Current Issues:**

- Many `!important` rules force browser to recalculate styles
- Deep selector nesting increases style calculation time

**Recommendation:**

- Remove `!important` where possible
- Flatten selector specificity
- Use custom properties for theming

---

## Migration Strategy Summary

### Phase 1: Critical Fixes (Visual Impact)

1. Fix navbar button font sizes (remove `!important`, adjust custom properties)
2. Fix filter chicklet sizes (1rem → 0.857rem)
3. Fix ActiveFilters form layout (add flex utilities)
4. Fix failure summary buttons (remove inline styles)

### Phase 2: Consistency Improvements

5. Add `size="sm"` to all form controls that need it
6. Fix "show more" button variant (link → outline-dark)
7. Verify and fix link font-size inheritance
8. Fix ActionBar dropdown alignment

### Phase 3: Code Quality

9. Replace `!important` with CSS custom properties
10. Search and replace Bootstrap 4 classes
11. Remove inline styles
12. Document custom CSS

### Phase 4: Testing and Polish

13. Visual regression testing
14. Cross-browser testing
15. Accessibility testing
16. Performance testing

---

## REVISED FIX PLAN (Based on Real Measurements)

### Critical Fix (ONE LINE CHANGE)

**File:** `ui/css/treeherder-navbar.css`
**Line:** 402
**Current:**

```css
.btn-view-nav,
.btn-view-nav:visited {
  background-color: transparent;
  border-color: #373d40;
  color: lightgray;
  border-radius: 0;
  border-bottom: 0;
  border-top: 0;
  border-right: 0;
  font-size: 0.875rem;  /* ← DELETE THIS LINE */
}
```

**Fixed:**

```css
.btn-view-nav,
.btn-view-nav:visited {
  background-color: transparent;
  border-color: #373d40;
  color: lightgray;
  border-radius: 0;
  border-bottom: 0;
  border-top: 0;
  border-right: 0;
  /* font-size removed - let custom properties work */
}
```

**Impact:** Fixes ALL navbar button and filter chicklet font sizes

### Optional Fix (Height Matching)

**File:** `ui/css/treeherder-navbar.css`
**Line:** 13
**Decision Required:** Change `padding-top: 2px` back to `padding-top: 1px` to match production's 34px height?

**Current:** 33px height (with 2px padding)
**Production:** 34px height (with 1px padding)
**Difference:** 1px shorter

**Recommendation:** Keep 2px to avoid fractional pixels unless exact height match is required.

### Status After Fixes

| Element | Production | Local (After Fix) | Status |
|---------|-----------|------------------|--------|
| Nav menu button font-size | 13px | 13px | ✅ MATCH |
| Filter chicklets font-size | 14px | 14px | ✅ MATCH |
| Top navbar height | 34px | 33px | ⚠️ 1px diff (acceptable?) |
| Button heights | 30px | 30px | ✅ MATCH |

---

## Next Steps

1. **Implement critical fix** - Remove `font-size: 0.875rem` from line 402
2. **Test locally** - Verify navbar buttons render at 13px and chicklets at 14px
3. **Decide on padding** - Keep 2px or change to 1px for exact height match?
4. **Visual regression test** - Compare screenshots before/after
5. **Review other components** - Details panel, failure summary (already fixed)

---

## Appendix: File Reference Index

### JavaScript/JSX Files

- `ui/index.jsx` - Entry point, CSS imports
- `ui/App.jsx` - Root router
- `ui/job-view/App.jsx` - Main jobs view
- `ui/job-view/headerbars/PrimaryNavBar.jsx` - Top navbar
- `ui/job-view/headerbars/SecondaryNavBar.jsx` - Filter chicklets
- `ui/job-view/headerbars/ActiveFilters.jsx` - Filter form
- `ui/job-view/pushes/Push.jsx` - Individual push
- `ui/job-view/pushes/PushHeader.jsx` - Push title/revision
- `ui/job-view/details/DetailsPanel.jsx` - Bottom panel
- `ui/job-view/details/PinBoard.jsx` - Pinboard section
- `ui/shared/Revision.jsx` - Revision link component
- `ui/shared/BugFiler.jsx` - Bug filing modal
- `ui/shared/tabs/failureSummary/SuggestionsListItem.jsx` - Failure suggestions
- `ui/shared/tabs/failureSummary/BugListItem.jsx` - Bug list items

### CSS Files

- `ui/css/bootstrap-custom.scss` - Bootstrap 5 customization (14px root)
- `ui/css/treeherder-custom-styles.css` - Global utilities
- `ui/css/treeherder-navbar.css` - Navbar styles (top + secondary)
- `ui/css/treeherder-pushes.css` - Push list styles
- `ui/css/treeherder-job-buttons.css` - Job button styles
- `ui/css/treeherder-details-panel.css` - Bottom panel styles
- `ui/css/failure-summary.css` - Failure summary tab styles

---

**End of Investigation Document**

**Document Status:** Complete - Ready for Review
**Next Action:** Review with team and prioritize fixes
**Estimated Fixes:** 4-8 hours for Phase 1, 8-16 hours total for all phases
