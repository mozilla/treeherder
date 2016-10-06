Treeherder Test Cases
======
These tests should be run prior to deploying code changes to the Treeherder production environment.

Initial page load
------
Load Treeherder. eg.

* [stage](https://treeherder.allizom.org)
* [production](https://treeherder.mozilla.org)

Depending on your test requirement.

    **Expected**: Page loads displaying resultsets pushed to mozilla-inbound.

Treeherder logo > Perfherder

    **Expected**: Perfherder loads displaying its initial Graph page.

Perfherder logo > Treeherder

    **Expected**: Treeherder loads again, displaying resultsets per step 1.

Check Job details Tab selection
------
Load Treeherder and select a completed/success job.

    **Expected**: The Job details tab should load by default.

Select a completed/failed job.

    **Expected**: The Failure summary tab should load.

Select a completed-success Talos job.

    **Expected**: The Performance tab should load.

Select a completed-failed Talos job.

    **Expected**: The Failure summary tab should load.

Select a Running job.

    **Expected**: The Failure summary tab should load.

Pin a job
------
Select a job, and click the 'pin' button in the lower navbar.

    **Expected**: Selected job pinned

Select another job, and hit [spacebar]

    **Expected**: Selected job pinned

Pinboard > Right hand menu dropdown > Clear all

    **Expected**: Both jobs are removed from the pinboard.

Failure summary tab
------
Select a classified or unclassified failed job.

    **Expected**: Ensure the Failure summary tab loads by default.

If a Bug suggestion is present in the failure summary:

* Click on the bug description link
* Click on the bug pin icon

    **Expected**: * Bug description link should load the correct BMO bug in a new tab
* Pin should pin the job and add the bug to the bug classification field

Pinboard > Right hand dropdown menu > Clear all
Similar jobs tab
------
Select a job, select the Similar jobs tab, wait several seconds.

    **Expected**: Recent jobs with matching symbols should load.

Select a Similar job row.

    **Expected**: The adjacent panel should update with its job information.

Scroll to the bottom of the Similar jobs tab, click 'Show previous jobs'.

    **Expected**: Additional, older jobs with matching symbols should load.

Job details pane
------
Select any job and confirm the following loads in the bottom left pane:

* Job:
* Machine name: (test this link)
* Build: (test this link)
* Job name:
* Requested:
* Started:
* Ended:
* Duration:
* Log parsing status:

(Note: Backfill job will eventually be moved to the Action bar in bug 1187394).

    **Expected**: Values load, are visible and correct, and links are valid.

Classify a job with associated bugs
------
Select and pin 3 jobs to the pinboard, select a classification type, add a classification comment and add bug 1164485. Select 'Save' in the pinboard.

    **Expected**: The jobs show with an asterisk in the job table, green notification banners appear confirming successful classification for each job.

Click Annotations tab.

    **Expected**: Ensure the same data appears in the panel.

Annotations tab > delete the bug and classification for that job. Select the other two jobs and repeat.

    **Expected**: The jobs should be unclassified, annotations removed.

Reload the page.

    **Expected**: The job should still be unclassified.

Switch repos
------
Click on the Repos menu, select a different repo.

    **Expected**: The new repo and its resultsets should load.

Reverse the process, and switch back.

    **Expected**: The original repo and resultsets should load.

Toggle unclassified failures
------
Load Treeherder and click on the "(n) unclassified" button in the top navbar.

    **Expected**: Only unclassified failures should be visible in the job table.

Filters panel
------
Click and open the 'Filters' menu panel in the top navbar, and turn off several job types in the panel.

    **Expected**: Job types turned off are suppressed in the job table.

Click on 'Reset' in the Filters panel.

    **Expected**: Filters UI should revert and suppressed jobs should reappear in the job table.

Filters panel > Field Filters > click new. Add a new filter eg. Platform, Linux.

    **Expected**: Only Linux platforms should be visible in the job table.

Filter by Job details name and signature
------
Select any job and in the lower left panel, click on the Job: keywords eg. "Linux x64 asan Mochitest Chrome"

    **Expected**: Ensure only jobs containing those keywords are visible.

Select any job and click on the adjacent "(sig)" signature link.

    **Expected**: Ensure only jobs using that unique signature SHA are visible.

Pin all visible jobs in resultset
------
Click on the Pin 'all' pin-icon in the right hand side of any resultset bar.

    **Expected**: Up to a maximum of 500 jobs should be pinned, and a matching notification warning should appear if exceeded.

Click in the pinboard on the extreme right hand drop down menu, and select 'Clear all'.

    **Expected**: All jobs should be removed from the pinboard.

Login / Logout
------
Login via Persona.

    **Expected**: The login button should switch to a generic Persona avatar, and the user email should appear on hover.

Logout

    **Expected**: The login button should switch back to "Login / Register".

View the Logviewer
------
Select any failed job and click the 'Log' icon in the lower navbar.

    **Expected**: The Logviewer loads in a new tab, and it contains correct job and revision information in the top left corner, and it preloads to the first failure line if one exists.

Click on another failure line in the failed step.

    **Expected**: The log should scroll to that failure line.

Click on 'show successful steps'.

    **Expected**: Green successful step bars should appear in the top right panel.

Click on a successful step.

    **Expected**: The log contents should scroll to the -- Start -- line for that step.

Thumbwheel/scroll/swipe downwards or upwards.

    **Expected**: The log should quickly load new chunks when encountering a log boundary.

Click on the Raw Log link.

    **Expected**: The raw log for the same job should load in a new tab.

Click all the available links in the result header, eg. "Inspect Task".

    **Expected**: Each should load correctly for that job.

Select Treeherder from the nav menu.

    **Expected**: Treeherder should load in the same window.

View the raw log
------
Select any completed job and click the raw log button in the lower navbar.

    **Expected**: The raw log for that job should load in a new tab.

View resultsets by Author
------
Click on the Author email (eg. ryanvm@gmail.com) in a resultset bar.

    **Expected**: Only resultsets pushed by that Author should appear.

Get next 10| resultsets via the main page footer.

    **Expected**: Only resultsets from that Author should be added.

View a single resultset
------
Load Treeherder and click on the 'Date' on the left side of any resultset.

    **Expected**: Only that resultset should load, with an accompanying URL param "&revision=(SHA)"

(optional) Wait a minute or two for ingestion updates.

    **Expected**: Only newly started jobs for that same resultset (if any have occurred) should appear. No new resultsets should load.

Quick Filter input field
------
Click the 'Filter platforms & jobs' input field in the top navbar, aka. Quick Filter.

    **Expected**: Input field should expand in width for long input.

Enter any text (eg. 'Android') and hit Enter

    **Expected**: Filter should be applied against the visible jobs and platform rows.

Click the grey (x) 'Clear this filter' icon the right hand side of the input field, and hit Enter.

    **Expected**: Filter should be cleared and input should shrink to original width.

Check resultset actions menu
------
From any resultset bar, select each entry in the far right dropdown that doesn't involve retriggers. eg:

Bugherder,
BuildAPI,
Revision URL List

    **Expected**: Each should open without error or hanging.

Get next 10|20|50 resultsets
------
Click on Get next 10| resultsets.

    **Expected**: Ensure exactly 10 additional resultsets were loaded.

Click on Get next 50| resultsets.

    **Expected**: Ensure the page has a reasonable load time of ~10 seconds.

View a single resultset via its Date link. Click Get next 10| resultsets.

    **Expected**: Ensure the page loads the 10 prior resultsets and the "tochange" and "fromchange" in the url appear correct.

Filter resultsets by URL fromchange, tochange
------
See also Treeherder [help](https://treeherder.mozilla.org/help.html) for URL Query String Parameters. Please test variants and perform exploratory testing as top/bottom of range is new functionality (Jun 3, 15')
Navigate to the 2nd resultset loaded, from the resultset action menu select 'Set as top of range'.

    **Expected**: Ensure: (1) 1st resultset is omitted (2) url contains `&tochange=SHA` and (3) ten resultsets are loaded from that new top

Navigate to the 3rd resultset loaded and select 'Set as bottom of range'

    **Expected**: Ensure (1) only the 3 ranged resultsets are loaded (2) url contains '&tochange=[top-SHA]&fromchange=[bottom-SHA]'

Click Get Next | 10 in the page footer.

    **Expected**: Ensure 10 additional pages load for a total of 13 resultsets.

(optional) wait a minute or two for job and resultset updates

    **Expected**: Updates should only occur for the visible resultsets. No new resultsets should appear.

Filter resultsets by URL date range
------
See also Treeherder [help](https://treeherder.mozilla.org/userguide.html) for URL Query String Parameters
Add a revision range to the URL in the format, eg:

&startdate=2015-09-28&enddate=2015-09-28

Warning: With the latest volume of jobs and resultsets, anything greater than a single day window risks loading too much data for the browser with Treeherder default filter and exclusion settings.

    **Expected**: Resultsets loaded should honor that range.

(Optional) Wait for new pushes to that repo.

    **Expected**: Resultsets loaded should continue to honor that range.

Modify Exclusion Profiles in the Sheriff panel
------
Open the Sheriffing panel in the top navbar, and change the Default exclusion to any other exclusion profile (eg. Test, Tier-2), by clicking on Make Default. Close the panel and reload the page.

    **Expected**: Jobs present in that new profile should be excluded from the Job table, when the Show/Hide excluded job button is in its On (open square) state.

Show/Hide excluded jobs
------
Click the open rounded-square button in the top navbar to Show/Hide excluded jobs.

    **Expected**: Confirm that jobs currently in the default exclusion profile appear when the icon is solid white (on) and disappear when off. Those jobs range from some Tier-2 jobs, Autophone, and other jobs specified in the default Exclusion Profile UI.

Perfherder Graphs
------
Load Perfherder at eg.
https://treeherder.allizom.org/perf.html

    **Expected**: Landing page should appear.

Click the blue 'Add test data' button, select a platform, enter a test series, and click Add+.

    **Expected**: Performance series should load with scatter graph and line graph.

Click Add more test data, and add a 2nd series.

    **Expected**: The second series is drawn in an alternate color, and both series can have their displays disabled/enabled via Show/Hide series tick UI.

Change display range dropdown to 90 days (or other value)

    **Expected**: Ensure both series expand to that date range. Confirm the data which has expired beyond the 6 week data cycle still appears, but the SHA just will instead display "loading revision".

No console errors throughout test run
------
Ensure the browser console is error free during and after the test run.
Open the console during the test run.

    **Expected**: No errors should appear in the console.

Perfherder Compare
------
Load Perfherder Compare at eg.
https://treeherder.allizom.org/perf.html#/comparechooser

    **Expected**: Landing page should appear.

Select two push revisions from the 'Recent' dropdowns, and click 'Compare revisions'.

    **Expected**: Some kind of result should appear (likely a warning "tests with no results: " table).

Click on the 'Substests' link for a row.

    **Expected**: Sub-compare results should appear.

Click on the 'Graph' link for a sub-compare row if it exists.

    **Expected**: The plotted graph for that series should appear.

All keyboard shortcuts
------
Note: Listed "Toggle in-progress" shortcut 'i' is known not to be working at this time.
Check all keyboard shortcut functionality as listed in [help](https://treeherder.mozilla.org/help.html).

    **Expected**: Each shortcut should work as expected.

Job counts
------
In any resultset with job counts, click on the group button eg. B( ) to expand the count.

    **Expected**: Jobs should appear.

Select an expanded job, and click again on the group button B() to collapse the count back down.

    **Expected**: The count should appear as a highlighted large button. eg. pending gray "+14"

Click in empty space to deselect the collapsed job.

    **Expected**: The count "+14" should be deselected.

Click on the ( + ) global Expand/Collapse icon in the navbar to toggle all +n counts.

    **Expected**: Counts should expand and collapse on all visible resultsets.

Navigate via the n,p and left/right keys.

    **Expected**: +n counts should be skipped during navigation.

expand all the groups, (the url querystring will reflect this) then reload the page

    **Expected**: groups should still be expanded for all resultsets

Optional: There are other variants that can be tested: classification of expanded job count members, Filters, and any other workflow integration testing.
