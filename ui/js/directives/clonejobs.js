'use strict';

/* Directives */
treeherder.directive('thCloneJobs', function(
        $rootScope, $http, ThLog, thUrl, thCloneHtml, thServiceDomain,
        thResultStatusInfo, thEvents, thAggregateIds, thJobFilters,
        thResultStatusObject, ThResultSetModel){

    var $log = new ThLog("thCloneJobs");

    var lastJobElSelected, lastJobObjSelected;

    var classificationRequired = {
        "busted":1,
        "exception":1,
        "testfailed":1
        };

    // CSS classes
    var btnCls = 'btn-xs';
    var selectedBtnCls = 'selected-job';
    var largeBtnCls = 'btn-lg';

    var col4Cls = 'col-xs-4';
    var col8Cls = 'col-xs-8';
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
        var jobStatus = job.result;
        if (job.state !== "completed") {
            jobStatus = job.state;
        }
        var result = job.job_type_name + " - " + jobStatus;
        $log.debug("job timestamps", job, job.end_timestamp, job.submit_timestamp);
        if (job.end_timestamp && job.submit_timestamp) {
            var duration = Math.round((job.end_timestamp - job.submit_timestamp) / 60);
            result = result + " - " + duration + "mins";
        }
        return result;
    };

    //Global event listeners
    $rootScope.$on(
        thEvents.selectNextUnclassifiedFailure, function(ev){

            var jobMap = ThResultSetModel.getJobMap($rootScope.repoName);

            var targetEl, jobKey;
            if(!_.isEmpty(lastJobElSelected)){
                jobKey = getJobMapKey(lastJobObjSelected);
                getNextUnclassifiedFailure(jobMap[jobKey].job_obj);

            }else{
                //Select the first unclassified failure
                getNextUnclassifiedFailure({});
            }
    });

    $rootScope.$on(
        thEvents.selectPreviousUnclassifiedFailure, function(ev){

            var jobMap = ThResultSetModel.getJobMap($rootScope.repoName);

            var targetEl, jobKey;
            if(!_.isEmpty(lastJobElSelected)){
                jobKey = getJobMapKey(lastJobObjSelected);
                getPreviousUnclassifiedFailure(jobMap[jobKey].job_obj);

            }else{
                //Select the first unclassified failure
                getPreviousUnclassifiedFailure({});
            }

    });
    $rootScope.$on(
        thEvents.selectJob, function(ev, job){

        selectJob(job);

    });

    var selectJob = function(job){

        var jobKey = getJobMapKey(job);
        var jobEl = $('.' + jobKey);

        clickJobCb({}, jobEl, job);
        scrollToElement(jobEl);

        lastJobElSelected = jobEl;
        lastJobObjSelected = job;

    };

    var setSelectJobStyles = function(el){

        if(!_.isEmpty(lastJobElSelected)){
            lastJobElSelected.removeClass(selectedBtnCls);
            lastJobElSelected.removeClass(largeBtnCls);
            lastJobElSelected.addClass(btnCls);
        }

        el.removeClass(btnCls);
        el.addClass(largeBtnCls);
        el.addClass(selectedBtnCls);

    };

    var clickJobCb = function(ev, el, job){
        setSelectJobStyles(el);
        $rootScope.$broadcast(thEvents.jobClick, job);
    };

    var togglePinJobCb = function(ev, el, job){
        $rootScope.$broadcast(thEvents.jobPin, job);
    };

    var jobContextmenuCb = function(ev, el, job){

        ev.preventDefault();

        $http.get(thServiceDomain + job.resource_uri).
            success(function(data) {
                if (data.hasOwnProperty("artifacts")) {
                    data.artifacts.forEach(function(artifact) {
                        if (artifact.name === "Structured Log") {
                            window.open(thUrl.getLogViewerUrl(artifact.id));
                        }
                    });
                } else {
                    $log.warn("Job had no artifacts: " + job.resource_uri);
                }
            });
    };

    var addJobBtnEls = function(
        jgObj, jobBtnInterpolator, jobTdEl, resultStatusFilters, jobCounts){

        var showJob = false;
        var jobsShown = 0;

        var hText, key, resultState, job, jobStatus, jobBtn, l;

        for(l=0; l<jgObj.jobs.length; l++){

            job = jgObj.jobs[l];

            //Set the resultState
            resultState = job.result;
            if (job.state !== "completed") {
                resultState = job.state;
            }
            resultState = resultState || 'unknown';

            if(job.job_coalesced_to_guid !== null){
                // Don't count or render coalesced jobs
                continue;
            }

            //Increment the jobCounts here so they're not modified by
            //filtering
            jobCounts[resultState] += 1;

            job.searchableStr = getPlatformName(job.platform) + ' ' +
                job.platform_option + ' ' + job.job_group_name + ' ' +
                job.job_group_symbol + ' ' + job.job_type_name + ' ' +
                job.machine_name + ' ' + job.job_type_symbol;

            //Make sure that filtering doesn't effect the resultset counts
            //displayed
            if(thJobFilters.showJob(job, resultStatusFilters) === false){
                //Keep track of visibility with this property. This
                //way down stream job consumers don't need to repeatedly
                //call showJob
                job.visible = false;
                continue;
            }

            jobsShown++;

            job.visible = true;

            hText = getHoverText(job);
            key = getJobMapKey(job);

            jobStatus = thResultStatusInfo(resultState);

            jobStatus.key = key;
            if(parseInt(job.failure_classification_id, 10) > 1){
                jobStatus.value = job.job_type_symbol + '*';
            }else{
                jobStatus.value = job.job_type_symbol;
            }

            jobStatus.title = hText;
            jobStatus.btnClass = jobStatus.btnClass;

            jobBtn = $( jobBtnInterpolator(jobStatus) );

            jobTdEl.append(jobBtn);
        }

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
                    if (ev.shiftKey) {
                        _.bind(togglePinJobCb, this, ev, el, job)();
                    } else {
                        _.bind(clickJobCb, this, ev, el, job)();
                    }
                    break;
                case 2:
                    //Middle mouse button pressed
                    break;
                case 3:
                    //Right mouse button pressed
                    _.bind(jobContextmenuCb, this, ev, el, job)();
                    break;
                default:
                    //strange mouse detected
                    _.bind(clickJobCb, this, ev, el, job)();
            }

            lastJobElSelected = el;
            lastJobObjSelected = job;
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

                revisionHtml = revisionInterpolator(revision);
                ulEl.append(revisionHtml);
            }
        }
    };

    var toggleRevisions = function(element){

        var revisionsEl = element.find('ul').parent();
        var jobsEl = element.find('table').parent();

        var revElDisplayState = revisionsEl.css('display') || 'block';
        var jobsElDisplayState = jobsEl.css('display') || 'block';

        var rowEl = revisionsEl.parent();
        rowEl.css('display', 'block');

        if(revElDisplayState !== 'block'){

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
    var toggleJobs = function(element){

        var revisionsEl = element.find('ul').parent();
        var jobsEl = element.find('table').parent();

        var revElDisplayState = revisionsEl.css('display') || 'block';
        var jobsElDisplayState = jobsEl.css('display') || 'block';

        var rowEl = revisionsEl.parent();
        rowEl.css('display', 'block');

        if(jobsElDisplayState !== 'block'){

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
        el.addClass(col4Cls);
    };
    var toggleRevisionsSpanOnWithoutJobs = function(el){
        el.css('display', 'block');
        el.removeClass(col4Cls);
    };
    var toggleRevisionsSpanOff = function(el){
        el.css('display', 'none');
        el.removeClass(col4Cls);
    };
    var toggleJobsSpanOnWithRevisions = function(el){
        el.css('display', 'block');
        el.removeClass(jobListNoPadCls);
        el.removeClass(col12Cls);
        el.addClass(col8Cls);
        el.addClass(jobListPadLeftCls);
    };
    var toggleJobsSpanOnWithoutRevisions = function(el){
        el.css('display', 'block');
        el.removeClass(col8Cls);
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

        //If at least one job is visible we need to display the platform
        //otherwise hide it
        var jobsShownTotal = 0;

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
                    jgObj, jobBtnInterpolator, jobTdEl, resultStatusFilters,
                    jobCounts
                    );

                if(jobsShown > 0){
                    // Add the job group closure span
                    jobTdEl.append(
                        $( thCloneHtml.get('jobGroupEndClone').text )
                        );

                }else {
                    // No jobs were displayed in the group, hide
                    // the group symbol
                    jobGroup.hide();
                }

            }else{

                // Add the job btn spans
                jobsShown = addJobBtnEls(
                    jgObj, jobBtnInterpolator, jobTdEl, resultStatusFilters,
                    jobCounts
                    );

            }
            //Keep track of all of the jobs shown in a row
            jobsShownTotal += jobsShown;
        }

        if(jobsShownTotal === 0){
            //No jobs shown hide the whole row
            row.hide();
        }else{
            row.show();
        }

        row.append(jobTdEl);

        //reset the resultset counts for the platformKey
        resultSetMap[resultsetId].platforms[platformKey].job_counts = jobCounts;

        //re-total the counts across platforms
        resetCounts(resultSetMap);
    };

    var filterJobs = function(element, resultStatusFilters){

        var platformId, platformKey, rowEl, tdEls, i;

        for(i=0; i<this.resultset.platforms.length; i++){

            platformId = thAggregateIds.getPlatformRowId(
                $rootScope.repoName,
                this.resultset.id,
                this.resultset.platforms[i].name,
                this.resultset.platforms[i].option
                );

            rowEl = $( document.getElementById(platformId) );

            tdEls = rowEl.find('td');
            // tdEls[0] is the platform <td> and
            // tdEls[1] is the jobs <td>

            platformKey = ThResultSetModel.getPlatformKey(
                this.resultset.platforms[i].name, this.resultset.platforms[i].option
                );

            renderJobTableRow(
                rowEl, $(tdEls[1]), this.resultset.platforms[i].groups,
                resultStatusFilters, this.resultset.id, platformKey
                );
        }

    };

    var getPlatformName = function(name){

        var platformName = Config.OSNames[name];

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

    var resetCounts = function(resultSetMap){

        var resultSets = ThResultSetModel.getResultSetsArray($rootScope.repoName);

        var platformName, platformOption, platformKey, resultsetId, i;

        for(i=0; i<resultSets.length; i++){

            var jobCounts = thResultStatusObject.getResultStatusObject();

            var statusKeys = _.keys(jobCounts);
            jobCounts.total = 0;

            resultsetId = resultSets[i].id;

            var j;
            for(j=0; j<resultSets[i].platforms.length; j++){

                platformName = resultSets[i].platforms[j].name;
                platformOption = resultSets[i].platforms[j].option;

                platformKey = ThResultSetModel.getPlatformKey(
                    platformName, platformOption
                    );

                var statusPerPlatform = {};
                if(!_.isEmpty(resultSetMap[ resultsetId ].platforms[platformKey])){
                    statusPerPlatform = resultSetMap[ resultsetId ].platforms[platformKey].job_counts;
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

            resultSets[i].job_counts = jobCounts;
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

        var startWatch = false;
        if(_.isEmpty(currentJob)){
            startWatch = true;
        }

        var platforms, groups, jobs, r;
        superloop:
        for(r = 0; r < resultsets.length; r++){

            platforms = resultsets[r].platforms;
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

                        if(startWatch){
                            if( (jobs[j].visible === true) &&
                                (classificationRequired[jobs[j].result] === 1) &&
                                ( (parseInt(jobs[j].failure_classification_id, 10) === 1) ||
                                  (jobs[j].failure_classification_id === null)  )){

                                selectJob(jobs[j]);

                                //Next test failure found
                                break superloop;

                            }
                        }
                    }
                }
            }
        }
    };

    var getPreviousUnclassifiedFailure = function(currentJob){

        var resultsets = ThResultSetModel.getResultSetsArray($rootScope.repoName);

        var startWatch = false;
        if(_.isEmpty(currentJob)){
            startWatch = true;
        }

        var platforms, groups, jobs, r;

        superloop:
        for(r = resultsets.length - 1; r >= 0; r--){

            platforms = resultsets[r].platforms;
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
                        if(startWatch){
                            if( (jobs[j].visible === true) &&
                                (classificationRequired[jobs[j].result] === 1) &&
                                ( (parseInt(jobs[j].failure_classification_id, 10) === 1) ||
                                  (jobs[j].failure_classification_id === null)  )){

                                selectJob(jobs[j]);

                                //Previous test failure found
                                break superloop;
                            }
                        }
                    }
                }
            }
        }
    };

    var scrollToElement = function(el){

        if(el.offset() !== undefined){
            //Scroll to the job element
            $('html, body').animate({
                scrollTop: el.offset().top - 250
            }, 200);
        }

    };

    var registerCustomEventCallbacks = function(scope, element, attrs){

        //Register rootScope custom event listeners that require
        //access to the anguler level resultset scope
        //
        //NOTE: These event listeners are registered 1 per resultets
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
            thEvents.toggleRevisions, function(ev, rs){
                if(rs.id === scope.resultset.id){
                    _.bind(toggleRevisions, scope, element)();
                }
            });

        $rootScope.$on(
            thEvents.toggleJobs, function(ev, rs){
                if(rs.id === scope.resultset.id){
                    _.bind(toggleJobs, scope, element)();
                }
            });

        $rootScope.$on(
            thEvents.globalFilterChanged, function(ev, filterData){
                scope.resultStatusFilters = thJobFilters.copyResultStatusFilters();
                _.bind(filterJobs, scope, element, scope.resultStatusFilters)();
            });

        $rootScope.$on(
            thEvents.searchPage, function(ev, searchData){
                scope.resultStatusFilters = thJobFilters.copyResultStatusFilters();
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


    };

    var linker = function(scope, element, attrs){

        //Remove any jquery on() bindings
        element.off();

        //Register events callback
        element.on('mousedown', _.bind(jobMouseDown, scope));

        registerCustomEventCallbacks(scope, element, attrs);

        //Clone the target html
        var resultsetAggregateId = thAggregateIds.getResultsetTableId(
            $rootScope.repoName, scope.resultset.id, scope.resultset.revision
            );

        var targetEl = $(
            tableInterpolator({ aggregateId:resultsetAggregateId })
            );

        //Retrieve table el for appending
        var tableEl = targetEl.find('table');

        var name, option, platformId, platformKey, row, platformTd, jobTdEl,
            statusList, j;

        for(j=0; j<scope.resultset.platforms.length; j++){

            row = $('<tr></tr>');
            platformId = thAggregateIds.getPlatformRowId(
                $rootScope.repoName,
                scope.resultset.id,
                scope.resultset.platforms[j].name,
                scope.resultset.platforms[j].option
                );

            row.prop('id', platformId);

            name = getPlatformName(scope.resultset.platforms[j].name);
            option = scope.resultset.platforms[j].option;

            //Add platforms
            platformTd = platformInterpolator(
                {
                    'name':name, 'option':option,
                    'id':thAggregateIds.getPlatformRowId(
                        scope.resultset.id,
                        scope.resultset.platforms[j].name,
                        scope.resultset.platforms[j].option
                        )
                    }
                );

            row.append(platformTd);

            // Render the row of job data
            jobTdEl = $( thCloneHtml.get('jobTdClone').text );

            platformKey = ThResultSetModel.getPlatformKey(
                scope.resultset.platforms[j].name, scope.resultset.platforms[j].option
                );

            renderJobTableRow(
                row, jobTdEl, scope.resultset.platforms[j].groups,
                scope.resultStatusFilters, scope.resultset.id,
                platformKey, true
                );

            tableEl.append(row);
        }

        element.append(targetEl);
    };

    return {
        link:linker,
        replace:true
        };

});
