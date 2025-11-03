# Comprehensive Fix Plan for Bootstrap 5 Migration Styling Issues

## Overview

This plan addresses styling inconsistencies resulting from the migration from Bootstrap 4 + reactstrap to Bootstrap 5 + react-bootstrap. The goal is to maintain the original Treeherder look and feel while properly utilizing Bootstrap 5's modern CSS framework and customization capabilities.

## Migration Philosophy

**DO**:

- Use Bootstrap 5 utility classes and component props
- Customize Bootstrap 5 via SASS/CSS variables at the global level
- Replace reactstrap patterns with react-bootstrap equivalents
- Maintain original sizing, spacing, and colors through Bootstrap 5's theming system

**DON'T**:

- Add workarounds or patches with `!important` rules
- Use inline styles for sizing/spacing
- Override Bootstrap 5 with heavy custom CSS
- Fight against Bootstrap 5's conventions

---

## Root Cause Analysis

The migration introduced changes because:

1. Bootstrap 5 has different default font sizes (16px base vs our 14px)
2. Bootstrap 5 removed utilities like `.form-inline`
3. react-bootstrap components have different prop APIs than reactstrap
4. Some custom CSS was written to override Bootstrap 4, which now conflicts with Bootstrap 5
5. Global font sizing in `treeherder-custom-styles.css` forces all components to `1rem` instead of using Bootstrap 5's scale

---

## Phase 0: Bootstrap 5 Global Customization

### 0.1 Create Bootstrap 5 Custom Variables File

**New File**: `ui/css/bootstrap-custom.scss`

```scss
// Treeherder Bootstrap 5 Customization
// This file sets global variables before Bootstrap is imported

// Typography - Maintain Treeherder's 14px base font size
$font-size-base: 0.875rem; // 14px (assuming 16px root)
$font-size-sm: 0.75rem;    // 12px
$font-size-lg: 1rem;       // 16px

// Or alternatively, change the root font size
$font-size-root: 14px;

// Line heights
$line-height-base: 1.42857143; // Match previous Treeherder line height

// Spacing scale - maintain existing spacing
$spacer: 1rem;
$spacers: (
  0: 0,
  1: $spacer * 0.25,  // 0.25rem = 3.5px
  2: $spacer * 0.5,   // 0.5rem = 7px
  3: $spacer * 0.75,  // 0.75rem = 10.5px
  4: $spacer,         // 1rem = 14px
  5: $spacer * 1.5,   // 1.5rem = 21px
);

// Buttons - maintain original sizing
$btn-padding-y: 0.375rem;
$btn-padding-x: 0.75rem;
$btn-font-size: $font-size-base;
$btn-line-height: 1.5;

$btn-padding-y-sm: 0.25rem;
$btn-padding-x-sm: 0.5rem;
$btn-font-size-sm: 0.75rem; // 12px

$btn-padding-y-lg: 0.5rem;
$btn-padding-x-lg: 1rem;
$btn-font-size-lg: 1rem;

// Form controls
$input-padding-y: 0.375rem;
$input-padding-x: 0.75rem;
$input-font-size: $font-size-base;
$input-line-height: 1.5;

$input-padding-y-sm: 0.25rem;
$input-padding-x-sm: 0.5rem;
$input-font-size-sm: 0.75rem;

// Links
$link-decoration: none;
$link-hover-decoration: none;

// Navbar
$navbar-dark-color: rgba(255, 255, 255, 0.75);
$navbar-dark-hover-color: rgba(255, 255, 255, 0.9);
$navbar-dark-active-color: #fff;
$navbar-padding-y: 0;
$navbar-padding-x: 0;

// Dropdowns
$dropdown-font-size: $font-size-base;
$dropdown-item-padding-y: 0.5rem;
$dropdown-item-padding-x: 1rem;

// Import Bootstrap 5 with customizations
@import "~bootstrap/scss/bootstrap";
```

**Action**:

- Create this file and import it instead of the standard Bootstrap CSS
- Update webpack/build config to use this custom Bootstrap build
- Remove conflicting global styles from `treeherder-custom-styles.css`

---

## Phase 1: Pixel-Perfect Navigation Bars (Top & Secondary)

