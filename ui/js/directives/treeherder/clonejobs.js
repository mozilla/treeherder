/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* Directives */
treeherder.directive('thCloneJobs', [
    '$rootScope', '$http', 'ThLog', 'thUrl', 'thCloneHtml',
    'thServiceDomain', 'thResultStatusInfo', 'thEvents', 'thAggregateIds',
    'thJobFilters', 'thResultStatusObject', 'ThResultSetStore',
    'ThJobModel', 'linkifyBugsFilter', 'thResultStatus', 'thPlatformName',
    'thJobSearchStr', 'thNotify', '$timeout',
    function(
        $rootScope, $http, ThLog, thUrl, thCloneHtml,
        thServiceDomain, thResultStatusInfo, thEvents, thAggregateIds,
        thJobFilters, thResultStatusObject, ThResultSetStore,
        ThJobModel, linkifyBugsFilter, thResultStatus, thPlatformName,
        thJobSearchStr, thNotify, $timeout){

        var $log = new ThLog("thCloneJobs");

        // CSS classes
        var btnCls = 'btn-xs';
        var selectedBtnCls = 'selected-job';
        var largeBtnCls = 'btn-lg-xform';

        var col5Cls = 'col-xs-5';
        var col7Cls = 'col-xs-7';
        var col12Cls = 'col-xs-12';
        var jobListNoPadCls = 'job-list-nopad';
        var jobListPadCls = 'job-list-pad';

        // Custom Attributes
        var jobKeyAttr = 'data-jmkey';

        var tableInterpolator = thCloneHtml.get('resultsetClone').interpolator;

        //Retrieve platform interpolator
        var platformInterpolator = thCloneHtml.get('platformClone').interpolator;

        //Instantiate job group interpolator
        var jobGroupInterpolator = thCloneHtml.get('jobGroupBeginClone').interpolator;

        //Instantiate job btn interpolator
        var jobBtnInterpolator = thCloneHtml.get('jobBtnClone').interpolator;

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
                var el, key, job, jobs, getIndex;

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
                jobs = $(".th-view-content").find(jobNavSelector.selector).filter(":visible, .selected-job");
                if (jobs.length) {
                    var selIdx = jobs.index(jobs.filter(".selected-job"));
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

        $rootScope.$on(thEvents.clearSelectedJob, function(ev, job) {
            clearSelectJobStyles();
        });

        var selectJob = function(job, job_selection_type) {
            var jobKey = getJobMapKey(job);
            var jobEl = $('.' + jobKey);

            clickJobCb({}, jobEl, job, job_selection_type);
            scrollToElement(jobEl);

            ThResultSetStore.setSelectedJob($rootScope.repoName, jobEl, job);
        };

        var setSelectJobStyles = function(el){

            var lastJobSelected = ThResultSetStore.getSelectedJob(
                $rootScope.repoName);

            if(!_.isEmpty(lastJobSelected.el)){
                lastJobSelected.el.removeClass(selectedBtnCls);
                lastJobSelected.el.removeClass(largeBtnCls);
                lastJobSelected.el.addClass(btnCls);
            }

            el.removeClass(btnCls);
            el.addClass(largeBtnCls);
            el.addClass(selectedBtnCls);

        };

        var clearSelectJobStyles = function() {
            var lastJobSelected = ThResultSetStore.getSelectedJob(
                $rootScope.repoName);

            if (!_.isEmpty(lastJobSelected.el)) {
                lastJobSelected.el.removeClass(selectedBtnCls);
                lastJobSelected.el.removeClass(largeBtnCls);
                lastJobSelected.el.addClass(btnCls);
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

        var togglePinJobCb = function(ev, el, job){
            $rootScope.$emit(thEvents.jobPin, job);
        };

        var addJobBtnEls = function(
            jgObj, jobBtnInterpolator, jobTdEl){

            var jobsShown = 0;

            var lastJobSelected = ThResultSetStore.getSelectedJob(
                $rootScope.repoName
            );

            var hText, key, resultState, job, jobStatus, jobBtn, l;
            var jobBtnArray = [];

            for(l=0; l<jgObj.jobs.length; l++){

                job = jgObj.jobs[l];

                //Set the resultState
                resultState = thResultStatus(job);

                job.searchStr = thJobSearchStr(job) + ' ' + job.ref_data_name  + ' ' +
                    job.signature;

                //Make sure that filtering doesn't effect the resultset counts
                //displayed
                if(thJobFilters.showJob(job) === false){
                    //Keep track of visibility with this property. This
                    //way down stream job consumers don't need to repeatedly
                    //call showJob
                    job.visible = false;
                } else {
                    jobsShown++;
                    job.visible = true;
                }

                hText = getHoverText(job);
                key = getJobMapKey(job);

                jobStatus = thResultStatusInfo(resultState);

                //Add a visual indicator for a failure classification
                jobStatus.key = key;
                if(parseInt(job.failure_classification_id, 10) > 1){
                    jobStatus.value = job.job_type_symbol + '*';
                    if (jobStatus.btnClassClassified) {
                        // For result types that are displayed more prominently
                        // when unclassified, switch to the more subtle classified
                        // style.
                        jobStatus.btnClass = jobStatus.btnClassClassified;
                    }
                } else {
                    jobStatus.value = job.job_type_symbol;
                }

                jobStatus.title = hText;

                jobBtn = $( jobBtnInterpolator(jobStatus));
                jobBtnArray.push(jobBtn);
                // add a zero-width space between spans so they can wrap
                jobBtnArray.push(' ');

                showHideJob(jobBtn, job.visible);

                //If the job is currently selected make sure to re-apply
                //the job selection styles
                if( !_.isEmpty(lastJobSelected.job) &&
                    (lastJobSelected.job.id === job.id)){

                    setSelectJobStyles(jobBtn);

                    //Update the selected job element to the current one
                    ThResultSetStore.setSelectedJob(
                        $rootScope.repoName, jobBtn, job);
                }
            }
            jobTdEl.append(jobBtnArray);

            return jobsShown;
        };

        var jobMouseDown = function(resultset, ev){

            var el = $(ev.target);
            var key = el.attr(jobKeyAttr);
            //Confirm user selected a job
            if(key && !_.isEmpty(this.job_map[key])){

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
                    ev.preventDefault();
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

                ThResultSetStore.setSelectedJob($rootScope.repoName, el, job);

            }
        };

        var addRevisions = function(resultset, element){

            if(resultset.revisions.length > 0){

                var revisionInterpolator = thCloneHtml.get('revisionsClone').interpolator;

                var ulEl = element.find('ul');

                //make sure we're starting with an empty element
                $(ulEl).empty();

                var revision, revisionHtml, userTokens, i;

                for(i=0; i<resultset.revisions.length; i++){

                    revision = resultset.revisions[i];

                    revision.urlBasePath = $rootScope.urlBasePath;
                    revision.currentRepo = $rootScope.currentRepo;

                    userTokens = revision.author.split(/[<>]+/);
                    if (userTokens.length > 1) {
                        revision.email = userTokens[1];
                    }
                    revision.name = userTokens[0].trim();
                    // Only use the first line of the full commit message.
                    revision.escaped_comment = _.escape(revision.comments.split('\n')[0]);
                    revision.escaped_comment_linkified = linkifyBugsFilter(revision.escaped_comment);
                    revisionHtml = revisionInterpolator(revision);
                    ulEl.append(revisionHtml);
                }
                if (resultset.revision_count > resultset.revisions.length) {

                    var pushlogInterpolator = thCloneHtml.get('pushlogRevisionsClone').interpolator;
                    ulEl.append(pushlogInterpolator({
                        currentRepo: $rootScope.currentRepo,
                        revision: resultset.revision
                    }));
                }
            }
        };

        var toggleRevisions = function(element, expand){

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

            if(on) {

                ThResultSetStore.loadRevisions(
                    $rootScope.repoName, this.resultset.id
                );

                if(jobsElDisplayState === 'block'){
                    toggleRevisionsSpanOnWithJobs(revisionsEl);
                    //Make sure the jobs span has correct styles
                    toggleJobsSpanOnWithRevisions(jobsEl);
                }

            } else {
                toggleRevisionsSpanOff(revisionsEl);
                toggleJobsSpanOnWithoutRevisions(jobsEl);
            }

        };

        var toggleRevisionsSpanOnWithJobs = function(el){
            el.css('display', 'block');
            el.addClass(col5Cls);
        };
        var toggleRevisionsSpanOff = function(el){
            el.css('display', 'none');
            el.removeClass(col5Cls);
        };
        var toggleJobsSpanOnWithRevisions = function(el){
            el.css('display', 'block');
            el.removeClass(jobListNoPadCls);
            el.removeClass(col12Cls);
            el.addClass(col7Cls);
            el.addClass(jobListPadCls);
        };
        var toggleJobsSpanOnWithoutRevisions = function(el){
            el.css('display', 'block');
            el.removeClass(col7Cls);
            el.removeClass(jobListPadCls);
            el.addClass(jobListNoPadCls);
            el.addClass(col12Cls);
        };

        var renderJobTableRow = function(row, jobTdEl, jobGroups) {

            //Empty the job column before populating it
            jobTdEl.empty();

            var jgObj, jobGroup, jobsShown, i;
            for(i=0; i<jobGroups.length; i++){

                jgObj = jobGroups[i];

                jobsShown = 0;
                if(jgObj.symbol !== '?'){
                    // Job group detected, add job group symbols
                    jobGroup = $( jobGroupInterpolator(jobGroups[i]) );

                    jobTdEl.append(jobGroup);

                    // Add the job btn spans
                    jobsShown = addJobBtnEls(
                        jgObj, jobBtnInterpolator, jobGroup.find(".job-group-list"));
                    jobGroup.css("display", jobsShown? "inline": "none");

                }else{

                    // Add the job btn spans
                    jobsShown = addJobBtnEls(
                        jgObj, jobBtnInterpolator, jobTdEl);

                }
            }
            row.append(jobTdEl);
            filterPlatform(row);
        };

        var filterJobs = function(element){
            $log.debug("filterJobs", element);

            if(this.resultset.platforms === undefined){
                return;
            }

            var job, jmKey, show;
            var jobMap = ThResultSetStore.getJobMap($rootScope.repoName);

            element.find('.job-list .job-btn').each(function internalFilterJob() {
                // using jquery to do these things was quite a bit slower,
                // so just using raw JS for speed.
                jmKey = this.dataset.jmkey;
                job = jobMap[jmKey].job_obj;
                show = thJobFilters.showJob(job);
                job.visible = show;

                showHideJob($(this), show);
            });

            // hide platforms and groups where all jobs are hidden
            element.find(".platform").each(function internalFilterPlatform() {
                var platform = $(this.parentNode);
                filterPlatform(platform);
            });

        };
        var showHideJob = function(job, show) {
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
                job[0].classList.add("filter-shown");
            } else {
                job[0].classList.remove("filter-shown");
            }
        };

        var filterPlatform = function(platform) {
            var showPlt = platform.find('.job-row .filter-shown').length !== 0;
            var showGrp;

            if (showPlt) {
                platform[0].style.display ="table-row";
                platform.find(".platform-group").each(function internalFilterGroup() {
                    var grp = $(this);
                    showGrp = grp.find('.job-group-list .filter-shown').length !== 0;
                    grp[0].style.display = showGrp ? "inline" : "none";
                });

            } else {
                platform[0].style.display = "none";
            }
        };

        var appendPlatformRow = function(tableEl, rowEl, platformName){

            var tableRows = $(tableEl).find('tr');

            if(tableRows.length > 0){
                //Rows already exist, insert the new one in
                //alphabetical order
                var orderedPlatforms = [];
                orderedPlatforms.push( platformName );

                var td, platformSpan, spanPlatformName, r, p;

                //Generate a list of platform names that have
                //been added to the html table, use this for sorting
                for(r=0; r<tableRows.length; r++){
                    td = $( tableRows[r] ).find('td');
                    platformSpan = $( td[0] ).find('span');
                    spanPlatformName = $(platformSpan).text();
                    orderedPlatforms.push( spanPlatformName );
                }

                orderedPlatforms.sort();

                for(p=0; p<orderedPlatforms.length; p++){
                    if(orderedPlatforms[p] === platformName){
                        //Target row for appending should be one less
                        //than the position of the platform name
                        $(tableRows[ p - 1 ]).after(rowEl);
                        break;
                    }
                }

            }else{
                $(tableEl).append(rowEl);
            }
        };

        var updateJobs = function(platformData){
            angular.forEach(platformData, function(value, platformId){

                if(value.resultsetId !== this.resultset.id){
                    //Confirm we are the correct result set
                    return;
                }

                var tdEls, rowEl, platformTdEl, jobTdEl,
                    platformKey, platformName, option, tableRows;

                platformName = thPlatformName(value.platformName);

                rowEl = document.getElementById(platformId);

                if(!rowEl){
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
                    platformTdEl = $( platformInterpolator(
                        {'name':platformName, 'option':option, 'id':platformId }
                    ) );

                    rowEl.append(platformTdEl);

                    jobTdEl = $( thCloneHtml.get('jobTdClone').text );

                    renderJobTableRow(rowEl, jobTdEl, value.jobGroups);

                    //Determine appropriate place to append row for this
                    //platform name
                    appendPlatformRow(tableEl, rowEl, platformName);

                }else{
                    tdEls = $(rowEl).find('td');
                    jobTdEl = $(tdEls[1]);

                    renderJobTableRow($(rowEl), jobTdEl, value.jobGroups);
                }
            }, this);
        };

        var scrollToElement = function(el){

            if(el.position() !== undefined){
                $('.th-global-content').scrollTo(el, 100, {offset: -40});
            }

        };

        var registerCustomEventCallbacks = function(scope, element, attrs){

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
                    if(rs.id === scope.resultset.id){
                        _.bind(addRevisions, scope, rs, element)();
                    }
                });

            $rootScope.$on(
                thEvents.toggleRevisions, function(ev, rs, expand){
                    if(rs.id === scope.resultset.id){
                        _.bind(toggleRevisions, scope, element, expand)();
                    }
                });

            $rootScope.$on(
                thEvents.globalFilterChanged, function(ev, filterData){
                    _.bind(filterJobs, scope, element)();
                });

            $rootScope.$on(
                thEvents.searchPage, function(ev, searchData){
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
                    for(jid in pinnedJobs.jobs){
                        if (pinnedJobs.jobs.hasOwnProperty(jid)) {
                            //Only update the target resultset id
                            if(pinnedJobs.jobs[jid].result_set_id === scope.resultset.id){
                                ThResultSetStore.aggregateJobPlatform(
                                    $rootScope.repoName, pinnedJobs.jobs[jid], platformData
                                );
                            }
                        }
                    }
                    if(!_.isEmpty(platformData)){
                        _.bind(updateJobs, scope, platformData)();
                    }
                });

            $rootScope.$on(
                thEvents.applyNewJobs, function(ev, resultSetId){
                    if(scope.resultset.id === resultSetId){

                        var rsMap = ThResultSetStore.getResultSetsMap($rootScope.repoName);

                        var resultsetAggregateId = thAggregateIds.getResultsetTableId(
                            $rootScope.repoName, scope.resultset.id, scope.resultset.revision
                        );

                        /**************
                      Resultset job pollers updates can
                      trigger re-rendering rows at anytime during a
                      session, this can give the appearance of sluggishness
                      in the UI. Use defer to avoid rendering jankiness
                      here.
                        **************/
                        _.defer(
                            generateJobElements,
                            resultsetAggregateId,
                            rsMap[resultSetId].rs_obj);
                    }
                });
        };

        var generateJobElements = function(
            resultsetAggregateId, resultset){

            var tableEl = $('#' + resultsetAggregateId);

            var waitSpanEl = $(tableEl).prev();
            $(waitSpanEl).css('display', 'none');

            var name, option, platformId, platformKey, row, platformTd, jobTdEl, j;
            for(j=0; j<resultset.platforms.length; j++){

                platformId = thAggregateIds.getPlatformRowId(
                    $rootScope.repoName,
                    resultset.id,
                    resultset.platforms[j].name,
                    resultset.platforms[j].option
                );

                row = $('#' + platformId);

                if($(row).prop('tagName') !== 'TR'){
                    // First time the row is being created
                    row = $('<tr></tr>');
                    row.prop('id', platformId);
                } else {
                    // Clear and re-write the div content if it
                    // already exists
                    $(row).empty();
                }

                name = thPlatformName(resultset.platforms[j].name);
                option = resultset.platforms[j].option;

                //Add platforms
                platformTd = platformInterpolator(
                    {
                        'name':name, 'option':option,
                        'id':thAggregateIds.getPlatformRowId(
                            resultset.id,
                            resultset.platforms[j].name,
                            resultset.platforms[j].option
                        )
                    }
                );

                row.append(platformTd);

                // Render the row of job data
                jobTdEl = $( thCloneHtml.get('jobTdClone').text );

                platformKey = ThResultSetStore.getPlatformKey(
                    resultset.platforms[j].name, resultset.platforms[j].option
                );

                renderJobTableRow(row, jobTdEl, resultset.platforms[j].groups);

                tableEl.append(row);
            }
        };

        var linker = function(scope, element, attrs){

            //Remove any jquery on() bindings
            element.off();

            //Register events callback
            element.on('mousedown', _.bind(jobMouseDown, scope, scope.resultset));

            registerCustomEventCallbacks(scope, element);

            //Clone the target html
            var resultsetAggregateId = thAggregateIds.getResultsetTableId(
                $rootScope.repoName, scope.resultset.id, scope.resultset.revision
            );

            var targetEl = $(
                tableInterpolator({ aggregateId:resultsetAggregateId })
            );

            addRevisions(scope.resultset, targetEl);

            element.append(targetEl);

            if(scope.resultset.platforms !== undefined){
                generateJobElements(
                    resultsetAggregateId, scope.resultset);
            }else{
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

    }]);
