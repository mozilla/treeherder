# Bootstrap 4 to 5 Migration Plan for Treeherder

## Overview

This document outlines the necessary changes to migrate Treeherder from Bootstrap 4.4.1 to Bootstrap 5.3.3 to ensure compatibility with react-bootstrap 2.10.10.

## Critical Breaking Changes Affecting Treeherder

### 1. Spacing Utilities (High Priority)

**Issue:** Bootstrap 5 renamed all left/right spacing utilities to start/end for RTL support

- `ml-*` → `ms-*` (margin-left to margin-start)
- `mr-*` → `me-*` (margin-right to margin-end)
- `pl-*` → `ps-*` (padding-left to padding-start)
- `pr-*` → `pe-*` (padding-right to padding-end)

**Files Affected:**

- Multiple JSX files using `ml-`, `mr-`, `pl-`, `pr-` classes
- Examples found in: ActionBar.jsx, StatusPanel.jsx, ClassificationsPanel.jsx, Navigation.jsx

**Action Required:**

- [ ] Replace all `ml-*` with `ms-*`
- [ ] Replace all `mr-*` with `me-*`
- [ ] Replace all `pl-*` with `ps-*`
- [ ] Replace all `pr-*` with `pe-*`

### 2. Form Components (High Priority)

**Issue:** Bootstrap 5 significantly restructured form components

- `.form-group` class removed (no longer needed)
- `.form-control-label` → `.form-label`
- `.custom-select` → `.form-select`
- `.custom-control`, `.custom-checkbox`, `.custom-radio` removed
- Form checks now use `.form-check`, `.form-check-input`, `.form-check-label`

**Files Affected:**

- CustomJobActions.jsx (uses `.form-group`)
- Any components using custom form controls

**Action Required:**

- [ ] Remove `.form-group` wrapper divs or replace with spacing utilities
- [ ] Update custom select components to use `.form-select`
- [ ] Update checkbox/radio components to new form-check structure

### 3. Float Utilities (Medium Priority)

**Issue:** Float utilities renamed for consistency

- `float-left` → `float-start`
- `float-right` → `float-end`

**Files Affected:**

- Check all components for float utilities

**Action Required:**

- [ ] Replace `float-left` with `float-start`
- [ ] Replace `float-right` with `float-end`

### 4. Close Button (Medium Priority)

**Issue:** Close button markup changed

- Bootstrap 4: `<button class="close">&times;</button>`
- Bootstrap 5: `<button class="btn-close"></button>`

**Files Affected:**

- Modal components (CustomJobActions.jsx)
- Any custom close buttons

**Action Required:**

- [ ] Update close button markup and styling
- [ ] Remove `&times;` content, Bootstrap 5 uses background image

### 5. Badge Component (Low Priority)

**Issue:** Badge pill variant removed

- `.badge-pill` removed (use rounded utilities instead)

**Files Affected:**

- Any components using badge-pill

**Action Required:**

- [ ] Replace `.badge-pill` with `.rounded-pill`

### 6. Input Groups (High Priority)

**Issue:** Input group structure simplified

- `.input-group-append` and `.input-group-prepend` removed
- Children now placed directly in `.input-group`

**Files Affected:**

- Search components
- Form inputs with buttons/icons

**Action Required:**

- [ ] Remove `.input-group-append` and `.input-group-prepend` wrappers
- [ ] Place buttons/text directly in `.input-group`

### 7. Dropdown Component (High Priority)

**Issue:** Dropdown structure and attributes changed

- `data-toggle="dropdown"` → `data-bs-toggle="dropdown"`
- Dropdown dividers changed from `<div class="dropdown-divider">` to `<hr class="dropdown-divider">`
- Dark dropdowns now available with `.dropdown-menu-dark`

**Custom CSS Conflicts Found:**

- `treeherder-navbar.css` has custom dropdown styles that may conflict
- Custom `.dropdown-menu` positioning and sizing

**Action Required:**

- [ ] Update data attributes for vanilla JS dropdowns (if any)
- [ ] Update dropdown dividers to use `<hr>` tag
- [ ] Review custom dropdown CSS for conflicts

### 8. Navbar Component (High Priority)

**Issue:** Navbar structure significantly changed

- `.navbar-expand-*` behavior changed
- `.navbar-light` and `.navbar-dark` deprecated for `data-bs-theme`
- Navbar brand spacing changed

**Custom CSS Conflicts Found:**

- `treeherder-navbar.css` has extensive navbar customizations
- Custom `.navbar` padding overrides
- Custom `.navbar-right` flexbox styles

**Action Required:**

- [ ] Review navbar expand behavior
- [ ] Update color schemes to use data-bs-theme
- [ ] Test navbar responsiveness with new structure

### 9. Grid System (Low Priority)

**Issue:** New grid tier added (xxl), gutter classes changed

- Gutter classes now use `g-*`, `gx-*`, `gy-*` instead of spacing utilities
- `.no-gutters` → `.g-0`

**Action Required:**

- [ ] Update gutter classes if used
- [ ] Review responsive breakpoints

### 10. Custom CSS Overrides Review

**Potential Conflicts Found:**

1. **treeherder-custom-styles.css:**
   - Custom `.dropdown-menu` styles may conflict with BS5 structure
   - Custom `.form-control:focus` styles may need adjustment
   - Custom `.modal-header .close` styles need updating for new close button

2. **treeherder-navbar.css:**
   - Extensive navbar customizations may break with BS5 navbar changes
   - Dropdown positioning overrides may conflict

3. **treeherder-pushes.css:**
   - Custom button styles (`.btn-push`) should be tested
   - Badge customizations may need adjustment

## Migration Strategy

### Phase 1: Automated Replacements (Quick Wins)