**Goal**: Make the top navigation bar and secondary navigation bar (filter chicklets) match production exactly - pixel perfect.

**Testing Approach**:

1. Use Chrome DevTools MCP to compare prod vs local side-by-side
2. Take screenshots of both navbars on prod and local
3. Measure and compare:
   - Overall navbar heights
   - Button font sizes
   - Button padding and spacing
   - Vertical alignment of all elements
   - Colors and borders
4. Iterate until pixel-perfect match achieved

### 1.1 Visual Comparison Setup

**Use Chrome Browser MCP** to open both environments:

**Production**:

```
https://treeherder.mozilla.org/jobs?repo=autoland
```

**Local**:

```
http://localhost:5001/jobs?repo=autoland
```

**MCP Commands to Use**:

- `mcp__chrome-devtools__navigate_page` - Navigate to URLs
- `mcp__chrome-devtools__take_screenshot` - Capture navbar screenshots
- `mcp__chrome-devtools__take_snapshot` - Get detailed element tree
- `mcp__browser-tools__getConsoleErrors` - Check for errors

**What to Measure**:

1. **Top Navbar (`#th-global-navbar-top`)**:
   - Total height (should be ~32-33px including border)
   - Button heights (should be 30px)
   - Button font-size (should be 13px)
   - Button padding
   - Logo height
   - Vertical centering of all items

2. **Secondary Navbar (`.watched-repo-navbar`)**:
   - Total height (should be exactly 33px)
   - Filter chicklet font-size (should be 12px, not 14px)
   - Filter chicklet padding
   - Tier indicator size
   - Quick filter input height
   - Vertical alignment of buttons and inputs

---

### 1.2 Top Navigation Bar Fixes

**Files to Modify**:

- `ui/css/treeherder-navbar.css` - Navbar button styles
- `ui/job-view/headerbars/PrimaryNavBar.jsx` - Top navbar component

**Current Issues from Investigation**:

1. **Button font-size conflict**: Using both `!important` and custom properties
   - Location: `treeherder-navbar.css:80-92` (`.nav-menu-btn`)
   - Problem: `font-size: 13px !important` prevents theming

2. **Fractional padding**: `padding-top: 1.5px` causes inconsistent rendering
   - Location: `treeherder-navbar.css:13`
   - Problem: Browsers render fractional pixels differently

3. **No explicit height**: Navbar relies on content + padding
   - Location: `treeherder-navbar.css:11-20`
   - Problem: Height varies if content changes

**Fix Strategy**:

```css
/* ui/css/treeherder-navbar.css */

/* Fix 1: Remove !important, use only custom properties */
.nav-menu-btn {
  margin-right: -4px;
  padding-left: 14px;
  padding-right: 14px;
  /* Use Bootstrap 5 custom properties for sizing */
  --bs-btn-font-size: 13px;
  --bs-btn-padding-y: 5.25px;
  --bs-btn-padding-x: 14px;
  /* Remove: font-size: 13px !important; */
  /* Remove: line-height: 19.5px !important; */
  height: 30px;
  min-height: 30px;
}

/* Fix 2: Use whole pixel padding */
#th-global-navbar-top {
  padding-left: 0;
  padding-top: 2px;  /* Changed from 1.5px */
  border-bottom: 1px solid black;
  justify-content: space-between;
  display: flex;
  width: 100%;
  background-color: #222;
  line-height: 2;
  height: 33px;  /* Add explicit height */
}
```

**Verification Steps**:

1. Compare button heights: Should be exactly 30px
2. Compare navbar height: Should be exactly 33px (32px + 1px border)
3. Compare font-size: Should be 13px on all buttons
4. Verify vertical centering of all navbar items

---

### 1.3 Secondary Navigation Bar (Filter Chicklets) Fixes

**Files to Modify**:

- `ui/css/treeherder-navbar.css` - Filter chicklet styles (lines 188-308)
- `ui/job-view/headerbars/SecondaryNavBar.jsx` - Secondary navbar component

**Current Issues from Investigation**:

1. **Font-size too large**: Chicklets are 14px (1rem) instead of 12px
   - Location: All `.btn-*-filter-chicklet` classes
   - Problem: `--bs-btn-font-size: 1rem` should be `0.857rem` (12px)

