// Check if the element is visible on screen or not,
// with the screen being the area between the top bars and the details panel.
const isOnScreen = function isOnScreen(el) {
  const offset = el.getBoundingClientRect();

  const topBarSelectors = [
    // At the top, always shown.
    "#global-navbar-container",
    // If shown, .active-filters-bar is below #global-navbar-container
    ".active-filters-bar",
    // Shown if the web app has updated and the page should be reloaded.
    ".update-alert-panel",
  ];
  let topBound = 0;
  for (const selector of topBarSelectors) {
    const topElem = document.querySelector(selector);
    if (topElem) {
      topBound = Math.max(topBound, topElem.getBoundingClientRect().bottom);
    }
  }

  // The details view, always shown at the bottom.
  const bottomPanelElem = document.querySelector("#details-panel");
  let bottomBound;
  if (bottomPanelElem) {
    bottomBound = bottomPanelElem.getBoundingClientRect().top;
  } else {
    bottomBound = window.innerHeight;
  }

  return offset.top >= topBound && offset.bottom <= bottomBound;
};

// Scroll the element into view, if needed to be visible between the top bar
// and the details panel at the bottom.
export const scrollToElement = function scrollToElement(el) {
  if (!isOnScreen(el)) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};
