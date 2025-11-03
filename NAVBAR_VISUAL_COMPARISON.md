# Bootstrap 5 Migration - Visual Styling Comparison Report

**Date:** 2025-11-01
**Status:** Phase 1 (Navbar Fixes) - In Progress
**Scope:** Top Navigation Bar and Secondary Navigation Bar Styling

---

## Current Implementation Status

### What Has Been Fixed So Far

#### Top Navigation Bar (`.nav-menu-btn`) - MOSTLY COMPLETE

File: `ui/css/treeherder-navbar.css:80-91`

**Good Changes:**

- [x] Removed `font-size: 14px !important` (was using !important)
- [x] Changed to use Bootstrap 5 custom properties: `--bs-btn-font-size: 13px`
- [x] Added `--bs-btn-padding-y: 5.25px`
- [x] Added `--bs-btn-padding-x: 14px`
- [x] Added `--bs-btn-line-height: 19.5px`
- [x] Added `height: 30px` (explicit height)
- [x] Added `min-height: 30px`
- [x] Fixed `padding-top: 1.5px` → `2px` (whole pixels)
- [x] Added `line-height: 2` to `#th-global-navbar-top`
- [x] Removed the global `.nav-menu-btn::after { display: none !important; }` rule

**Current State:**

- Navbar buttons are correctly sized at 13px font-size
- Height is explicitly set to 30px
- No longer using !important for font-size override
- Using Bootstrap 5 custom properties (cleaner approach)

---

### Filter Chicklets (`.btn-*-filter-chicklet`) - PARTIALLY COMPLETE

File: `ui/css/treeherder-navbar.css:188-296`

**Issues Found:**

1. **Orange Chicklet - NEEDS FIX**

   ```css
   .btn.btn-view-nav.btn-orange-filter-chicklet {
     --bs-btn-font-size: 1rem;  /* ← WRONG: 14px instead of 12px */
   }
   ```

   Should be: `--bs-btn-font-size: 0.857rem;` (12px)

2. **Red Chicklet - NEEDS FIX**

   ```css
   .btn.btn-view-nav.btn-red-filter-chicklet {
     --bs-btn-font-size: 1rem;  /* ← WRONG: 14px instead of 12px */
   }
   ```

   Should be: `--bs-btn-font-size: 0.857rem;` (12px)

3. **Purple Chicklet - CORRECT** ✓
   - `--bs-btn-font-size: 0.857rem;` (12px) ✓

4. **Green Chicklet - CORRECT** ✓
   - `--bs-btn-font-size: 0.857rem;` (12px) ✓

5. **Dark Blue Chicklet - CORRECT** ✓
   - `--bs-btn-font-size: 0.857rem;` (12px) ✓

6. **Pink Chicklet - CORRECT** ✓
   - `--bs-btn-font-size: 0.857rem;` (12px) ✓

7. **Light Blue Chicklet - CORRECT** ✓
   - `--bs-btn-font-size: 0.857rem;` (12px) ✓

8. **Light Gray Chicklet - CORRECT** ✓
   - `--bs-btn-font-size: 0.857rem;` (12px) ✓

9. **Dark Gray Chicklet - CORRECT** ✓
   - `--bs-btn-font-size: 0.857rem;` (12px) ✓

10. **Black Chicklet - CORRECT** ✓
    - `--bs-btn-font-size: 0.857rem;` (12px) ✓

---

## Remaining Issues to Fix

### 1. Filter Chicklets: Orange and Red Font Size

**Priority:** HIGH (Visual Impact - Spacing Issues)
**Affected Components:** Secondary navbar filter buttons
**Problem:** Orange and red chicklets are 14px instead of 12px, causing them to be slightly taller and misaligned with other chicklets
**Location:** `ui/css/treeherder-navbar.css:188-208`

**Fix Required:**

```css
/* CHANGE FROM: */
.btn.btn-view-nav.btn-orange-filter-chicklet,
.btn.btn-view-nav.btn-orange-filter-chicklet:hover {
  --bs-btn-font-size: 1rem;  /* ← CHANGE THIS */
}

/* CHANGE TO: */
.btn.btn-view-nav.btn-orange-filter-chicklet,
.btn.btn-view-nav.btn-orange-filter-chicklet:hover {
  --bs-btn-font-size: 0.857rem;  /* ← 12px */
}
```

Same fix needed for red chicklet (lines 199-208).

---

### 2. Secondary Navbar Height - MINOR ISSUE

**Priority:** LOW (No visual impact unless content grows)
**Location:** `ui/css/treeherder-navbar.css:134`
**Current:** `min-height: 33px;` (allows growth)
**Issue:** Navbar can expand if content is larger than 33px

**Recommendation:** Either:

1. Keep `min-height: 33px` if flexible is desired, OR
2. Change to `height: 33px` if fixed height is required

**Analysis:** The fix plan originally suggested changing to `height: 33px`, but this may cause content to overflow if items are too large. Current `min-height` approach is actually reasonable for Bootstrap 5.

---