2. **Duplicate font-size declarations**: Specified in both custom property and direct property
   - Problem: `--bs-btn-font-size: 1rem` AND `font-size: 1rem`
   - Should use only custom property

3. **No explicit navbar height**: Uses `min-height: 33px` but not fixed
   - Location: `treeherder-navbar.css:117-136`
   - Problem: Navbar can grow beyond 33px

**Fix Strategy**:

```css
/* ui/css/treeherder-navbar.css */

/* Fix 1: Set exact height for secondary navbar */
.watched-repo-navbar {
  overflow: visible;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  display: flex;
  align-items: center;
  background-color: #354048;
  height: 33px;  /* Changed from min-height */
}

/* Fix 2: Reduce chicklet font-size from 14px to 12px */
/* Apply to ALL chicklet variants (orange, red, purple, green, etc.) */
.btn.btn-view-nav.btn-orange-filter-chicklet,
.btn.btn-view-nav.btn-orange-filter-chicklet:hover {
  --bs-btn-color: #dd6602;
  --bs-btn-hover-color: #dd6602;
  --bs-btn-active-color: #dd6602;
  --bs-btn-font-size: 0.857rem;  /* Changed from 1rem (14px) to 0.857rem (12px) */
  --bs-btn-padding-y: 0.5rem;
  --bs-btn-padding-x: 0.125rem;
  /* Remove: font-size: 1rem; */
  color: #dd6602;
}

/* Repeat for all color variants:
   - btn-red-filter-chicklet
   - btn-purple-filter-chicklet
   - btn-green-filter-chicklet
   - btn-dkblue-filter-chicklet
   - btn-pink-filter-chicklet
   - btn-ltblue-filter-chicklet
   - btn-ltgray-filter-chicklet
   - btn-dkgray-filter-chicklet
   - btn-black-filter-chicklet
*/
```

**Verification Steps**:

1. Compare chicklet font-size: Should be exactly 12px
2. Compare navbar height: Should be exactly 33px
3. Compare vertical alignment: All buttons/inputs should be centered
4. Verify colors match production exactly

---

### 1.4 Pixel-Perfect Verification Checklist

**Top Navbar** (`#th-global-navbar-top`):

- [ ] Overall navbar height: 33px (32px content + 1px border)
- [ ] Button height: 30px
- [ ] Button font-size: 13px
- [ ] Button padding: 5.25px vertical, 14px horizontal
- [ ] Logo height: 18px
- [ ] All items vertically centered
- [ ] Background color: #222
- [ ] Border: 1px solid black (bottom)
- [ ] No `!important` rules (use custom properties)

**Secondary Navbar** (`.watched-repo-navbar`):

- [ ] Overall navbar height: 33px (fixed, not min-height)
- [ ] Filter chicklet font-size: 12px (0.857rem)
- [ ] Filter chicklet colors match production
- [ ] Filter chicklet padding: 0.5rem vertical, 0.125rem horizontal
- [ ] Tier indicator size matches
- [ ] Quick filter input height matches
- [ ] All items vertically centered
- [ ] Background color: #354048
- [ ] No duplicate font-size declarations

**Cross-Browser Verification**:

- [ ] Chrome: Renders identically to production
- [ ] Firefox: Renders identically to production
- [ ] Safari: Renders identically to production (if available)

---

## Phase 2: Font Size Issues - Bootstrap 5 Native Approach

### 2.1 Revision and Bug Number Links in Push View

**Issue**: Links have larger font size than surrounding text

**Files**:

- `ui/job-view/pushes/PushHeader.jsx`
- `ui/css/treeherder-pushes.css`

**Bootstrap 5 Native Fix**:

```jsx
// In PushHeader.jsx
<span className="revision">
  <Link
    to={revisionPushFilterUrl}
    className="font-size-12"  // Use Bootstrap utility or custom class
  >
    {this.pushDateStr}
  </Link>
</span>
```

```css
/* ui/css/treeherder-pushes.css */
.revision {
  font-size: 12px;
}

.revision a {
  font-size: inherit; /* Inherit from parent instead of global anchor styles */
  color: inherit;
}

.commit-sha {
  font-size: 11px;
}

.commit-sha a {
  font-size: inherit;
}
```

