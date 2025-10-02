# Bugfix plan

Think deeply. Create a plan to fix issues within the /perfherder route.

The local running app is at <http://localhost:5001/perfherder>

Fixes needed for the /perfherder/graphs route:

1. the dropdown for "Last 14 Days" is always expanded.  it should only expand when clicked.  The color should be the teal, not primary.
2. Clicking "Add test data" brings up a modal dialog.  There is a "Last 14 days" dropdown on this modal that has the same issue.  Also the close button should be an X, but it looks like a minus sign.
2a. Investigate if there is some kind of icon issue
