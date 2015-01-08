/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* Directives */
treeherder.directive('thCloneJobs', [
    '$rootScope', '$http', 'ThLog', 'thUrl', 'thCloneHtml',
    'thServiceDomain', 'thResultStatusInfo', 'thEvents', 'thAggregateIds',
    'thJobFilters', 'thResultStatusObject', 'ThResultSetModel',
    'ThJobModel', 'linkifyBugsFilter', 'thResultStatus', 'thPlatformNameMap',
    function(
        $rootScope, $http, ThLog, thUrl, thCloneHtml,
        thServiceDomain, thResultStatusInfo, thEvents, thAggregateIds,
        thJobFilters, thResultStatusObject, ThResultSetModel,
        ThJobModel, linkifyBugsFilter, thResultStatus, thPlatformNameMap){

    var $log = new ThLog("thCloneJobs");

    var classificationRequired = {
        "busted":1,
        "exception":1,
        "testfailed":1
        };

    // CSS classes
    var btnCls = 'btn-xs';
    var selectedBtnCls = 'selected-job';
    var largeBtnCls = 'btn-lg-xform';

    var col5Cls = 'col-xs-5';
    var col7Cls = 'col-xs-7';
    var col12Cls = 'col-xs-12';
    var jobListNoPadCls = 'job-list-nopad';
    var jobListPadLeftCls = 'job-list-pad-left';

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

        var jobStatus = thResultStatus(job);
        var hoverText = job.job_type_name;

        if( (jobStatus === 'pending') || (jobStatus === 'running') ){
            hoverText += " - still " + jobStatus + ", check the job detail panel for a ETA";

        }else {
            //The job is complete, compute duration
            var duration = Math.round((job.end_timestamp - job.submit_timestamp) / 60);
            hoverText += jobStatus + " - " + duration + " mins";
        }

        if (job.job_type_description !== "fill me") {
            hoverText += " (" + job.job_type_description + ")";
        }

        return hoverText;
    };

    //Global event listeners
    $rootScope.$on(
        thEvents.selectNextUnclassifiedFailure, function(ev){

            var jobMap = ThResultSetModel.getJobMap($rootScope.repoName);
            var lastJobSelected = ThResultSetModel.getSelectedJob($rootScope.repoName);

            var targetEl, jobKey;
            if(!_.isEmpty(lastJobSelected.el)){
                jobKey = getJobMapKey(lastJobSelected.job);
                getNextUnclassifiedFailure(jobMap[jobKey].job_obj);

            }else{
                //Select the first unclassified failure
                getNextUnclassifiedFailure({});
            }
    });

    $rootScope.$on(
        thEvents.selectPreviousUnclassifiedFailure, function(ev){

            var jobMap = ThResultSetModel.getJobMap($rootScope.repoName);

            var lastJobSelected = ThResultSetModel.getSelectedJob($rootScope.repoName);

            var targetEl, jobKey;
            if(!_.isEmpty(lastJobSelected.el)){
                jobKey = getJobMapKey(lastJobSelected.job);
                getPreviousUnclassifiedFailure(jobMap[jobKey].job_obj);

            }else{
                //Select the first unclassified failure
                getPreviousUnclassifiedFailure({});
            }

    });

    $rootScope.$on(thEvents.selectJob, function(ev, job) {
          selectJob(job);
    });

    $rootScope.$on(thEvents.clearJobStyles, function(ev, job) {
          clearSelectJobStyles();
    });

    var selectJob = function(job){

        var jobKey = getJobMapKey(job);
        var jobEl = $('.' + jobKey);

        clickJobCb({}, jobEl, job);
        scrollToElement(jobEl);

        ThResultSetModel.setSelectedJob(
            $rootScope.repoName, jobEl, job
            );

    };

    var setSelectJobStyles = function(el){

        var lastJobSelected = ThResultSetModel.getSelectedJob(
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
        var lastJobSelected = ThResultSetModel.getSelectedJob(
            $rootScope.repoName);

        if (!_.isEmpty(lastJobSelected.el)) {
            lastJobSelected.el.removeClass(selectedBtnCls);
            lastJobSelected.el.removeClass(largeBtnCls);
            lastJobSelected.el.addClass(btnCls);
        }
    };

    var broadcastJobChangedTimeout = null;
    var clickJobCb = function(ev, el, job){
        setSelectJobStyles(el);
        // delay switching right away, in case the user is switching rapidly
        // between jobs
        if (broadcastJobChangedTimeout) {
          window.clearTimeout(broadcastJobChangedTimeout);
        }
        broadcastJobChangedTimeout = window.setTimeout(function() {
          $rootScope.$emit(thEvents.jobClick, job);
        }, 200);
    };

    var clearJobCb = function(ev, el, job) {
        clearSelectJobStyles();

        // Reset selected job to null to initialize nav position
        ThResultSetModel.setSelectedJob($rootScope.repoName);

        $rootScope.$emit(thEvents.jobClear, job);
    };

    var togglePinJobCb = function(ev, el, job){
        $rootScope.$emit(thEvents.jobPin, job);
    };

    var addJobBtnEls = function(
        jgObj, jobBtnInterpolator, jobTdEl, resultStatusFilters, jobCounts){

        var jobsShown = 0;

        var lastJobSelected = ThResultSetModel.getSelectedJob(
            $rootScope.repoName
            );

        var hText, key, resultState, job, jobStatus, jobBtn, l;
        var jobBtnArray = [];

        for(l=0; l<jgObj.jobs.length; l++){

            job = jgObj.jobs[l];

            //Set the resultState
            resultState = thResultStatus(job);

            //Increment the jobCounts here so they're not modified by
            //filtering
            jobCounts[resultState] += 1;

            job.searchStr = getPlatformName(job.platform) + ' ' +
                job.platform_option + ' ' + job.job_group_name + ' ' +
                job.job_group_symbol + ' ' + job.job_type_name + ' ' +
                job.job_type_symbol + ' ' + job.ref_data_name;

            //Make sure that filtering doesn't effect the resultset counts
            //displayed
            if(thJobFilters.showJob(job, resultStatusFilters) === false){
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
            }else{
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
                ThResultSetModel.setSelectedJob(
                    $rootScope.repoName, jobBtn, job);
            }
        }
        jobTdEl.append(jobBtnArray);

        return jobsShown;
    };

    var jobMouseDown = function(ev){

        var el = $(ev.target);
        var key = el.attr(jobKeyAttr);
        //Confirm user selected a job
        if(key && !_.isEmpty(this.job_map[key])){

            var job = this.job_map[key].job_obj;

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
                        //Retrieve the job reference data and open a new
                        //window on the job's log file
                        if(data.logs.length > 0){
                            window.open(data.logs[0].url, "Log");
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

            ThResultSetModel.setSelectedJob($rootScope.repoName, el, job);

        } else {
            // If user didn't select a job or anchor clear the selected job
            if (el.prop("tagName") !== "A") {
                _.bind(clearJobCb, this, ev, el)();
            }
        }
    };

    var addRevisions = function(resultset, element){
//        $log.debug("addRevisions", resultset, element);

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
                revision.escaped_comment = _.escape(revision.comments);
                revision.comments_bug_link = linkifyBugsFilter(revision.escaped_comment);
                revisionHtml = revisionInterpolator(revision);
                ulEl.append(revisionHtml);
            }
            if (resultset.revision_count > resultset.revisions.length) {

                var pushlogInterpolator = thCloneHtml.get('pushlogRevisionsClone').interpolator;
                ulEl.append(pushlogInterpolator({
                    currentRepo: $rootScope.currentRepo,
                    revision: resultset.revision,
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

        if(on){

            ThResultSetModel.loadRevisions(
                $rootScope.repoName, this.resultset.id
            );

            if(jobsElDisplayState === 'block'){
                toggleRevisionsSpanOnWithJobs(revisionsEl);
                //Make sure the jobs span has correct styles
                toggleJobsSpanOnWithRevisions(jobsEl);

            }else{
                toggleRevisionsSpanOnWithoutJobs(revisionsEl);
            }

        }else{
            toggleRevisionsSpanOff(revisionsEl);

            if(jobsElDisplayState === 'block'){
                toggleJobsSpanOnWithoutRevisions(jobsEl);
            }else{
                //Nothing is displayed, hide the row to
                //prevent a double border from displaying
                rowEl.css('display', 'none');
            }
        }

    };
    /**
     * Toggle the jobs of a resultset expanded or collapsed
     * @param element - The element to expand/collapse
     * @param expand - whether to force either expanding or collapsing.  If 'undefined' then
     *                 just toggle.  If set to true, the expand if it isn't already.  Supports
     *                 an expand/collapse all button.
     */
    var toggleJobs = function(element, expand){


        var revisionsEl = element.find('ul').parent();
        var jobsEl = element.find('table').parent();

        var revElDisplayState = revisionsEl.css('display') || 'block';
        var jobsElDisplayState = jobsEl.css('display') || 'block';

        var on = jobsElDisplayState !== 'block';
        if (!_.isUndefined(expand)) {
            on = expand;
        }

        var rowEl = revisionsEl.parent();
        rowEl.css('display', 'block');

        if(on){

            if(revElDisplayState === 'block'){
                toggleJobsSpanOnWithRevisions(jobsEl);
                //Make sure the revisions span has correct styles
                toggleRevisionsSpanOnWithJobs(revisionsEl);
            }else{
                toggleJobsSpanOnWithoutRevisions(jobsEl);
            }

        }else{
            toggleJobsSpanOff(jobsEl);

            if(revElDisplayState === 'block'){
                toggleRevisionsSpanOnWithoutJobs(revisionsEl);
            }else{
                //Nothing is displayed, hide the row to
                //prevent a double border from displaying
                rowEl.css('display', 'none');
            }
        }

    };

    var toggleRevisionsSpanOnWithJobs = function(el){
        el.css('display', 'block');
        el.addClass(col5Cls);
    };
    var toggleRevisionsSpanOnWithoutJobs = function(el){
        el.css('display', 'block');
        el.removeClass(col5Cls);
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
        el.addClass(jobListPadLeftCls);
    };
    var toggleJobsSpanOnWithoutRevisions = function(el){
        el.css('display', 'block');
        el.removeClass(col7Cls);
        el.removeClass(jobListPadLeftCls);
        el.addClass(jobListNoPadCls);
        el.addClass(col12Cls);
    };
    var toggleJobsSpanOff = function(el){
        el.css('display', 'none');
    };

    var renderJobTableRow = function(
        row, jobTdEl, jobGroups, resultStatusFilters, resultsetId,
        platformKey){

        //Empty the job column before populating it
        jobTdEl.empty();

        var resultSetMap = ThResultSetModel.getResultSetsMap($rootScope.repoName);

        var jobCounts = thResultStatusObject.getResultStatusObject();

        //Reset counts for the platform every time we render the
        //row. This is required to account for job coallescing.
        //Coallesced jobs cause the pending/running counts to be
        //incorrect.
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
                    jgObj, jobBtnInterpolator, jobGroup.find(".job-group-list"),
                    resultStatusFilters,
                    jobCounts
                    );
                jobGroup.css("display", jobsShown? "inline": "none");

            }else{

                // Add the job btn spans
                jobsShown = addJobBtnEls(
                    jgObj, jobBtnInterpolator, jobTdEl, resultStatusFilters,
                    jobCounts
                    );

            }
        }
        row.append(jobTdEl);
        filterPlatform(row);

        //reset the resultset counts for the platformKey
        if(resultSetMap[resultsetId].platforms[platformKey] !== undefined){
            resultSetMap[resultsetId].platforms[platformKey].job_counts = jobCounts;
        }

    };

    var filterJobs = function(element, resultStatusFilters){
        $log.debug("filterJobs", element, resultStatusFilters);

        if(this.resultset.platforms === undefined){
            return;
        }

        var job, jmKey, show;
        var jobMap = ThResultSetModel.getJobMap($rootScope.repoName);

        element.find('.job-list .job-btn').each(function internalFilterJob() {
            // using jquery to do these things was quite a bit slower,
            // so just using raw JS for speed.
            jmKey = this.dataset.jmkey;
            job = jobMap[jmKey].job_obj;
            show = thJobFilters.showJob(job, resultStatusFilters);
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

    var getPlatformName = function(name){

        var platformName = thPlatformNameMap[name];

        if(platformName === undefined){
            platformName = name;
        }

        return platformName;
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

    /**
     * Reset the counts on a single resultset.  This should happen once per
     * resultset when the platforms in a resultset have been updated
     * (by loading initial or updated data).
     *
     */
    var resetCounts = function(resultSet){
        var rsMap = ThResultSetModel.getResultSetsMap($rootScope.repoName)[resultSet.id];
        var jobCounts = thResultStatusObject.getResultStatusObject();

        var statusKeys = _.keys(jobCounts);
        jobCounts.total = 0;

        if(resultSet.platforms === undefined){
            return;
        }
        var platformKey;
        for(var j=0; j < resultSet.platforms.length; j++){

            platformKey = ThResultSetModel.getPlatformKey(
                resultSet.platforms[j].name,
                resultSet.platforms[j].option
                );

            var statusPerPlatform = {};
            if(!_.isEmpty(rsMap.platforms[platformKey])){
                statusPerPlatform = rsMap.platforms[platformKey].job_counts;
            }

            if(!_.isEmpty(statusPerPlatform)){

                var jobStatus, k;
                for(k=0; k<statusKeys.length; k++){
                    jobStatus = statusKeys[k];
                    jobCounts[jobStatus] += statusPerPlatform[jobStatus];
                    jobCounts.total += statusPerPlatform[jobStatus];
                }
            }
        }

        resultSet.job_counts = jobCounts;
    };

    var updateJobs = function(platformData){
        angular.forEach(platformData, function(value, platformId){

            if(value.resultsetId !== this.resultset.id){
                //Confirm we are the correct result set
                return;
            }

            var tdEls, rowEl, platformTdEl, jobTdEl,
                platformKey, platformName, option, tableRows;

            platformName = getPlatformName(value.platformName);

            platformKey = ThResultSetModel.getPlatformKey(
                value.platformName, value.platformOption
                );

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

                renderJobTableRow(
                    rowEl, jobTdEl, value.jobGroups, this.resultStatusFilters,
                    value.resultsetId, platformKey, true
                    );

                //Determine appropriate place to append row for this
                //platform name
                appendPlatformRow(tableEl, rowEl, platformName);

            }else{
                tdEls = $(rowEl).find('td');
                platformTdEl = $(tdEls[0]);
                jobTdEl = $(tdEls[1]);

                renderJobTableRow(
                    $(rowEl), jobTdEl, value.jobGroups, this.resultStatusFilters,
                    value.resultsetId, platformKey, true
                    );
            }
        }, this);
    };

    var getNextUnclassifiedFailure = function(currentJob){

        var resultsets = ThResultSetModel.getResultSetsArray($rootScope.repoName);

        var firstJob = null;
        var foundJob = false;
        var startWatch = false;
        if(_.isEmpty(currentJob)){
            startWatch = true;
        }

        var platforms, groups, jobs, r;

        for(r = 0; r < resultsets.length; r++){

            platforms = resultsets[r].platforms;
            if(platforms === undefined){
                continue;
            }

            var p;
            for(p = 0; p < platforms.length; p++){

                groups = platforms[p].groups;
                var g;
                for(g = 0; g < groups.length; g++){

                    jobs = groups[g].jobs;
                    var j;
                    for(j = 0; j < jobs.length; j++){

                        if(currentJob.id === jobs[j].id){

                            //This is the current selection, get the next
                            startWatch = true;
                            continue;
                        }

                        if(startWatch || !firstJob){
                            if( (jobs[j].visible === true) &&
                                (classificationRequired[jobs[j].result] === 1) &&
                                ( (parseInt(jobs[j].failure_classification_id, 10) === 1) ||
                                  (jobs[j].failure_classification_id === null)  )){
                                if (startWatch) {
                                    foundJob = true;
                                    selectJob(jobs[j]);
                                    return;
                                } else {
                                    firstJob = jobs[j];
                                }
                            }
                        }
                    }
                }
            }
        }

        if (!foundJob && firstJob) {
          // we were at the last job, start again from the beginning
          selectJob(firstJob);
        }
    };

    var getPreviousUnclassifiedFailure = function(currentJob){

        var resultsets = ThResultSetModel.getResultSetsArray($rootScope.repoName);

        var foundJob = false;
        var lastJob = null;
        var startWatch = false;
        if(_.isEmpty(currentJob)){
            startWatch = true;
        }

        var platforms, groups, jobs, r;

        for(r = resultsets.length - 1; r >= 0; r--){

            platforms = resultsets[r].platforms;
            if(platforms === undefined){
                continue;
            }

            var p;
            for(p = platforms.length - 1; p >= 0; p--){

                groups = platforms[p].groups;
                var g;
                for(g = groups.length - 1; g >= 0; g--){

                    jobs = groups[g].jobs;
                    var j;
                    for(j = jobs.length - 1; j >= 0; j--){
                        if(currentJob.id === jobs[j].id){

                            //This is the current selection, get the next
                            startWatch = true;
                            continue;
                        }
                        if(startWatch || !lastJob){
                            if( (jobs[j].visible === true) &&
                                (classificationRequired[jobs[j].result] === 1) &&
                                ( (parseInt(jobs[j].failure_classification_id, 10) === 1) ||
                                  (jobs[j].failure_classification_id === null)  )){

                                if (startWatch) {
                                    selectJob(jobs[j]);
                                    return;
                                } else {
                                    lastJob = jobs[j];
                                }
                            }
                        }
                    }
                }
            }
        }
        if (!foundJob && lastJob) {
            // we were at the first job, go to the very end
            selectJob(lastJob);
        }
    };

    var scrollToElement = function(el){

        if(el.position() !== undefined){
          var scrollPos = $('.th-content').scrollTop() +
            el.parents('div.result-set.ng-scope').position().top +
            el.position().top;

            //Scroll to the job element
            $('.th-content').animate({
                scrollTop: scrollPos
            }, 200);
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
            thEvents.toggleJobs, function(ev, rs, expand){
                if(rs.id === scope.resultset.id){
                    _.bind(toggleJobs, scope, element, expand)();
                }
            });

        $rootScope.$on(
            thEvents.globalFilterChanged, function(ev, filterData){
                scope.resultStatusFilters = thJobFilters.getResultStatusArray();
                _.bind(filterJobs, scope, element, scope.resultStatusFilters)();
            });

        $rootScope.$on(
            thEvents.searchPage, function(ev, searchData){
                scope.resultStatusFilters = thJobFilters.getResultStatusArray();
                _.bind(filterJobs, scope, element, scope.resultStatusFilters)();
            });

        $rootScope.$on(
            thEvents.resultSetFilterChanged, function(ev, rs){
                if(rs.id === scope.resultset.id){
                    _.bind(
                        filterJobs, scope, element, scope.resultStatusFilters
                        )();
                }
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
                            ThResultSetModel.aggregateJobPlatform(
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

                    var rsMap = ThResultSetModel.getResultSetsMap($rootScope.repoName);

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
                        rsMap[resultSetId].rs_obj,
                        scope.resultStatusFilters);
                }
            });
    };

    var generateJobElements = function(
        resultsetAggregateId, resultset, resultStatusFilters){

        var tableEl = $('#' + resultsetAggregateId);

        var waitSpanEl = $(tableEl).prev();
        $(waitSpanEl).css('display', 'none');

        var name, option, platformId, platformKey, row, platformTd, jobTdEl,
            statusList, j;
        for(j=0; j<resultset.platforms.length; j++){

            platformId = thAggregateIds.getPlatformRowId(
                $rootScope.repoName,
                resultset.id,
                resultset.platforms[j].name,
                resultset.platforms[j].option
                );

            row = $('#' + platformId);

            if( $(row).prop('tagName') !== 'TR' ){
                // First time the row is being created
                row = $('<tr></tr>');
                row.prop('id', platformId);
            }else{
                // Clear and re-write the div content if it
                // already exists
                $(row).empty();
            }

            name = getPlatformName(resultset.platforms[j].name);
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

            platformKey = ThResultSetModel.getPlatformKey(
                resultset.platforms[j].name, resultset.platforms[j].option
                );

            renderJobTableRow(
                row, jobTdEl, resultset.platforms[j].groups,
                resultStatusFilters, resultset.id,
                platformKey, true
                );

            tableEl.append(row);
        }
        resetCounts(resultset);
    };

    var linker = function(scope, element, attrs){

        //Remove any jquery on() bindings
        element.off();

        //Register events callback
        element.on('mousedown', _.bind(jobMouseDown, scope));

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
                resultsetAggregateId, scope.resultset, scope.resultStatusFilters
                );
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