**Action**:

- Remove global anchor font sizing from `treeherder-custom-styles.css` (line 28)
- Make links inherit font-size from their parent containers
- Use Bootstrap 5 typography utilities where appropriate

---

### 2.2 Failure Suggestion Filter and Log Buttons

**Issue**: Button sizes increased but should maintain 8px font size

**Files**:

- `ui/shared/tabs/failureSummary/SuggestionsListItem.jsx`
- `ui/shared/tabs/failureSummary/BugListItem.jsx`

**Current Approach** (problematic):

```jsx
<Button
  className="bg-light py-1 px-2"
  variant="outline-secondary"
  style={{ fontSize: '8px' }}  // Inline style - not maintainable
>
```

**Bootstrap 5 Native Fix**:

Create a reusable component or use consistent props:

```jsx
// Option 1: Reusable FailureActionButton component
const FailureActionButton = ({ icon, onClick, title, children }) => (
  <Button
    size="sm"
    variant="outline-secondary"
    className="failure-action-btn bg-light"
    onClick={onClick}
    title={title}
  >
    <FontAwesomeIcon icon={icon} />
    {children}
  </Button>
);

// Usage
<FailureActionButton
  icon={faBug}
  onClick={() => toggleBugFiler(suggestion)}
  title="File a bug for this failure"
/>
```

```css
/* ui/css/failure-summary.css */
.failure-action-btn {
  --bs-btn-font-size: 8px;
  --bs-btn-padding-y: 0.25rem;
  --bs-btn-padding-x: 0.5rem;
  --bs-btn-line-height: 1;
}
```

**Action**:

- Remove all inline `style={{ fontSize: '8px' }}` from these components
- Create a consistent button class using Bootstrap 5 custom properties
- Consider creating a reusable component for these tiny action buttons

---

### 2.3 Suggested Bugs Font Size

**Issue**: Bug links are too large

**Files**:

- `ui/shared/tabs/failureSummary/BugListItem.jsx`

**Bootstrap 5 Native Fix**:

```jsx
<a
  className="bug-link ms-1"  // Use semantic class name
  href={bugUrl}
  target="_blank"
  rel="noopener noreferrer"
>
  {bug.summary} (bug {bug.id})
</a>
```

```css
/* ui/css/failure-summary.css */
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

**Action**:

- Set font-size on the container, let links inherit
- Remove global anchor styles that override this
- Use Bootstrap 5's color utilities where appropriate

---

### 2.4 Bottom Left Bug Number (Details Panel)

**Issue**: Bug links should match panel text size

**Files**:

- `ui/css/treeherder-details-panel.css`

**Bootstrap 5 Native Fix**:

```css
/* ui/css/treeherder-details-panel.css */
#details-panel {
  font-size: 12px;
}

#details-panel a {
  font-size: inherit;
  color: #337ab7;
}

#details-panel a:visited {
  color: purple;
}
```

**Action**:

- Set panel font-size once at the container level
- All child elements including links should inherit

---

## Phase 3: Layout Issues - Bootstrap 5 Native Approach

### 3.1 Active Filters - Form Inline Replacement

**Issue**: Bootstrap 5 removed `.form-inline`, causing 3-line layout

**Files**:

- `ui/job-view/headerbars/ActiveFilters.jsx`

**Current Approach** (Bootstrap 4):

```jsx
<form className="form-inline">
  <div className="form-group input-group-sm new-filter-input">
```

**Bootstrap 5 Native Fix**:

```jsx
// Use Bootstrap 5's flexbox utilities
<Form className="d-flex flex-row align-items-center gap-2">
  <Form.Select
    size="sm"
    id="job-filter-field"
    value={newFilterField}
    onChange={(evt) => this.setNewFilterField(evt.target.value)}
    className="flex-shrink-0"
    style={{ width: 'auto' }}
  >
    <option value="" disabled>select filter field</option>
    {/* options */}
  </Form.Select>

  {newFilterMatchType !== 'choice' && (
    <Form.Control
      size="sm"
      value={newFilterValue}
      onChange={(evt) => this.setNewFilterValue(evt.target.value)}
      type="text"
      placeholder="enter filter value"
      className="flex-grow-1"
      style={{ minWidth: '150px' }}
    />
  )}

  <Button size="sm" variant="outline-secondary" onClick={this.addNewFieldFilter}>
    add
  </Button>
  <Button size="sm" variant="outline-secondary" onClick={this.clearNewFieldFilter}>
    cancel
  </Button>
