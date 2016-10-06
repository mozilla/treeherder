Initial page load
=======

Instruction
------
Load Treeherder. eg.

* [stage](https://treeherder.allizom.org)
* [production](https://treeherder.mozilla.org)

Depending on your test requirement.

    **Expected**: Page loads displaying resultsets pushed to mozilla-inbound.

Instruction
------
Treeherder logo > Perfherder

    **Expected**: Perfherder loads displaying its initial Graph page.

Instruction
------
Perfherder logo > Treeherder

    **Expected**: Treeherder loads again, displaying resultsets per step 1.

Check Job details Tab selection
=======

Instruction
------
Load Treeherder and select a completed/success job.

    **Expected**: The Job details tab should load by default.

Instruction
------
Select a completed/failed job.

    **Expected**: The Failure summary tab should load.

Instruction
------
Select a completed-success Talos job.

    **Expected**: The Performance tab should load.

Instruction
------
Select a completed-failed Talos job.

    **Expected**: The Failure summary tab should load.

Instruction
------
Select a Running job.

    **Expected**: The Failure summary tab should load.

Pin a job
=======

Instruction
------
Select a job, and click the 'pin' button in the lower navbar.

    **Expected**: Selected job pinned

Instruction
------
Select another job, and hit [spacebar]

    **Expected**: Selected job pinned

Instruction
------
Pinboard > Right hand menu dropdown > Clear all

    **Expected**: Both jobs are removed from the pinboard.

Failure summary tab
=======

Instruction
------
Select a classified or unclassified failed job.

    **Expected**: Ensure the Failure summary tab loads by default.

Instruction
------
If a Bug suggestion is present in the failure summary:

* Click on the bug description link
* Click on the bug pin icon

    **Expected**: * Bug description link should load the correct BMO bug in a new tab
* Pin should pin the job and add the bug to the bug classification field

Instruction
------
Pinboard > Right hand dropdown menu > Clear all
Similar jobs tab
=======

Instruction
------
Select a job, select the Similar jobs tab, wait several seconds.

    **Expected**: Recent jobs with matching symbols should load.

Instruction
------
Select a Similar job row.

    **Expected**: The adjacent panel should update with its job information.

Instruction
------
Scroll to the bottom of the Similar jobs tab, click 'Show previous jobs'.

    **Expected**: Additional, older jobs with matching symbols should load.

Job details pane
=======

Instruction
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
=======

Instruction
------
Select and pin 3 jobs to the pinboard, select a classification type, add a classification comment and add bug 1164485. Select 'Save' in the pinboard.

    **Expected**: The jobs show with an asterisk in the job table, green notification banners appear confirming successful classification for each job.

Instruction
------
Click Annotations tab.

    **Expected**: Ensure the same data appears in the panel.

Instruction
------
Annotations tab > delete the bug and classification for that job. Select the other two jobs and repeat.

    **Expected**: The jobs should be unclassified, annotations removed.

Instruction
------
Reload the page.

    **Expected**: The job should still be unclassified.

Switch repos
=======

Instruction
------
Click on the Repos menu, select a different repo.

    **Expected**: The new repo and its resultsets should load.

Instruction
------
Reverse the process, and switch back.

    **Expected**: The original repo and resultsets should load.

Toggle unclassified failures
=======

Instruction
------
Load Treeherder and click on the "(n) unclassified" button in the top navbar.

    **Expected**: Only unclassified failures should be visible in the job table.

Filters panel
=======

Instruction
------
Click and open the 'Filters' menu panel in the top navbar, and turn off several job types in the panel.

    **Expected**: Job types turned off are suppressed in the job table.

Instruction
------
Click on 'Reset' in the Filters panel.

    **Expected**: Filters UI should revert and suppressed jobs should reappear in the job table.

Instruction
------
Filters panel > Field Filters > click new. Add a new filter eg. Platform, Linux.

    **Expected**: Only Linux platforms should be visible in the job table.

Filter by Job details name and signature
=======

Instruction
------
Select any job and in the lower left panel, click on the Job: keywords eg. "Linux x64 asan Mochitest Chrome"

    **Expected**: Ensure only jobs containing those keywords are visible.

Instruction
------
Select any job and click on the adjacent "(sig)" signature link.

    **Expected**: Ensure only jobs using that unique signature SHA are visible.

Pin all visible jobs in resultset
=======

Instruction
------
Click on the Pin 'all' pin-icon in the right hand side of any resultset bar.

    **Expected**: Up to a maximum of 500 jobs should be pinned, and a matching notification warning should appear if exceeded.

Instruction
------
Click in the pinboard on the extreme right hand drop down menu, and select 'Clear all'.

    **Expected**: All jobs should be removed from the pinboard.

Login / Logout
=======

Instruction
------
Login via Persona.

    **Expected**: The login button should switch to a generic Persona avatar, and the user email should appear on hover.

Instruction
------
Logout

    **Expected**: The login button should switch back to "Login / Register".

View the Logviewer
=======

Instruction
------
Select any failed job and click the 'Log' icon in the lower navbar.

    **Expected**: The Logviewer loads in a new tab, and it contains correct job and revision information in the top left corner, and it preloads to the first failure line if one exists.

Instruction
------
Click on another failure line in the failed step.

    **Expected**: The log should scroll to that failure line.

Instruction
------
Click on 'show successful steps'.

    **Expected**: Green successful step bars should appear in the top right panel.

Instruction
------
Click on a successful step.

    **Expected**: The log contents should scroll to the -- Start -- line for that step.

Instruction
------
Thumbwheel/scroll/swipe downwards or upwards.

    **Expected**: The log should quickly load new chunks when encountering a log boundary.

Instruction
------
Click on the Raw Log link.

    **Expected**: The raw log for the same job should load in a new tab.

Instruction
------
Click all the available links in the result header, eg. "Inspect Task".

    **Expected**: Each should load correctly for that job.

Instruction
------
Select Treeherder from the nav menu.

    **Expected**: Treeherder should load in the same window.

View the raw log
=======

Instruction
------
Select any completed job and click the raw log button in the lower navbar.

    **Expected**: The raw log for that job should load in a new tab.

View resultsets by Author
=======

Instruction
------
Click on the Author email (eg. ryanvm@gmail.com) in a resultset bar.

    **Expected**: Only resultsets pushed by that Author should appear.

Instruction
------
Get next 10| resultsets via the main page footer.

    **Expected**: Only resultsets from that Author should be added.

View a single resultset
=======

Instruction
------
Load Treeherder and click on the 'Date' on the left side of any resultset.

    **Expected**: Only that resultset should load, with an accompanying URL param "&revision=(SHA)"

Instruction
------
(optional) Wait a minute or two for ingestion updates.

    **Expected**: Only newly started jobs for that same resultset (if any have occurred) should appear. No new resultsets should load.

Quick Filter input field
=======

Instruction
------
Click the 'Filter platforms & jobs' input field in the top navbar, aka. Quick Filter.

    **Expected**: Input field should expand in width for long input.

Instruction
------
Enter any text (eg. 'Android') and hit Enter

    **Expected**: Filter should be applied against the visible jobs and platform rows.

Instruction
------
Click the grey (x) 'Clear this filter' icon the right hand side of the input field, and hit Enter.

    **Expected**: Filter should be cleared and input should shrink to original width.

Check resultset actions menu
=======

Instruction
------
From any resultset bar, select each entry in the far right dropdown that doesn't involve retriggers. eg:

Bugherder,
BuildAPI,
Revision URL List

    **Expected**: Each should open without error or hanging.

Get next 10|20|50 resultsets
=======

Instruction
------
Click on Get next 10| resultsets.

    **Expected**: Ensure exactly 10 additional resultsets were loaded.

Instruction
------
Click on Get next 50| resultsets.

    **Expected**: Ensure the page has a reasonable load time of ~10 seconds.

Instruction
------
View a single resultset via its Date link. Click Get next 10| resultsets.

    **Expected**: Ensure the page loads the 10 prior resultsets and the "tochange" and "fromchange" in the url appear correct.

Filter resultsets by URL fromchange, tochange
=======
See also Treeherder [help](https://treeherder.mozilla.org/help.html) for URL Query String Parameters. Please test variants and perform exploratory testing as top/bottom of range is new functionality (Jun 3, 15')

Instruction
------
Navigate to the 2nd resultset loaded, from the resultset action menu select 'Set as top of range'.

    **Expected**: Ensure: (1) 1st resultset is omitted (2) url contains `&tochange=SHA` and (3) ten resultsets are loaded from that new top

Instruction
------
Navigate to the 3rd resultset loaded and select 'Set as bottom of range'

    **Expected**: Ensure (1) only the 3 ranged resultsets are loaded (2) url contains '&tochange=[top-SHA]&fromchange=[bottom-SHA]'

Instruction
------
Click Get Next | 10 in the page footer.

    **Expected**: Ensure 10 additional pages load for a total of 13 resultsets.

Instruction
------
(optional) wait a minute or two for job and resultset updates

    **Expected**: Updates should only occur for the visible resultsets. No new resultsets should appear.

Filter resultsets by URL date range
=======
See also Treeherder [help](https://treeherder.mozilla.org/userguide.html) for URL Query String Parameters

Instruction
------
Add a revision range to the URL in the format, eg:

&startdate=2015-09-28&enddate=2015-09-28

Warning: With the latest volume of jobs and resultsets, anything greater than a single day window risks loading too much data for the browser with Treeherder default filter and exclusion settings.

    **Expected**: Resultsets loaded should honor that range.

Instruction
------
(Optional) Wait for new pushes to that repo.

    **Expected**: Resultsets loaded should continue to honor that range.

Modify Exclusion Profiles in the Sheriff panel
=======

Instruction
------
Open the Sheriffing panel in the top navbar, and change the Default exclusion to any other exclusion profile (eg. Test, Tier-2), by clicking on Make Default. Close the panel and reload the page.

    **Expected**: Jobs present in that new profile should be excluded from the Job table, when the Show/Hide excluded job button is in its On (open square) state.

Show/Hide excluded jobs
=======

Instruction
------
Click the open rounded-square button in the top navbar to Show/Hide excluded jobs.

    **Expected**: Confirm that jobs currently in the default exclusion profile appear when the icon is solid white (on) and disappear when off. Those jobs range from some Tier-2 jobs, Autophone, and other jobs specified in the default Exclusion Profile UI.

Perfherder Graphs
=======

Instruction
------
Load Perfherder at eg.
https://treeherder.allizom.org/perf.html

    **Expected**: Landing page should appear.

Instruction
------
Click the blue 'Add test data' button, select a platform, enter a test series, and click Add+.

    **Expected**: Performance series should load with scatter graph and line graph.

Instruction
------
Click Add more test data, and add a 2nd series.

    **Expected**: The second series is drawn in an alternate color, and both series can have their displays disabled/enabled via Show/Hide series tick UI.

Instruction
------
Change display range dropdown to 90 days (or other value)

    **Expected**: Ensure both series expand to that date range. Confirm the data which has expired beyond the 6 week data cycle still appears, but the SHA just will instead display "loading revision".

No console errors throughout test run
=======
Ensure the browser console is error free during and after the test run.

Instruction
------
Open the console during the test run.

    **Expected**: No errors should appear in the console.

Perfherder Compare
=======

Instruction
------
Load Perfherder Compare at eg.
https://treeherder.allizom.org/perf.html#/comparechooser

    **Expected**: Landing page should appear.

Instruction
------
Select two push revisions from the 'Recent' dropdowns, and click 'Compare revisions'.

    **Expected**: Some kind of result should appear (likely a warning "tests with no results: " table).

Instruction
------
Click on the 'Substests' link for a row.

    **Expected**: Sub-compare results should appear.

Instruction
------
Click on the 'Graph' link for a sub-compare row if it exists.

    **Expected**: The plotted graph for that series should appear.

All keyboard shortcuts
=======
Note: Listed "Toggle in-progress" shortcut 'i' is known not to be working at this time.

Instruction
------
Check all keyboard shortcut functionality as listed in [help](https://treeherder.mozilla.org/help.html).

    **Expected**: Each shortcut should work as expected.

Job counts
=======

Instruction
------
In any resultset with job counts, click on the group button eg. B( ) to expand the count.

    **Expected**: Jobs should appear.

Instruction
------
Select an expanded job, and click again on the group button B() to collapse the count back down.

    **Expected**: The count should appear as a highlighted large button. eg. pending gray "+14"

Instruction
------
Click in empty space to deselect the collapsed job.

    **Expected**: The count "+14" should be deselected.

Instruction
------
Click on the ( + ) global Expand/Collapse icon in the navbar to toggle all +n counts.

    **Expected**: Counts should expand and collapse on all visible resultsets.

Instruction
------
Navigate via the n,p and left/right keys.

    **Expected**: +n counts should be skipped during navigation.

Instruction
------
expand all the groups, (the url querystring will reflect this) then reload the page

    **Expected**: groups should still be expanded for all resultsets

Instruction
------
Optional: There are other variants that can be tested: classification of expanded job count members, Filters, and any other workflow integration testing.
Initial page load
=======
0. Load Treeherder. eg.

* [stage](https://treeherder.allizom.org)
* [production](https://treeherder.mozilla.org)

Depending on your test requirement.
    **Expected**: Page loads displaying resultsets pushed to mozilla-inbound.

1. Treeherder logo > Perfherder
    **Expected**: Perfherder loads displaying its initial Graph page.

2. Perfherder logo > Treeherder
    **Expected**: Treeherder loads again, displaying resultsets per step 1.

Check Job details Tab selection
=======
0. Load Treeherder and select a completed/success job.
    **Expected**: The Job details tab should load by default.

1. Select a completed/failed job.
    **Expected**: The Failure summary tab should load.

2. Select a completed-success Talos job.
    **Expected**: The Performance tab should load.

3. Select a completed-failed Talos job.
    **Expected**: The Failure summary tab should load.

4. Select a Running job.
    **Expected**: The Failure summary tab should load.

Pin a job
=======
0. Select a job, and click the 'pin' button in the lower navbar.
    **Expected**: Selected job pinned

1. Select another job, and hit [spacebar]
    **Expected**: Selected job pinned

2. Pinboard > Right hand menu dropdown > Clear all
    **Expected**: Both jobs are removed from the pinboard.

Failure summary tab
=======
0. Select a classified or unclassified failed job.
    **Expected**: Ensure the Failure summary tab loads by default.

1. If a Bug suggestion is present in the failure summary:

* Click on the bug description link
* Click on the bug pin icon
    **Expected**: * Bug description link should load the correct BMO bug in a new tab
* Pin should pin the job and add the bug to the bug classification field

2. Pinboard > Right hand dropdown menu > Clear all
Similar jobs tab
=======
0. Select a job, select the Similar jobs tab, wait several seconds.
    **Expected**: Recent jobs with matching symbols should load.

1. Select a Similar job row.
    **Expected**: The adjacent panel should update with its job information.

2. Scroll to the bottom of the Similar jobs tab, click 'Show previous jobs'.
    **Expected**: Additional, older jobs with matching symbols should load.

Job details pane
=======
0. Select any job and confirm the following loads in the bottom left pane:

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
=======
0. Select and pin 3 jobs to the pinboard, select a classification type, add a classification comment and add bug 1164485. Select 'Save' in the pinboard.
    **Expected**: The jobs show with an asterisk in the job table, green notification banners appear confirming successful classification for each job.

1. Click Annotations tab.
    **Expected**: Ensure the same data appears in the panel.

2. Annotations tab > delete the bug and classification for that job. Select the other two jobs and repeat.
    **Expected**: The jobs should be unclassified, annotations removed.

3. Reload the page.
    **Expected**: The job should still be unclassified.

Switch repos
=======
0. Click on the Repos menu, select a different repo.
    **Expected**: The new repo and its resultsets should load.

1. Reverse the process, and switch back.
    **Expected**: The original repo and resultsets should load.

Toggle unclassified failures
=======
0. Load Treeherder and click on the "(n) unclassified" button in the top navbar.
    **Expected**: Only unclassified failures should be visible in the job table.

Filters panel
=======
0. Click and open the 'Filters' menu panel in the top navbar, and turn off several job types in the panel.
    **Expected**: Job types turned off are suppressed in the job table.

1. Click on 'Reset' in the Filters panel.
    **Expected**: Filters UI should revert and suppressed jobs should reappear in the job table.

2. Filters panel > Field Filters > click new. Add a new filter eg. Platform, Linux.
    **Expected**: Only Linux platforms should be visible in the job table.

Filter by Job details name and signature
=======
0. Select any job and in the lower left panel, click on the Job: keywords eg. "Linux x64 asan Mochitest Chrome"
    **Expected**: Ensure only jobs containing those keywords are visible.

1. Select any job and click on the adjacent "(sig)" signature link.
    **Expected**: Ensure only jobs using that unique signature SHA are visible.

Pin all visible jobs in resultset
=======
0. Click on the Pin 'all' pin-icon in the right hand side of any resultset bar.
    **Expected**: Up to a maximum of 500 jobs should be pinned, and a matching notification warning should appear if exceeded.

1. Click in the pinboard on the extreme right hand drop down menu, and select 'Clear all'.
    **Expected**: All jobs should be removed from the pinboard.

Login / Logout
=======
0. Login via Persona.
    **Expected**: The login button should switch to a generic Persona avatar, and the user email should appear on hover.

1. Logout
    **Expected**: The login button should switch back to "Login / Register".

View the Logviewer
=======
0. Select any failed job and click the 'Log' icon in the lower navbar.
    **Expected**: The Logviewer loads in a new tab, and it contains correct job and revision information in the top left corner, and it preloads to the first failure line if one exists.

1. Click on another failure line in the failed step.
    **Expected**: The log should scroll to that failure line.

2. Click on 'show successful steps'.
    **Expected**: Green successful step bars should appear in the top right panel.

3. Click on a successful step.
    **Expected**: The log contents should scroll to the -- Start -- line for that step.

4. Thumbwheel/scroll/swipe downwards or upwards.
    **Expected**: The log should quickly load new chunks when encountering a log boundary.

5. Click on the Raw Log link.
    **Expected**: The raw log for the same job should load in a new tab.

6. Click all the available links in the result header, eg. "Inspect Task".
    **Expected**: Each should load correctly for that job.

7. Select Treeherder from the nav menu.
    **Expected**: Treeherder should load in the same window.

View the raw log
=======
0. Select any completed job and click the raw log button in the lower navbar.
    **Expected**: The raw log for that job should load in a new tab.

View resultsets by Author
=======
0. Click on the Author email (eg. ryanvm@gmail.com) in a resultset bar.
    **Expected**: Only resultsets pushed by that Author should appear.

1. Get next 10| resultsets via the main page footer.
    **Expected**: Only resultsets from that Author should be added.

View a single resultset
=======
0. Load Treeherder and click on the 'Date' on the left side of any resultset.
    **Expected**: Only that resultset should load, with an accompanying URL param "&revision=(SHA)"

1. (optional) Wait a minute or two for ingestion updates.
    **Expected**: Only newly started jobs for that same resultset (if any have occurred) should appear. No new resultsets should load.

Quick Filter input field
=======
0. Click the 'Filter platforms & jobs' input field in the top navbar, aka. Quick Filter.
    **Expected**: Input field should expand in width for long input.

1. Enter any text (eg. 'Android') and hit Enter
    **Expected**: Filter should be applied against the visible jobs and platform rows.

2. Click the grey (x) 'Clear this filter' icon the right hand side of the input field, and hit Enter.
    **Expected**: Filter should be cleared and input should shrink to original width.

Check resultset actions menu
=======
0. From any resultset bar, select each entry in the far right dropdown that doesn't involve retriggers. eg:

Bugherder,
BuildAPI,
Revision URL List
    **Expected**: Each should open without error or hanging.

Get next 10|20|50 resultsets
=======
0. Click on Get next 10| resultsets.
    **Expected**: Ensure exactly 10 additional resultsets were loaded.

1. Click on Get next 50| resultsets.
    **Expected**: Ensure the page has a reasonable load time of ~10 seconds.

2. View a single resultset via its Date link. Click Get next 10| resultsets.
    **Expected**: Ensure the page loads the 10 prior resultsets and the "tochange" and "fromchange" in the url appear correct.

Filter resultsets by URL fromchange, tochange
=======
See also Treeherder [help](https://treeherder.mozilla.org/help.html) for URL Query String Parameters. Please test variants and perform exploratory testing as top/bottom of range is new functionality (Jun 3, 15')
0. Navigate to the 2nd resultset loaded, from the resultset action menu select 'Set as top of range'.
    **Expected**: Ensure: (1) 1st resultset is omitted (2) url contains `&tochange=SHA` and (3) ten resultsets are loaded from that new top

1. Navigate to the 3rd resultset loaded and select 'Set as bottom of range'
    **Expected**: Ensure (1) only the 3 ranged resultsets are loaded (2) url contains '&tochange=[top-SHA]&fromchange=[bottom-SHA]'

2. Click Get Next | 10 in the page footer.
    **Expected**: Ensure 10 additional pages load for a total of 13 resultsets.

3. (optional) wait a minute or two for job and resultset updates
    **Expected**: Updates should only occur for the visible resultsets. No new resultsets should appear.

Filter resultsets by URL date range
=======
See also Treeherder [help](https://treeherder.mozilla.org/userguide.html) for URL Query String Parameters
0. Add a revision range to the URL in the format, eg:

&startdate=2015-09-28&enddate=2015-09-28

Warning: With the latest volume of jobs and resultsets, anything greater than a single day window risks loading too much data for the browser with Treeherder default filter and exclusion settings.
    **Expected**: Resultsets loaded should honor that range.

1. (Optional) Wait for new pushes to that repo.
    **Expected**: Resultsets loaded should continue to honor that range.

Modify Exclusion Profiles in the Sheriff panel
=======
0. Open the Sheriffing panel in the top navbar, and change the Default exclusion to any other exclusion profile (eg. Test, Tier-2), by clicking on Make Default. Close the panel and reload the page.
    **Expected**: Jobs present in that new profile should be excluded from the Job table, when the Show/Hide excluded job button is in its On (open square) state.

Show/Hide excluded jobs
=======
0. Click the open rounded-square button in the top navbar to Show/Hide excluded jobs.
    **Expected**: Confirm that jobs currently in the default exclusion profile appear when the icon is solid white (on) and disappear when off. Those jobs range from some Tier-2 jobs, Autophone, and other jobs specified in the default Exclusion Profile UI.

Perfherder Graphs
=======
0. Load Perfherder at eg.
https://treeherder.allizom.org/perf.html
    **Expected**: Landing page should appear.

1. Click the blue 'Add test data' button, select a platform, enter a test series, and click Add+.
    **Expected**: Performance series should load with scatter graph and line graph.

2. Click Add more test data, and add a 2nd series.
    **Expected**: The second series is drawn in an alternate color, and both series can have their displays disabled/enabled via Show/Hide series tick UI.

3. Change display range dropdown to 90 days (or other value)
    **Expected**: Ensure both series expand to that date range. Confirm the data which has expired beyond the 6 week data cycle still appears, but the SHA just will instead display "loading revision".

No console errors throughout test run
=======
Ensure the browser console is error free during and after the test run.
0. Open the console during the test run.
    **Expected**: No errors should appear in the console.

Perfherder Compare
=======
0. Load Perfherder Compare at eg.
https://treeherder.allizom.org/perf.html#/comparechooser
    **Expected**: Landing page should appear.

1. Select two push revisions from the 'Recent' dropdowns, and click 'Compare revisions'.
    **Expected**: Some kind of result should appear (likely a warning "tests with no results: " table).

2. Click on the 'Substests' link for a row.
    **Expected**: Sub-compare results should appear.

3. Click on the 'Graph' link for a sub-compare row if it exists.
    **Expected**: The plotted graph for that series should appear.

All keyboard shortcuts
=======
Note: Listed "Toggle in-progress" shortcut 'i' is known not to be working at this time.
0. Check all keyboard shortcut functionality as listed in [help](https://treeherder.mozilla.org/help.html).
    **Expected**: Each shortcut should work as expected.

Job counts
=======
0. In any resultset with job counts, click on the group button eg. B( ) to expand the count.
    **Expected**: Jobs should appear.

1. Select an expanded job, and click again on the group button B() to collapse the count back down.
    **Expected**: The count should appear as a highlighted large button. eg. pending gray "+14"

2. Click in empty space to deselect the collapsed job.
    **Expected**: The count "+14" should be deselected.

3. Click on the ( + ) global Expand/Collapse icon in the navbar to toggle all +n counts.
    **Expected**: Counts should expand and collapse on all visible resultsets.

4. Navigate via the n,p and left/right keys.
    **Expected**: +n counts should be skipped during navigation.

5. expand all the groups, (the url querystring will reflect this) then reload the page
    **Expected**: groups should still be expanded for all resultsets

6. Optional: There are other variants that can be tested: classification of expanded job count members, Filters, and any other workflow integration testing.