1. [ ] Use find/replace for spacing utility changes (ml-*/mr-*/pl-*/pr-*)
2. [ ] Update float utilities
3. [ ] Replace badge-pill with rounded-pill

### Phase 2: Component Updates

1. [ ] Update form components and remove form-group
2. [ ] Fix input groups structure
3. [ ] Update dropdown components
4. [ ] Fix close buttons in modals

### Phase 3: Layout Fixes

1. [ ] Review and fix navbar layout issues
2. [ ] Test responsive grid behavior
3. [ ] Adjust custom CSS overrides as needed

### Phase 4: Visual Testing

1. [ ] Test each major page/view for layout issues
2. [ ] Check modal displays and interactions
3. [ ] Verify dropdown menus work correctly
4. [ ] Test form submissions and validations

## Component-Specific Issues to Watch

### React-Bootstrap Components

Since react-bootstrap 2.x is designed for Bootstrap 5, most react-bootstrap components should work correctly. However, watch for:

- Custom className props that use old Bootstrap 4 classes
- Components where we're mixing react-bootstrap with vanilla Bootstrap classes

### Custom Styling Adjustments

Areas likely needing custom CSS updates:

- Navbar height and spacing
- Dropdown menu positioning
- Form control focus states
- Modal header close buttons
- Badge colors and padding

## Testing Checklist

- [ ] Main navigation bar displays correctly
- [ ] Dropdown menus open and close properly
- [ ] Forms submit correctly
- [ ] Modals open, close, and display content properly
- [ ] Responsive layouts work at all breakpoints
- [ ] Custom buttons maintain proper styling
- [ ] Badge displays are consistent
- [ ] No JavaScript console errors

## Notes for Implementation

1. **Start with automated replacements** for spacing utilities as they're safe and widespread
2. **Test incrementally** - fix one component type at a time
3. **Use browser dev tools** to identify Bootstrap classes being applied
4. **Check computed styles** to see if custom CSS is being overridden by Bootstrap 5
5. **Consider using Bootstrap's new utility classes** instead of custom CSS where possible

## Areas Needing User Feedback

Once initial migration is complete, we'll need feedback on:

- [ ] Navbar functionality and appearance
- [ ] Form layouts and usability
- [ ] Modal displays
- [ ] Dropdown menu behavior
- [ ] Overall spacing and alignment
- [ ] Any broken interactive features

## Issues Found and Fixed

### 1. RevisionList and PushJobs Layout (COMPLETELY FIXED)

**Issue:** RevisionList was overlaying PushJobs, taking full width instead of sharing the row.

**Root Causes Identified:**

1. **Multiple nested grid components:** The main issue was nested `<Col>` components breaking Bootstrap's grid:
   - Push.jsx wrapped RevisionList in `<Col>`
   - RevisionList component internally used `<Col>` wrapper
   - Each Revision component used `<Row>`
   - This created invalid nested grid structure
2. **CSS conflicts:** Custom CSS in `treeherder-pushes.css` was overriding Bootstrap's grid:
   - `.push { width: 100%; }` forced full width
   - `.push .job-list-nopad { display: block; }` broke flex layout
   - Custom padding on columns interfered with Bootstrap's spacing
3. **Bootstrap 4 vs 5 class conflicts:** Multiple components had old spacing utilities
4. **Responsive wrapping:** Columns were wrapping on smaller screens instead of staying side-by-side
5. **Conditional rendering issue:** When `currentRepo` was undefined, columns weren't balanced

**Fixes Applied:**

**Push.jsx:**

- Changed `<div className="row">` to `<Row>` component
- Changed `<span className="col-7">` to `<Col xs={7}>`
- Changed `className="col-5"` to `xs={5}` for fixed column sizing
- Added `g-0` class to `Row` to remove gutters (Bootstrap 5 syntax)
- Removed `clearfix` class (not needed in Bootstrap 5)
- Removed responsive breakpoints (lg) to prevent columns from wrapping at small screen sizes
- Fixed conditional rendering to ensure proper column structure
- Updated spacing utility `ml-4` to `ms-4` (Bootstrap 5 syntax)

**RevisionList.jsx (CRITICAL FIX):**

- Changed `<Col className={widthClass}>` to `<div className={widthClass}>` to eliminate nested columns
- Updated `ml-2` to `ms-2` in MoreRevisionsLink component
- Removed unused `Col` import

**Revision.jsx:**

- Changed `<Row className="revision flex-nowrap">` to `<div className="revision d-flex flex-nowrap">`
- Updated all Bootstrap 4 spacing utilities:
  - `ml-1` → `ms-1`
  - `pr-1` → `pe-1`
  - `ml-2` → `ms-2`
- Removed unused `Row` import

**treeherder-pushes.css:**

- Removed `.push { width: 100%; }` that was forcing full width
- Removed `display: block` from `.push .job-list-nopad`
- Commented out custom padding that conflicted with Bootstrap's column spacing

**Final Status:** ✅ COMPLETELY RESOLVED

- RevisionList and PushJobs now display side-by-side correctly
- Columns maintain 5/7 ratio (42%/58%) at all screen sizes
- No overlapping or wrapping occurs
- Grid structure is now properly hierarchical

**Key Lessons Learned:**

1. **Bootstrap 5's grid system requires clean component hierarchy** - avoid nesting `<Row>`/`<Col>` components within other grid components
2. **Custom CSS can break Bootstrap grids** - be careful with `width`, `display`, and positioning overrides
3. **Component architecture matters** - shared components should not assume their grid context
4. **Bootstrap 4 to 5 migration requires systematic class updates** - spacing utilities, component structures, and responsive behavior all changed

---

*This document will be updated as issues are discovered and resolved during the migration process.*