</Form>
```

**Action**:

- Replace `form-inline` with Bootstrap 5's flexbox utilities: `d-flex`, `flex-row`, `align-items-center`
- Use `gap-2` for spacing instead of margins
- Use `flex-shrink-0` and `flex-grow-1` for sizing behavior
- Remove the `.form-group` wrapper (not needed in Bootstrap 5)
- Use `size="sm"` prop on all form controls

---

### 3.2 Bottom Left Action Menu - "Inspect Task" Alignment

**Issue**: Menu item misaligned

**Files**:

- `ui/job-view/details/summary/ActionBar.jsx`

**Bootstrap 5 Native Fix**:

```jsx
// Ensure all dropdown items use consistent Bootstrap 5 structure
<Dropdown.Menu>
  <Dropdown.Item onClick={inspectTaskAction}>
    Inspect Task
  </Dropdown.Item>
  <Dropdown.Item onClick={otherAction}>
    Other Action
  </Dropdown.Item>
</Dropdown.Menu>
```

```css
/* Only add custom CSS if Bootstrap 5 doesn't provide the alignment */
/* Most likely this is a wrapper issue that can be fixed in JSX */
```

**Action**:

- Review the JSX structure to ensure proper react-bootstrap Dropdown component usage
- Verify all menu items are `Dropdown.Item` components
- Remove any custom wrapper divs that might affect alignment

---

### 3.3 Bottom Toolbar Button Vertical Centering

**Issue**: Toolbar buttons not vertically centered

**Files**:

- `ui/job-view/details/DetailsPanel.jsx`
- `ui/css/treeherder-details-panel.css`

**Bootstrap 5 Native Fix**:

```jsx
// In DetailsPanel.jsx
<nav className="details-panel-navbar d-flex align-items-center">
  <ul className="tab-headers d-flex mb-0">
    {/* tabs */}
  </ul>
  <div className="d-flex align-items-center ms-auto">
    {/* action buttons */}
  </div>
</nav>
```

```css
/* ui/css/treeherder-details-panel.css */
.details-panel-navbar {
  background-color: #252c33;
  height: 33px;
  /* Remove flex-direction, let Bootstrap utilities handle it */
}

.details-panel-navbar .actionbar-nav {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0;
}
```

**Action**:

- Use Bootstrap 5's `d-flex` and `align-items-center` utilities in JSX
- Remove conflicting CSS flex properties
- Ensure all toolbar items are in flex containers with proper alignment

---

## Phase 4: Visual Polish - Bootstrap 5 Native Approach

### 4.1 Show More Bug Suggestions Button - Border and Underline

**Issue**: Missing border, has underline

**Files**:

- `ui/shared/tabs/failureSummary/SuggestionsListItem.jsx`

**Current Approach**:

```jsx
<Button
  variant="link"  // This causes the underline issue
  onClick={this.clickShowMore}
  className="bg-light px-2 py-1 btn btn-outline-secondary btn-xs my-2"
>
```

**Bootstrap 5 Native Fix**:

```jsx
<Button
  size="sm"
  variant="outline-dark"  // Use proper button variant instead of "link"
  onClick={this.clickShowMore}
  className="show-more-suggestions my-2"
>
  {suggestionShowMore
    ? 'Hide bug suggestions'
    : 'Show more bug suggestions'}