### 3. Caret Visibility Issue - FIXED

**Status:** ALREADY RESOLVED ✓
**Issue:** Global rule `.nav-menu-btn::after { display: none !important; }` was hiding all dropdown carets
**Current State:** Rule has been removed from CSS
**New Approach:** Use react-bootstrap's `noCaret` prop on specific dropdowns instead of global CSS rule
**Implementation Status:** CSS rule removed; need to verify JSX components use appropriate caret visibility

---

## Detailed Visual Specifications

### Top Navigation Bar (#th-global-navbar-top)

| Property | Target | Current | Status |
|----------|--------|---------|--------|
| Height | 32px (content) + 1px border = 33px | 33px | ✓ |
| Padding-top | 2px | 2px | ✓ |
| Background | #222 | #222 | ✓ |
| Border | 1px solid black (bottom) | 1px solid black | ✓ |
| Line-height | 2 (unitless) | 2 | ✓ |

### Navigation Buttons (.nav-menu-btn)

| Property | Target | Current | Status |
|----------|--------|---------|--------|
| Font-size | 13px | 13px (custom property) | ✓ |
| Height | 30px | 30px | ✓ |
| Min-height | 30px | 30px | ✓ |
| Padding-y | 5.25px | 5.25px (custom property) | ✓ |
| Padding-x | 14px | 14px (custom property) | ✓ |
| Line-height | 19.5px | 19.5px (custom property) | ✓ |
| Vertical Align | Centered | Centered (flex) | ✓ |

### Secondary Navbar (.watched-repo-navbar)

| Property | Target | Current | Status |
|----------|--------|---------|--------|
| Height | 33px | min-height: 33px | ~ |
| Background | #354048 | #354048 | ✓ |
| Alignment | Center | Flex center | ✓ |

### Filter Chicklets - Font Sizes

| Chicklet Color | Target | Current | Status |
|---|---|---|---|
| Orange | 12px (0.857rem) | 14px (1rem) | **FIX NEEDED** |
| Red | 12px (0.857rem) | 14px (1rem) | **FIX NEEDED** |
| Purple | 12px (0.857rem) | 12px (0.857rem) | ✓ |
| Green | 12px (0.857rem) | 12px (0.857rem) | ✓ |
| Dark Blue | 12px (0.857rem) | 12px (0.857rem) | ✓ |
| Pink | 12px (0.857rem) | 12px (0.857rem) | ✓ |
| Light Blue | 12px (0.857rem) | 12px (0.857rem) | ✓ |
| Light Gray | 12px (0.857rem) | 12px (0.857rem) | ✓ |
| Dark Gray | 12px (0.857rem) | 12px (0.857rem) | ✓ |
| Black | 12px (0.857rem) | 12px (0.857rem) | ✓ |

---

## Next Steps (Immediate Actions)

### Action 1: Fix Orange and Red Chicklet Font Sizes

**Files:** `ui/css/treeherder-navbar.css`
**Changes:** 2 lines to modify

```
Lines 193 and 204: Change --bs-btn-font-size from 1rem to 0.857rem
```

### Action 2: Verify Dropdown Caret Behavior

**Files:**

- `ui/job-view/headerbars/PrimaryNavBar.jsx`
- `ui/shared/auth/Login.jsx`
- Other components using dropdowns

**Verification:** Ensure appropriate dropdowns show/hide carets as intended

### Action 3: Visual Regression Testing

Once fixes are applied:

1. Compare local navbar with production at same zoom level
2. Verify all chicklets are same height (12px font-size)
3. Check for vertical alignment issues
4. Test in Chrome, Firefox, Safari

---

## Code Quality Improvements Made

### Bootstrap 5 Best Practices Applied

1. **Removed !important overrides** - Using custom properties instead
2. **Switched to custom properties** - `--bs-btn-font-size` instead of direct property
3. **Removed fractional padding** - Changed 1.5px to 2px
4. **Removed global caret hiding** - Will use component-level props instead
5. **Used whole pixel values** - Better cross-browser consistency

### What Still Needs Bootstrap 5 Review

- Review if `min-height: 33px` vs `height: 33px` is correct
- Verify all dropdowns have correct caret visibility approach
- Check if any other global overrides can be removed

---

## Related Documentation

- **Investigation Document:** `/Users/camerondawson/mroot/treeherder/BOOTSTRAP_5_INVESTIGATION.md`
- **Fix Plan:** `/Users/camerondawson/mroot/treeherder/BOOTSTRAP_5_STYLING_FIX_PLAN.md`
- **Custom Bootstrap Config:** `ui/css/bootstrap-custom.scss`

---

## Summary

**Phase 1 Progress:** 90% Complete

- Top navbar: Fully fixed (13px buttons, 30px height, custom properties)
- Secondary navbar: Mostly fixed (8/10 chicklets correct)
- Remaining: Fix 2 chicklet colors (orange, red)

**Estimated Time to Complete:** 5 minutes (update 2 CSS lines)
**Visual Impact When Complete:** High - all navbar elements will be properly sized and aligned
