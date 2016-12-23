'use strict';

/* Directives */
treeherder.directive('thCloneJobs', [
    '$rootScope', '$http', 'ThLog', 'thUrl', 'thCloneHtml',
    'thServiceDomain', 'thResultStatusInfo', 'thEvents', 'thAggregateIds',
    'thJobFilters', 'thResultStatusObject', 'ThResultSetStore',
    'ThJobModel', 'linkifyBugsFilter', 'thResultStatus', 'thPlatformName',
    'thNotify', '$timeout', '$compile',
    function(
        $rootScope, $http, ThLog, thUrl, thCloneHtml,
        thServiceDomain, thResultStatusInfo, thEvents, thAggregateIds,
        thJobFilters, thResultStatusObject, ThResultSetStore,
        ThJobModel, linkifyBugsFilter, thResultStatus, thPlatformName,
        thNotify, $timeout, $compile){

        var $log = new ThLog("thCloneJobs");

        // CSS classes
        var btnCls = 'btn-xs';
        var selectedBtnCls = 'selected-job';
        var selectedCountCls = 'selected-count';
        var largeBtnCls = 'btn-lg-xform';

        var col5Cls = 'col-xs-5';
        var col7Cls = 'col-xs-7';
        var col12Cls = 'col-xs-12';
        var jobListNoPadCls = 'job-list-nopad';
        var jobListPadCls = 'job-list-pad';

        var viewContentSel = ".th-view-content";

        var failResults = ["testfailed", "busted", "exception"];

        // Custom Attributes
        var jobKeyAttr = 'data-jmkey';
        var runnableJobBuildernameAttr = 'data-buildername';
        var groupKeyAttr = 'data-grkey';

        var tableInterpolator = thCloneHtml.get('resultsetClone').interpolator;

        //Retrieve platform interpolator
        var platformInterpolator = thCloneHtml.get('platformClone').interpolator;

        //Instantiate job group interpolator
        var jobGroupInterpolator = thCloneHtml.get('jobGroupClone').interpolator;

        //Instantiate job group count interpolator
        var jobGroupCountInterpolator = thCloneHtml.get('jobGroupCountClone').interpolator;

        //Instantiate job btn interpolator
        var jobBtnInterpolator = thCloneHtml.get('jobBtnClone').interpolator;

        //Instantiate job btn interpolator
        var runnableJobBtnInterpolator = thCloneHtml.get('runnableJobBtnClone').interpolator;

        var getJobMapKey = function(job){
            return 'key' + job.id;
        };

        var getHoverText = function(job) {
            var hoverText = job.job_type_name + " - " + thResultStatus(job);
            if (job.state === 'completed') {
                var duration = Math.round((job.end_timestamp - job.start_timestamp) / 60);
                hoverText += " (" + duration + " mins)";
            }
            return hoverText;
        };

        //Global event listeners
        $rootScope.$on(
            thEvents.changeSelection, function(ev, direction, jobNavSelector){

                var jobMap = ThResultSetStore.getJobMap($rootScope.repoName);
                var el, key, jobs, getIndex;

                if (direction === 'next') {
                    getIndex = function(idx, jobs) {
                        return idx+1 > _.size(jobs)-1 ? 0: idx+1;
                    };
                } else if (direction === 'previous') {
                    getIndex = function(idx, jobs) {
                        return idx-1 < 0 ? _.size(jobs)-1 : idx-1;
                    };
                }

                // Filter the list of possible jobs down to ONLY ones in the .th-view-content
                // div (excluding pinboard) and then to the specific selector passed
                // in.  And then to only VISIBLE (not filtered away) jobs.  The exception
                // is for the .selected-job.  If that's not visible, we still want to
                // include it, because it is the anchor from which we find
                // the next/previous job.
                //
                // The .selected-job can be invisible, for instance, when filtered to
                // unclassified failures only, and you then classify the selected job.
                // It's still selected, but no longer visible.
                jobs = $(viewContentSel).find(jobNavSelector.selector).filter(":visible, .selected-job, .selected-count");
                if (jobs.length) {
                    var selIdx = jobs.index(jobs.filter(".selected-job, .selected-count").first());
                    var idx = getIndex(selIdx, jobs);

                    el = $(jobs[idx]);
                    key = el.attr(jobKeyAttr);
                    if (jobMap && jobMap[key] && selIdx !== idx) {
                        selectJob(jobMap[key].job_obj);
                        return;
                    }
                }
                // if there was no new job selected, then ensure that we clear any job that
                // was previously selected.
                $timeout(function() {
                    if ($(".selected-job").css('display') === 'none') {
                        $rootScope.closeJob();
                    }
                    thNotify.send("No " + jobNavSelector.name + " to select", "warning");
                }, 0);
            });

        $rootScope.$on(thEvents.selectJob, function(ev, job, job_selection_type) {
            selectJob(job, job_selection_type);
        });

        $rootScope.$on(thEvents.clearSelectedJob, function() {
            clearSelectJobStyles();
        });

        /**
         * Sets the styling for the selected job and sets the selectedJob
         * in ThResultSetStore
         */
        var selectJob = function(job, job_selection_type) {
            var jobKey = getJobMapKey(job);
            var jobEl = $('.' + jobKey);
            clickJobCb({}, jobEl, job, job_selection_type);
            scrollToElement(jobEl);

            ThResultSetStore.setSelectedJob($rootScope.repoName, job);
        };

        var setSelectJobStyles = function(el){
            // clear the styles from the previously selected job, if any.
            clearSelectJobStyles();

            el.removeClass(btnCls);
            el.addClass(largeBtnCls);
            el.addClass(selectedBtnCls);
        };

        var clearSelectJobStyles = function() {
            var lastJobSelected = ThResultSetStore.getSelectedJob(
                $rootScope.repoName);
            if (!_.isEmpty(lastJobSelected.job)) {
                var el = $('.' + getJobMapKey(lastJobSelected.job));
                if (!_.isEmpty(el) && !(typeof el === 'string')) {
                    el.removeClass(selectedBtnCls);
                    el.removeClass(largeBtnCls);
                    el.addClass(btnCls);
                }
            }

            // if a job was previously selected that is now inside a count,
            // then the count will have the ``.selected-count`` class.  Since
            // we are now selecting a job, we need to remove that class from the
            // count.
            var selectedCount = $(viewContentSel).find("."+selectedCountCls);
            if (selectedCount.length) {
                selectedCount.removeClass(selectedCountCls);
                selectedCount.removeClass(largeBtnCls);
            }
        };

        var broadcastJobChangedTimeout = null;
        var clickJobCb = function(ev, el, job, job_selection_type){
            setSelectJobStyles(el);
            // delay switching right away, in case the user is switching rapidly
            // between jobs
            if (broadcastJobChangedTimeout) {
                window.clearTimeout(broadcastJobChangedTimeout);
            }
            broadcastJobChangedTimeout = window.setTimeout(function() {
                $rootScope.$emit(thEvents.jobClick, job, job_selection_type);
            }, 200);
        };

        /**
         * Clicking a group will expand or collapse it.  Expanded shows all
         * jobs.  Collapsed shows counts and failed jobs.
         */
        var clickGroupCb = function(el) {
            var clickedEl = $(el);
            if (clickedEl.hasClass('group-symbol') || clickedEl.hasClass('job-group-count')) {
                var groupMap = ThResultSetStore.getGroupMap($rootScope.repoName);
                var gi = getGroupInfo(el, groupMap);
                if (gi) {
                    gi.jgObj.jobs.forEach(function(job) {
                        // Keep track of visibility with this property. This
                        // way down stream job consumers don't need to repeatedly
                        // call showJob
                        job.visible = filterWithRunnable(job);
                    });
                    gi.grpCountList.hide();
                    gi.grpJobList.hide();
                    if (isGroupExpanded(gi.jgObj)) {
                        gi.jgObj.groupState = "collapsed";
                        addGroupJobsAndCounts(gi.jgObj, gi.platformGroupEl);
                    } else {
                        gi.jgObj.groupState = "expanded";
                        gi.grpCountList.empty();
                        gi.grpJobList.html(renderJobBtnEls(gi.jgObj));
                    }
                    gi.grpJobList.fadeIn();
                    gi.grpCountList.fadeIn();
                }
            }
        };

        var clickRunnableJobCb = function(el, resultset_id) {
            var buildername = el.attr(runnableJobBuildernameAttr);
            ThResultSetStore.toggleSelectedRunnableJob($rootScope.repoName, resultset_id, buildername);
            el.toggleClass("runnable-job-btn-selected");
        };

        var togglePinJobCb = function(ev, el, job){
            $rootScope.$emit(thEvents.toggleJobPin, job);
        };

        var filterWithRunnable = function(job) {
            var visible = thJobFilters.showJob(job);
            if (job.state === "runnable") {
                var rsMap = ThResultSetStore.getResultSetsMap($rootScope.repoName);
                visible = visible && rsMap[job.result_set_id].rs_obj.isRunnableVisible;
            }
            return visible;
        };

        var renderJobBtnEls = function(jgObj) {
            var lastJobSelected = ThResultSetStore.getSelectedJob($rootScope.repoName);
            var job, l;
            var jobBtnArray = [];

            for (l=0; l<jgObj.jobs.length; l++){

                job = jgObj.jobs[l];

                addJobBtnToArray(job, lastJobSelected, jobBtnArray);
            }
            return jobBtnArray;
        };

        var getJobBtnEls = function(jgObj) {
            var jobBtnArray = renderJobBtnEls(jgObj);
            var jobBtnHTML = "";
            jobBtnArray.forEach(function(element) {
                jobBtnHTML += element;
            });
            return jobBtnHTML;
        };

        /**
         * Decide what the job should look like as a button and add it to the
         * array that's passed in.
         */
        var addJobBtnToArray = function(job, lastJobSelected, jobBtnArray) {
            var jobStatus, jobBtn;

            jobStatus = thResultStatusInfo(thResultStatus(job), job.failure_classification_id);
            jobStatus.key = getJobMapKey(job);
            jobStatus.value = job.job_type_symbol;
            jobStatus.title = getHoverText(job);
            jobStatus.extraClasses = "";
            jobStatus.extraClasses += job.visible ? " filter-shown" : "";
            if ( !_.isEmpty(lastJobSelected.job) &&
                (lastJobSelected.job.id === job.id)){
                jobStatus.extraClasses += " " + largeBtnCls + " " + selectedBtnCls;
            } else {
                jobStatus.extraClasses += " " + btnCls;
            }
            if (thResultStatus(job) === "runnable") {
                jobStatus.buildername = job.ref_data_name;
                if (ThResultSetStore.isRunnableJobSelected($rootScope.repoName,
                                                           job.result_set_id,
                                                           jobStatus.buildername)) {
                    jobStatus.extraClasses += " runnable-job-btn-selected";
                }
                jobBtn = runnableJobBtnInterpolator(jobStatus);
            } else {
                jobBtn = jobBtnInterpolator(jobStatus);
            }
            jobBtnArray.push(jobBtn);
            // add a zero-width space between spans so they can wrap
            jobBtnArray.push(' ');
        };

        var getGroupInfo = function(el, groupMap) {
            var gi = {};
            try {
                gi.platformGroupEl = $(el).closest(".platform-group");
                gi.grpJobList = gi.platformGroupEl.find(".group-job-list");
                gi.grpCountList = gi.platformGroupEl.find(".group-count-list");
                gi.key = gi.platformGroupEl.find(".job-group").attr(groupKeyAttr);
                gi.jgObj = groupMap[gi.key].grp_obj;
                return gi;
            } catch (TypeError) {
                return null;
            }
        };

        /**
         * Group non-failed jobs as '+n' counts in the UI by default,
         * and failed jobs as individual buttons.
         * Each job receives a corresponding resultState which determines its
         * display.
         */
        var renderGroupJobsAndCounts = function(jgObj) {
            var jobCountBtnArray = [];
            var jobBtnArray = [];
            var stateCounts = {};
            var lastJobSelected = ThResultSetStore.getSelectedJob($rootScope.repoName);
            var typeSymbolCounts = _.countBy(jgObj.jobs, "job_type_symbol");

            _.forEach(jgObj.jobs, function(job) {

                // Set the resultState
                var resultStatus = thResultStatus(job);
                var countInfo = thResultStatusInfo(resultStatus,
                                                job.failure_classification_id);

                // Even if a job is not visible, add it to the DOM as hidden.  This is
                // important because it can still be "selected" when not visible
                // or filtered out (like in the case of unclassified failures).
                //
                // We don't add it to group counts, because it should not be counted
                // when filtered out and duplicate jobs are being shown.
                // Failures don't get included in counts anyway.
                if (_.contains(failResults, resultStatus) ||
                        (typeSymbolCounts[job.job_type_symbol] > 1 && $scope.showDuplicateJobs)) {
                    // render the job itself, not a count
                    addJobBtnToArray(job, lastJobSelected, jobBtnArray);
                } else if (job.visible) {
                    _.extend(countInfo, stateCounts[countInfo.btnClass]);
                    if (!_.isEmpty(lastJobSelected.job) &&
                        (lastJobSelected.job.id === job.id)) {
                        // these classes are applied in the interpolator
                        // to designate this count as having one of its
                        // jobs selected.
                        countInfo.selectedClasses = selectedCountCls + " " + largeBtnCls;
                    }

                    countInfo.count = _.get(
                        _.get(stateCounts, countInfo.btnClass, countInfo), "count", 0) + 1;
                    // keep a reference to the job.  If there ends up being
                    // only one for this status, then just add the job itself
                    // rather than a count.
                    countInfo.lastJob = job;
                    stateCounts[countInfo.btnClass] = countInfo;
                }
            });

            _.forEach(stateCounts, function(countInfo) {
                if (countInfo.count === 1) {
                    // if there is only 1 job for this status, then just add
                    // the job, rather than the count
                    addJobBtnToArray(countInfo.lastJob, lastJobSelected, jobBtnArray);
                } else {
                    // with more than 1 job for the status, add it as a count
                    jobCountBtnArray.push(jobGroupCountInterpolator({
                        value: countInfo.count,
                        title: countInfo.count + " " + countInfo.countText + " jobs in group",
                        btnClass: countInfo.btnClass + "-count",
                        visibleClass: "filter-shown",
                        selectedClasses: countInfo.selectedClasses
                    }));
                    jobCountBtnArray.push(' ');
                }
            });
            return {
                jobBtnArray: jobBtnArray,
                jobCountBtnArray: jobCountBtnArray
            };
        };

        var addGroupJobsAndCounts = function(jgObj, platformGroup) {
            var btnArrays = renderGroupJobsAndCounts(jgObj);
            var jobBtnArray = btnArrays.jobBtnArray;
            var jobCountBtnArray = btnArrays.jobCountBtnArray;
            platformGroup.find(".group-job-list").html(jobBtnArray);
            platformGroup.find(".group-count-list").html(jobCountBtnArray);
        };

        /**
         * When a job is clicked
         */
        var jobClick = function(resultset, ev){
            var el = $(ev.target);

            // return in case 'mousedown' was fired and target was clickable
            // (so we don't handle two events)
            if (ev.type === 'mousedown' && ev.which === 1 &&
                el.is(":button")) {
                return false;
            }

            var key = el.attr(jobKeyAttr);
            var buildername = el.attr(runnableJobBuildernameAttr);
            //Confirm user selected a job
            if (buildername) {
                _.bind(clickRunnableJobCb, this, el, resultset.id)();
            } else if (key && !_.isEmpty(this.job_map[key])) {

                var job = this.job_map[key].job_obj;

                job.revision = resultset.revision;
                //NOTE: scope is set to "this" by _.bind
                switch (ev.which) {
                    case 1:
                        //Left mouse button pressed
                        if (ev.ctrlKey || ev.metaKey) {
                            _.bind(togglePinJobCb, this, ev, el, job)();
                        } else {
                            _.bind(clickJobCb, this, ev, el, job)();
                        }

                        break;

                    case 2:
                        //Middle mouse button pressed
                        ThJobModel.get(this.repoName, job.id).then(function(data){
                            // Open the logviewer in a new window
                            if (data.logs.length > 0) {
                                window.open(location.origin + "/" + thUrl.getLogViewerUrl(job.id));
                            }
                        });

                        break;
                    case 3:
                        //Right mouse button pressed
                        break;
                    default:
                        //strange mouse detected
                        _.bind(clickJobCb, this, ev, el, job)();
                }

                ThResultSetStore.setSelectedJob($rootScope.repoName, job);

            } else {
                _.bind(clickGroupCb, this, el)();
            }
        };

        /**
         * Add the list of revisions to the resultset
         */
        var addRevisions = function(scope, element){

            if (scope.resultset.revisions.length > 0){

                var ulEl = element.find('.revision-list');

                _.extend(scope, { repo: $rootScope.currentRepo });
                var revisionList = $compile('<revisions watch-depth="reference" resultset="resultset" repo="repo"></revisions>')(scope);
                $(ulEl).replaceWith(revisionList);

            }
        };

        /**
         * Toggle the visibility of the list of revisions
         */
        var toggleRevisions = function(element, expand) {

            var revisionsEl = element.find('ul').parent();
            var jobsEl = element.find('table').parent();

            var revElDisplayState = revisionsEl.css('display') || 'block';
            var jobsElDisplayState = jobsEl.css('display') || 'block';

            var on = revElDisplayState !== 'block';
            if (!_.isUndefined(expand)) {
                on = expand;
            }

            var rowEl = revisionsEl.parent();
            rowEl.css('display', 'block');

            if (on) {

                ThResultSetStore.loadRevisions(
                    $rootScope.repoName, this.resultset.id
                );

                if (jobsElDisplayState === 'block') {
                    toggleRevisionsSpanOnWithJobs(revisionsEl);
                    //Make sure the jobs span has correct styles
                    toggleJobsSpanOnWithRevisions(jobsEl);
                }

            } else {
                toggleRevisionsSpanOff(revisionsEl);
                toggleJobsSpanOnWithoutRevisions(jobsEl);
            }

        };

        var toggleRevisionsSpanOnWithJobs = function(el) {
            el.css('display', 'block');
            el.addClass(col5Cls);
        };
        var toggleRevisionsSpanOff = function(el) {
            el.css('display', 'none');
            el.removeClass(col5Cls);
        };
        var toggleJobsSpanOnWithRevisions = function(el) {
            el.css('display', 'block');
            el.removeClass(jobListNoPadCls);
            el.removeClass(col12Cls);
            el.addClass(col7Cls);
            el.addClass(jobListPadCls);
        };
        var toggleJobsSpanOnWithoutRevisions = function(el) {
            el.css('display', 'block');
            el.removeClass(col7Cls);
            el.removeClass(jobListPadCls);
            el.addClass(jobListNoPadCls);
            el.addClass(col12Cls);
        };

        /**
         * Initial rendering of a Platform row on page load
         */
        var getJobTableRowHTML = function(jobGroups) {
            //Empty the job column before populating it
            var btnHTML = "", countBtnHTML = "", jobTdHtml = "";
            jobGroups.forEach(function(jobGroup) {
                if (jobGroup.symbol !== '?') {
                    // Job group detected, add job group symbols
                    if (isGroupExpanded(jobGroup)) {
                        btnHTML = getJobBtnEls(jobGroup);
                    } else {
                        var btnArrays = renderGroupJobsAndCounts(jobGroup);
                        btnHTML = "";
                        // put individual jobs first
                        btnArrays.jobBtnArray.forEach(function(element) {
                            btnHTML += element;
                        });
                        countBtnHTML = "";
                        // put counts after individual jobs
                        btnArrays.jobCountBtnArray.forEach(function(element) {
                            countBtnHTML += element;
                        });
                    }
                    jobTdHtml += jobGroupInterpolator({
                        btnHTML: btnHTML,
                        countBtnHTML: countBtnHTML,
                        symbol: jobGroup.symbol,
                        tier: jobGroup.tier,
                        name: jobGroup.name,
                        grkey: jobGroup.grkey,
                        display: (btnHTML.indexOf('filter-shown') !== -1 || countBtnHTML.indexOf('filter-shown') !== -1) ? 'inline' : 'none'
                    });
                } else {
                    // Add the job btn spans
                    jobTdHtml += getJobBtnEls(jobGroup);
                }
            });
            return jobTdHtml;
        };

        /**
         * Update all platforms for a resultset when job updates come in.
         */
        var renderJobTableRow = function(row, jobTdEl, jobGroups) {
            jobTdEl.html(getJobTableRowHTML(jobGroups));
            row.append(jobTdEl);
            filterPlatform(row);
        };

        /**
         * Called when filters are changed after the page has loaded
         */
        var filterJobs = function(element){
            $log.debug("filterJobs", element);

            if (this.resultset.platforms === undefined){
                return;
            }

            var job, jmKey, show;
            var jobMap = ThResultSetStore.getJobMap($rootScope.repoName);

            element.find('.job-list .job-btn, .job-list .runnable-job-btn').each(
                function internalFilterJob() {
                    // using jquery to do these things was quite a bit slower,
                    // so just using raw JS for speed.
                    jmKey = this.dataset.jmkey;
                    job = jobMap[jmKey].job_obj;
                    show = filterWithRunnable(job);
                    job.visible = show;
                    showHideElement($(this), show);
                });

            renderGroups(element, false);

            // hide platforms and groups where all jobs are hidden
            element.find(".platform").each(function internalFilterPlatform() {
                var platform = $(this.parentNode);
                filterPlatform(platform);
            });

        };

        var isGroupExpanded = function(group) {
            var singleGroupState = group.groupState || $scope.groupState;
            return singleGroupState === "expanded";
        };

        /**
         * Called when either filters are changed, or the setting for counts
         * or dup job display is changed.
         *
         * Render all the job groups for a resultset.  Make decisions on whether
         * to render all the jobs in the group, or to collapse them as counts.
         *
         * If ``resetGroupState`` is set to true, then clear the ``groupState``
         * for each group that may have been set when a user clicked on it.
         * If false, then honor the choice to expand or collapse an individual
         * group and ignore the global setting.
         *
         * @param element The resultset for which to render the groups.
         * @param resetGroupState Whether to reset groups individual expanded
         *                        or collapsed states.
         */
        var renderGroups = function(element, resetGroupState) {
            var groupMap = ThResultSetStore.getGroupMap($rootScope.repoName);
            // with items in the group, it's not as simple as just hiding or
            // showing a job or count.  Since there can be lots of criteria for whether to show
            // or hide a job, and any job hidden or shown will change the counts,
            // the counts must be re-created each time.
            element.find(".group-job-list").each(function internalFilterGroup(idx, el) {
                var gi = getGroupInfo(el, groupMap);
                gi.grpJobList.empty();
                gi.grpCountList.empty();

                if (resetGroupState) {
                    delete gi.jgObj.groupState;
                }
                gi.jgObj.jobs.forEach(function(job) {
                    // Keep track of visibility with this property. This
                    // way down stream job consumers don't need to repeatedly
                    // call showJob
                    job.visible = filterWithRunnable(job);
                });
                if (isGroupExpanded(gi.jgObj)) {
                    gi.platformGroupEl.find(".group-job-list").append(renderJobBtnEls(gi.jgObj));
                } else {
                    addGroupJobsAndCounts(gi.jgObj, gi.platformGroupEl);
                }
            });
        };

        /**
         * Can be used to show/hide a job or a count of jobs
         */
        var showHideElement = function(el, show) {
            // Note: I was using
            //     jobEl.style.display = "inline";
            //     jobEl.className += " filter-shown";
            // but the classname setting didn't work reliably with the jquery selectors
            // when it came to hiding/showing platforms and groups.  Jquery
            // couldn't detect that I'd added or removed ``filter-shown`` in
            // all cases.  So, while this is a bit slower, it's reliable.
            //
            // It would be great to be able to do this without adding/removing a class
            if (show) {
                el[0].classList.add("filter-shown");
            } else {
                el[0].classList.remove("filter-shown");
            }
        };

        /**
         * Decide whether or not a platform row should be shown based on
         * whether or not it has any visible jobs
         */
        var filterPlatform = function(platform) {
            var showPlt = platform.find('.job-row .filter-shown').length !== 0;
            var showGrp;

            if (showPlt) {
                platform[0].style.display ="table-row";
                platform.find(".platform-group").each(function internalFilterGroup() {
                    var grp = $(this);
                    showGrp = grp.find('.group-job-list .filter-shown, .group-count-list .filter-shown').length !== 0;
                    grp[0].style.display = showGrp ? "inline" : "none";
                });

            } else {
                platform[0].style.display = "none";
            }
        };

        /**
         * If we get new jobs and some are in a platform that never existed
         * before, then this will get called to create that new platform row.
         */
        var appendPlatformRow = function(tableEl, rowEl, platformName) {

            var tableRows = $(tableEl).find('tr');

            if (tableRows.length > 0){
                //Rows already exist, insert the new one in
                //alphabetical order
                var orderedPlatforms = [];
                orderedPlatforms.push( platformName );

                var td, platformSpan, spanPlatformName, r, p;

                //Generate a list of platform names that have
                //been added to the html table, use this for sorting
                for (r=0; r<tableRows.length; r++){
                    td = $( tableRows[r] ).find('td');
                    platformSpan = $( td[0] ).find('span');
                    spanPlatformName = $(platformSpan).text();
                    orderedPlatforms.push( spanPlatformName );
                }

                orderedPlatforms.sort();

                for (p=0; p<orderedPlatforms.length; p++){
                    if (orderedPlatforms[p] === platformName){
                        //Target row for appending should be one less
                        //than the position of the platform name
                        $(tableRows[ p - 1 ]).after(rowEl);
                        break;
                    }
                }

            } else {
                $(tableEl).append(rowEl);
            }
        };

        /**
         * Update / create a platform when new jobs are loaded/updated.
         * The platform may not have existed before
         */
        var updateJobs = function(platformData){
            angular.forEach(platformData, function(value, platformId) {
                addAdditionalJobParameters(value.jobGroups);
                if (value.resultsetId !== this.resultset.id){
                    //Confirm we are the correct result set
                    return;
                }

                var tdEls, rowEl, platformTdEl, jobTdEl,
                    platformName, option;

                platformName = thPlatformName(value.platformName);

                rowEl = document.getElementById(platformId);
                if (!rowEl){
                    //First job for this platform found, which means we need
                    //to create the platform and job td elements and the
                    //row
                    rowEl = $('<tr></tr>');

                    var tableEl = document.getElementById(
                        value.resultsetAggregateId
                    );

                    rowEl.prop('id', platformId);

                    option = value.platformOption;

                    //Add platforms
                    platformTdEl = $(platformInterpolator(
                        {'name':platformName, 'option':option, 'id':platformId}
                    ));

                    rowEl.append(platformTdEl);

                    jobTdEl = $( thCloneHtml.get('jobTdClone').text );

                    renderJobTableRow(rowEl, jobTdEl, value.jobGroups);

                    //Determine appropriate place to append row for this
                    //platform name
                    appendPlatformRow(tableEl, rowEl, platformName);

                } else {
                    tdEls = $(rowEl).find('td');
                    jobTdEl = $(tdEls[1]);

                    renderJobTableRow($(rowEl), jobTdEl, value.jobGroups);
                }
            }, this);
        };

        /**
         * When job selection change, scroll the viewport to display it
         */
        var scrollToElement = function(el, duration) {
            if (_.isUndefined(duration)) {
                duration = 50;
            }
            if (el.position() !== undefined) {
                var scrollOffset = -50;
                if (window.innerHeight >= 500 && window.innerHeight < 1000) {
                    scrollOffset = -100;
                } else if (window.innerHeight >= 1000) {
                    scrollOffset = -200;
                }
                if (!isOnScreen(el)) {
                    $('.th-global-content').scrollTo(el, duration, {offset: scrollOffset});
                }
            }

        };

        var isOnScreen = function(el){
            var viewport = {};
            viewport.top = $(window).scrollTop() + $("#global-navbar-container").height();
            viewport.bottom = viewport.top + $(window).height() - $("#info-panel").height();
            var bounds = {};
            bounds.top = el.offset().top;
            bounds.bottom = bounds.top + el.outerHeight();
            return ((bounds.top <= viewport.bottom) && (bounds.bottom >= viewport.top));
        };

        var registerCustomEventCallbacks = function(scope, element){


            //Register rootScope custom event listeners that require
            //access to the anguler level resultset scope
            //
            //NOTE: These event listeners are registered 1 per resultset
            //      so make sure the callback is only called if the event
            //      is associated with the target result set. Some of these
            //      events are really at the level of the $rootScope but the
            //      callbacks need access to the resultset level angular scope.
            $rootScope.$on(
                thEvents.revisionsLoaded, function(ev, rs){
                    if (rs.id === scope.resultset.id){
                        _.bind(addRevisions, scope, rs, element)();
                    }
                });

            $rootScope.$on(
                thEvents.toggleRevisions, function(ev, rs, expand){
                    if (rs.id === scope.resultset.id){
                        _.bind(toggleRevisions, scope, element, expand)();
                    }
                });

            $rootScope.$on(
                thEvents.globalFilterChanged, function(){
                    _.bind(filterJobs, scope, element)();
                });

            $rootScope.$on(
                thEvents.groupStateChanged, function(){
                    _.bind(renderGroups, scope, element, true)();
                    scrollToElement($(viewContentSel).find(".selected-job, .selected-count"), 1);
                });
            $rootScope.$on(thEvents.duplicateJobsVisibilityChanged, function() {
                _.bind(renderGroups, scope, element, true)();
            });

            $rootScope.$on(
                thEvents.searchPage, function(){
                    _.bind(filterJobs, scope, element)();
                });

            $rootScope.$on(
                thEvents.jobsLoaded, function(ev, platformData){
                    _.bind(updateJobs, scope, platformData)();
                });

            $rootScope.$on(
                thEvents.jobsClassified, function(ev, pinnedJobs){

                    var platformData = {};

                    var jid;
                    for (jid in pinnedJobs.jobs){
                        if (pinnedJobs.jobs.hasOwnProperty(jid)) {
                            //Only update the target resultset id
                            if (pinnedJobs.jobs[jid].result_set_id === scope.resultset.id) {
                                ThResultSetStore.aggregateJobPlatform(
                                    $rootScope.repoName, pinnedJobs.jobs[jid], platformData
                                );
                            }
                        }
                    }
                    if (!_.isEmpty(platformData)){
                        _.bind(updateJobs, scope, platformData)();
                    }
                });

            $rootScope.$on(
                thEvents.applyNewJobs, function(ev, resultSetId){
                    if (scope.resultset.id === resultSetId){

                        var rsMap = ThResultSetStore.getResultSetsMap($rootScope.repoName);

                        var resultsetAggregateId = thAggregateIds.getResultsetTableId(
                            $rootScope.repoName, scope.resultset.id, scope.resultset.revision
                        );

                        /**************
                          Resultset job pollers updates can
                          trigger re-rendering rows at anytime during a
                          session, this can give the appearance of sluggishness
                          in the UI. Use a timeout to avoid rendering jankiness
                          here.
                        **************/
                        rsMap[resultSetId].rs_obj.platforms.forEach(function(platform) {
                            addAdditionalJobParameters(platform.groups);
                        });
                        $timeout(generateJobElements(
                          resultsetAggregateId,
                          rsMap[resultSetId].rs_obj
                        )).then(function() {
                            $rootScope.jobsReady = true;
                        });
                    }
                });

            // Show runnable jobs when users press 'Add new jobs'
            $rootScope.$on(thEvents.showRunnableJobs, function(ev, rs) {
                if (scope.resultset.id === rs.id) {
                    rs.isRunnableVisible = true;

                    ThResultSetStore.addRunnableJobs($rootScope.repoName, rs);
                }
            });

            // Hide runnable jobs when users press 'Hide runnable jobs'
            $rootScope.$on(thEvents.deleteRunnableJobs, function(ev, rs) {
                if (scope.resultset.id === rs.id) {
                    ThResultSetStore.deleteRunnableJobs($rootScope.repoName, rs);
                }
            });

        };
        var addAdditionalJobParameters = function(groups) {
            groups.forEach(function(jobGroup) {
                if (jobGroup.symbol !== '?') {
                    jobGroup.grkey = jobGroup.mapKey;
                    jobGroup.collapsed = true;
                }
                jobGroup.jobs.forEach(function(job) {
                    // Keep track of visibility with this property. This
                    // way down stream job consumers don't need to repeatedly
                    // call showJob
                    job.visible = filterWithRunnable(job);
                });
            });
        };
        var generateJobElements = function(resultsetAggregateId, resultset) {
            var tableEl = $('#' + resultsetAggregateId);
            var waitSpanEl = $(tableEl).prev();
            $(waitSpanEl).css('display', 'none');
            var tableHtml = "";
            resultset.platforms.forEach(function(platform) {
                var platformId = thAggregateIds.getPlatformRowId(
                    $rootScope.repoName,
                    resultset.id,
                    platform.name,
                    platform.option
                );

                // We first determine whether the row has some visible element
                var anyVisible = _.some(platform.groups, function(jobGroup) {
                    return _.some(jobGroup.jobs, {visible: true});
                });
                var display_style = anyVisible ? "table-row" : "none";
                var rowHtml = '<tr id="' + platformId + '" style="display: ' + display_style + ';">';
                //Add platforms
                rowHtml += platformInterpolator(
                    {
                        'name':thPlatformName(platform.name), 'option':platform.option,
                        'id':thAggregateIds.getPlatformRowId(
                            resultset.id,
                            platform.name,
                            platform.option
                        )
                    }
                );
                rowHtml += '<td class="job-row">' + getJobTableRowHTML(platform.groups) + '</td></tr>';
                tableHtml += rowHtml;
            });
            tableEl.html(tableHtml);
        };

        var $scope = null;
        var linker = function(scope, element) {

            $scope = scope;

            //Remove any jquery on() bindings
            element.off();

            //Register events callback
            element.on('click mousedown', _.bind(jobClick, scope, scope.resultset));

            registerCustomEventCallbacks(scope, element);

            //Clone the target html
            var resultsetAggregateId = thAggregateIds.getResultsetTableId(
                $rootScope.repoName, scope.resultset.id, scope.resultset.revision
            );

            var targetEl = $(
                tableInterpolator({ aggregateId:resultsetAggregateId })
            );

            addRevisions(scope, targetEl);

            element.append(targetEl);

            if (scope.resultset.platforms !== undefined) {
                scope.resultset.platforms.forEach(function(platform) {
                    addAdditionalJobParameters(platform.groups);
                });
                generateJobElements(
                    resultsetAggregateId, scope.resultset);
            } else {
                // Hide the job wait span, resultset has no jobs
                var tableEl = $('#' + resultsetAggregateId);
                var waitSpanEl = $(tableEl).prev();
                $(waitSpanEl).css('display', 'none');
            }

            return {
                link:linker,
                replace:true
            };

        };

        return {
            link:linker,
            replace:true
        };
    }
]);