</Button>
```

```css
/* ui/css/failure-summary.css */
.show-more-suggestions {
  --bs-btn-font-size: 11px;
  --bs-btn-padding-y: 0.25rem;
  --bs-btn-padding-x: 0.5rem;
  --bs-btn-border-color: #000;
  --bs-btn-color: #000;
}
```

**Action**:

- Replace `variant="link"` with `variant="outline-dark"` or `variant="outline-secondary"`
- Use Bootstrap 5 button custom properties for sizing
- Remove redundant classes (`btn` is added by react-bootstrap automatically)

---

### 4.2 Pinboard Layout Issues

**Issue**: Pinboard opening causes content squeezing

**Files**:

- `ui/job-view/details/PinBoard.jsx`
- `ui/job-view/details/DetailsPanel.jsx`

**Bootstrap 5 Native Fix**:

```jsx
// Ensure proper flex layout in DetailsPanel
<div className="d-flex flex-column h-100">
  <div className="flex-shrink-0">
    {/* Pinboard - fixed height */}
    <PinBoard />
  </div>
  <div className="flex-grow-1 overflow-auto">
    {/* Failure summary - takes remaining space */}
    <FailureSummaryTab />
  </div>
</div>
```

**Action**:

- Use Bootstrap 5's flex utilities: `flex-shrink-0`, `flex-grow-1`
- Ensure pinboard has fixed height, failure summary fills remaining space
- Use `overflow-auto` to handle scrolling in the right container

---

### 4.3 Logviewer - Failure Line Numbers Visibility

**Issue**: White text on white background

**Files**:

- `ui/logviewer/Navigation.jsx`
- `ui/logviewer/App.jsx`

**Bootstrap 5 Native Fix**:

```jsx
// Use Bootstrap 5 badge component for line numbers
<Badge bg="secondary" className="error-line-number">
  Line {lineNumber}
</Badge>
```

```css
/* ui/logviewer/logviewer.css */
.error-line-number {
  --bs-badge-font-size: 12px;
  --bs-badge-padding-x: 0.5rem;
  --bs-badge-padding-y: 0.25rem;
}
```

**Action**:

- Use react-bootstrap `Badge` component with proper variant
- Remove custom styling that conflicts with Bootstrap 5

---

### 4.4 User Menu Dropdown Indicator

**Issue**: Dropdown caret is hidden

**Files**:

- `ui/shared/auth/Login.jsx`
- `ui/css/treeherder-navbar.css`

**Current Issue**:

```css
/* This rule hides ALL dropdown carets */
.nav-menu-btn::after {
  display: none !important;
}
```

**Bootstrap 5 Native Fix**:

```jsx
// In Login.jsx
<Dropdown>
  <Dropdown.Toggle
    variant="dark"
    className="nav-menu-btn user-menu-toggle"  // Add specific class
    id="user-menu"
  >
    {user.email}
  </Dropdown.Toggle>
  <Dropdown.Menu>
    {/* menu items */}
  </Dropdown.Menu>
</Dropdown>
```

```css
/* ui/css/treeherder-navbar.css */
/* Only hide caret for specific menus, not all */
.nav-menu-btn:not(.user-menu-toggle)::after {
  display: none;
}

/* Or better - use noCaret prop where appropriate */
```

**Or in JSX**:

```jsx
// For menus that shouldn't have carets, use the prop
<Dropdown.Toggle noCaret variant="dark">
  Menu Text
</Dropdown.Toggle>
```

**Action**:

- Use react-bootstrap's `noCaret` prop instead of CSS to hide carets
- Only apply it to specific dropdowns, not globally
- Remove the global `::after { display: none }` rule

---

### 4.5 Bugfiler Input Fields Vertical Height

**Issue**: Input fields too tall

**Files**:

- `ui/shared/BugFiler.jsx`

**Current Approach**:

```jsx
<Form.Control
  type="text"
  placeholder="e.g. Firefox, Toolkit, Testing"
  className="flex-fill flex-grow-1"
/>
```

**Bootstrap 5 Native Fix**:

```jsx
<Form.Control
  size="sm"  // Use Bootstrap 5's size prop
  type="text"
  placeholder="e.g. Firefox, Toolkit, Testing"
  className="flex-grow-1"
/>
```

**Action**:

- Add `size="sm"` prop to all Form.Control components in BugFiler
- Remove unnecessary classes like `flex-fill` (use `flex-grow-1` instead)
- Let Bootstrap 5's size system handle the heights

---

## Phase 5: Global CSS Cleanup

### 5.1 Remove Bootstrap 4 Overrides

**Files**:

- `ui/css/treeherder-custom-styles.css`

**Actions**:

- Remove or refactor lines 14-30 (global font-size forcing)
- Remove global anchor font-size (line 28)
- Keep only Treeherder-specific styles that aren't covered by Bootstrap 5
- Move color definitions to Bootstrap 5 theme variables

### 5.2 Consolidate Custom Button Styles

**Files**:

- `ui/css/treeherder-job-buttons.css`
- `ui/css/treeherder-navbar.css`

**Actions**:

- Convert custom button classes to use Bootstrap 5 custom properties
- Use Bootstrap 5's button variant system where possible
- Document which custom button styles are Treeherder-specific

---

## Implementation Checklist

### Setup Phase

- [ ] Create `ui/css/bootstrap-custom.scss` with Treeherder variables
- [ ] Update build configuration to use custom Bootstrap build
- [ ] Test that base font-size is 14px across the application

### Phase 1: Pixel-Perfect Navigation Bars

**Goal: Top and Secondary navbars match production exactly**

**Visual Comparison**:

- [ ] Set up Chrome DevTools MCP comparison workflow
- [ ] Navigate to prod: <https://treeherder.mozilla.org/jobs?repo=autoland>
- [ ] Navigate to local: <http://localhost:5001/jobs?repo=autoland>
- [ ] Take screenshots of both navbars for reference
- [ ] Document current differences

**Top Navbar (`#th-global-navbar-top`) Fixes**:

- [ ] Remove `!important` from `.nav-menu-btn` font-size and line-height (treeherder-navbar.css:88-89)
- [ ] Change `padding-top: 1.5px` to `padding-top: 2px` (treeherder-navbar.css:13)
- [ ] Add explicit `height: 33px` to `#th-global-navbar-top`
- [ ] Verify button height: 30px
- [ ] Verify button font-size: 13px
- [ ] Verify navbar height: 33px total
- [ ] Verify vertical centering of all items

**Secondary Navbar (`.watched-repo-navbar`) Fixes**:

- [ ] Change `min-height: 33px` to `height: 33px` (treeherder-navbar.css:117-136)
- [ ] Change all filter chicklet `--bs-btn-font-size: 1rem` to `0.857rem` (12px)
- [ ] Remove duplicate `font-size: 1rem` from all chicklet classes
- [ ] Fix orange chicklet (treeherder-navbar.css:188-199)
- [ ] Fix red chicklet (treeherder-navbar.css:201-211)
- [ ] Fix purple chicklet (treeherder-navbar.css:213-223)
- [ ] Fix green chicklet (treeherder-navbar.css:225-235)
- [ ] Fix dark blue chicklet (treeherder-navbar.css:237-247)
- [ ] Fix pink chicklet (treeherder-navbar.css:249-259)
- [ ] Fix light blue chicklet (treeherder-navbar.css:261-271)
- [ ] Fix light gray chicklet (treeherder-navbar.css:273-283)
- [ ] Fix dark gray chicklet (treeherder-navbar.css:285-295)
- [ ] Fix black chicklet (treeherder-navbar.css:297-307)
- [ ] Verify chicklet font-size: 12px
- [ ] Verify navbar height: 33px
- [ ] Verify vertical alignment

**Final Verification**:

- [ ] Screenshot comparison: Top navbar matches prod pixel-perfect
- [ ] Screenshot comparison: Secondary navbar matches prod pixel-perfect
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari (if available)
- [ ] No console errors on local
- [ ] All navbar elements vertically centered

### Phase 2: Font Size Issues

- [ ] Revision links (12px, inherit from parent)
- [ ] Commit SHA links (11px, inherit from parent)
- [ ] Failure action buttons (8px, consistent sizing)
- [ ] Bug suggestion links (12px, inherit from parent)
- [ ] Details panel links (inherit from 12px panel)

### Phase 3: Layout Issues

- [ ] Active filters form (flexbox inline layout)
- [ ] Action menu alignment (consistent dropdown items)
- [ ] Toolbar vertical centering (flex utilities)

### Phase 4: Visual Polish

- [ ] Show more button (border, no underline)
- [ ] Pinboard layout (proper flex behavior)
- [ ] Logviewer line numbers (visible badges)
- [ ] User menu dropdown caret (visible)
- [ ] Bugfiler inputs (sm size)

### Phase 5: Global CSS Cleanup

- [ ] Remove Bootstrap 4 overrides from treeherder-custom-styles.css
- [ ] Consolidate button styles to use Bootstrap 5 patterns
- [ ] Document remaining custom CSS

---

## Files to Modify

### New Files

1. **`ui/css/bootstrap-custom.scss`** - Bootstrap 5 customization with Treeherder variables

### CSS Files (Refactor to Bootstrap 5 patterns)

1. `ui/css/treeherder-custom-styles.css` - Remove B4 overrides, keep TH-specific styles
2. `ui/css/treeherder-navbar.css` - Convert to Bootstrap 5 custom properties
3. `ui/css/treeherder-pushes.css` - Use inheritance for link sizing
4. `ui/css/failure-summary.css` - Use Bootstrap 5 patterns for buttons and links
5. `ui/css/treeherder-details-panel.css` - Use flexbox utilities, remove conflicting styles
6. `ui/logviewer/logviewer.css` - Use Bootstrap 5 badge system

### JSX Components (Use react-bootstrap props and utilities)

1. `ui/job-view/headerbars/PrimaryNavBar.jsx` - Consistent button props
2. `ui/job-view/headerbars/SecondaryNavBar.jsx` - Proper button sizing
3. `ui/job-view/headerbars/ActiveFilters.jsx` - Replace form-inline with flexbox
4. `ui/job-view/details/summary/ActionBar.jsx` - Fix dropdown structure
5. `ui/job-view/details/DetailsPanel.jsx` - Use flex utilities
6. `ui/shared/tabs/failureSummary/SuggestionsListItem.jsx` - Remove inline styles, use props
7. `ui/shared/tabs/failureSummary/BugListItem.jsx` - Remove inline styles, use props
8. `ui/shared/BugFiler.jsx` - Add size="sm" props
9. `ui/shared/auth/Login.jsx` - Show dropdown caret
10. `ui/logviewer/Navigation.jsx` - Use Badge component

### Build Configuration

- Update webpack/build config to import `bootstrap-custom.scss` instead of default Bootstrap CSS

---

## Testing Strategy

### Visual Regression Testing

1. Compare staging (<https://treeherder.allizom.org>) with local (<http://localhost:5001>)
2. Test all three main views: Treeherder (TH), Perfherder (PH), Intermittent Failures View (IFV)
3. Take screenshots at key states:
   - Empty state
   - With filters active
   - With pinboard open
   - With failure details showing
   - Logged in vs logged out

### Component Testing

1. Test all button sizes across different contexts
2. Verify form layouts in different screen sizes
3. Test dropdown menus and their carets
4. Verify badge and label styling

### Browser Testing

- Chrome
- Firefox
- Safari (if applicable)

---

## Success Criteria

✅ **Visual Parity**: Application looks identical to pre-migration version
✅ **Bootstrap 5 Native**: Using Bootstrap 5 classes, props, and custom properties
✅ **No Workarounds**: No `!important` rules or inline styles for sizing
✅ **Maintainable**: Code is cleaner and easier to maintain
✅ **Documented**: Custom Bootstrap variables are documented
✅ **Future-Proof**: Easy to update Bootstrap 5 in the future

---

## Notes

- **SASS Required**: This approach requires compiling Bootstrap from source with custom variables
- **Build Time**: May increase initial build time slightly due to SASS compilation
- **Documentation**: Keep bootstrap-custom.scss well-documented for future maintainers
- **Incremental**: Can be implemented incrementally (one priority level at a time)
- **Testing**: Thorough visual testing required to ensure parity

---

**Baseline Reference**: <https://treeherder.allizom.org>
**Development Environment**: <http://localhost:5001>
**Bootstrap 5 Docs**: <https://getbootstrap.com/docs/5.3/>
**react-bootstrap Docs**: <https://react-bootstrap.github.io/>

---

**Date Created**: 2025-10-27
**Date Updated**: 2025-10-27
**Status**: Ready for Implementation
**Approach**: Bootstrap 5 Native Migration
