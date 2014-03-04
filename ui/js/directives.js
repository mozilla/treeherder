'use strict';

/* Directives */
treeherder.directive('thCloneJobs', function(
        $rootScope, $http, $log, thUrl, thCloneHtml, thServiceDomain,
        thResultStatusInfo, thEvents, thAggregateIds, thJobFilters,
        thResultStatusObject, ThResultSetModel){

    var lastJobElSelected = {};

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
        var duration = Math.round((job.end_timestamp - job.submit_timestamp) / 60);
        var jobStatus = job.result;
        if (job.state != "completed") {
            jobStatus = job.state;
        }
        return job.job_type_name + " - " + jobStatus + " - " + duration + "mins";
    };

    var selectJob = function(el){

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
        selectJob(el);
        $rootScope.$broadcast(thEvents.jobClick, job);
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
                    $log.warn("Job had no artifacts: " + job_uri);
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
            if (job.state != "completed") {
                resultState = job.state;
            }
            resultState = resultState || 'unknown';

            if(job.job_coalesced_to_guid != null){
                // Don't count or render coalesced jobs
                continue;
            }

            //Increment the jobCounts here so they're not modified by
            //filtering
            jobCounts[resultState] += 1;

            //Make sure that filtering doesn't effect the resultset counts
            //displayed
            if(thJobFilters.showJob(job, resultStatusFilters) === false){
                continue;
            }

            jobsShown++;

            hText = getHoverText(job);
            key = getJobMapKey(job);

            jobStatus = thResultStatusInfo(resultState);

            jobStatus['key'] = key;

            if(job.failure_classification_id != null){
                jobStatus['value'] = '*' + job.job_type_symbol;
            }else{
                jobStatus['value'] = job.job_type_symbol;
            }

            jobStatus['title'] = hText;
            jobStatus['btnClass'] = jobStatus.btnClass;

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
                    _.bind(clickJobCb, this, ev, el, job)();
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

                userTokens = revision.author.split(/[<>]+/);
                if (userTokens.length > 1) {
                    revision['email'] = userTokens[1];
                }
                revision['name'] = userTokens[0].trim();

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

        if(revElDisplayState != 'block'){

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

        if(jobsElDisplayState != 'block'){

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

        var resultSetMap = ThResultSetModel.getResultSetsMap();

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
            if(jgObj.symbol != '?'){
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

        var resultSets = ThResultSetModel.getResultSetsArray();

        var platformName, platformOption, platformKey, resultsetId, i;

        for(i=0; i<resultSets.length; i++){

            var jobCounts = thResultStatusObject.getResultStatusObject();

            var statusKeys = _.keys(jobCounts);
            jobCounts['total'] = 0;

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
                        jobCounts['total'] += statusPerPlatform[jobStatus];
                    }
                }
            }

            resultSets[i].job_counts = jobCounts;
        }
    };

    var updateJobs = function(ev, platformData){

        angular.forEach(platformData, function(value, platformId){

            if(value.resultsetId != this.resultset.id){
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
        });
    };

    var linker = function(scope, element, attrs){

        //Remove any jquery on() bindings
        element.off();

        //Register events callback
        element.on('mousedown', _.bind(jobMouseDown, scope));

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
    }

    return {
        link:linker,
        replace:true
        }

});
treeherder.directive('thGlobalTopNavPanel', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thGlobalTopNavPanel.html'
    };
});

treeherder.directive('thWatchedRepoPanel', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thWatchedRepoPanel.html'
    };
});

treeherder.directive('thStatusFilterPanel', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thStatusFilterPanel.html'
    };
});

treeherder.directive('thRepoPanel', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thRepoPanel.html'
    };
});

treeherder.directive('thFilterCheckbox', function (thResultStatusInfo) {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            scope.checkClass = thResultStatusInfo(scope.filterName).btnClass + "-count-classified";
        },
        templateUrl: 'partials/thFilterCheckbox.html'
    };
});

treeherder.directive('ngRightClick', function($parse) {
    return function(scope, element, attrs) {
        var fn = $parse(attrs.ngRightClick);
        element.bind('contextmenu', function(event) {
            scope.$apply(function() {
                event.preventDefault();
                fn(scope, {$event:event});
            });
        });
    };
});

treeherder.directive('thJobButton', function (thResultStatusInfo) {

    var getHoverText = function(job) {
        var duration = Math.round((job.end_timestamp - job.submit_timestamp) / 60);
        var status = job.result;
        if (job.state != "completed") {
            status = job.state;
        }
        return job.job_type_name + " - " + status + " - " + duration + "mins";
    };

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            var unbindWatcher = scope.$watch("job", function(newValue) {
                var resultState = scope.job.result;
                if (scope.job.state != "completed") {
                    resultState = scope.job.state;
                }
                scope.job.display = thResultStatusInfo(resultState);
                scope.hoverText = getHoverText(scope.job);

                if (scope.job.state == "completed") {
                    //Remove watchers when a job has a completed status
                    unbindWatcher();
                }

            }, true);
        },
        templateUrl: 'partials/thJobButton.html'
    };


});

treeherder.directive('thActionButton', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thActionButton.html'
    };
});

treeherder.directive('thResultCounts', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thResultCounts.html'
    };
});

treeherder.directive('thResultStatusCount', function () {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            scope.resultCountText = scope.getCountText(scope.resultStatus);
            scope.resultStatusCountClassPrefix = scope.getCountClass(scope.resultStatus)

            // @@@ this will change once we have classifying implemented
            scope.resultCount = scope.resultset.job_counts[scope.resultStatus];
            scope.unclassifiedResultCount = scope.resultCount;
            var getCountAlertClass = function() {
                if (scope.unclassifiedResultCount) {
                    return scope.resultStatusCountClassPrefix + "-count-unclassified";
                } else {
                    return scope.resultStatusCountClassPrefix + "-count-classified";
                }
            }
            scope.countAlertClass = getCountAlertClass();

            scope.$watch("resultset.job_counts", function(newValue) {
                scope.resultCount = scope.resultset.job_counts[scope.resultStatus];
                scope.unclassifiedResultCount = scope.resultCount;
                scope.countAlertClass = getCountAlertClass();
            }, true);

        },
        templateUrl: 'partials/thResultStatusCount.html'
    };
});


treeherder.directive('thAuthor', function () {

    return {
        restrict: "E",
        scope: {
            author: '=author'
        },
        link: function(scope, element, attrs) {
            var userTokens = scope.author.split(/[<>]+/);
            var email = "";
            if (userTokens.length > 1) {
                email = userTokens[1];
            }
            scope.authorName = userTokens[0].trim();
            scope.authorEmail = email;
        },
        template: '<span title="{{authorName}}: {{authorEmail}}">{{authorName}}</span>'
    };
});


// allow an input on a form to request focus when the value it sets in its
// ``focus-me`` directive is true.  You can set ``focus-me="focusInput"`` and
// when ``$scope.focusInput`` changes to true, it will request focus on
// the element with this directive.
treeherder.directive('focusMe', function($timeout) {
  return {
    link: function(scope, element, attrs) {
      scope.$watch(attrs.focusMe, function(value) {
        if(value === true) {
          $timeout(function() {
            element[0].focus();
            scope[attrs.focusMe] = false;
          }, 0);
        }
      });
    }
  };
});

treeherder.directive('thStar', function ($parse, thStarTypes) {
    return {
        scope: {
            starId: "="
        },
        link: function(scope, element, attrs) {
            scope.$watch('starId', function(newVal) {
                if (newVal !== undefined) {
                    scope.starType = thStarTypes[newVal];
                    scope.badgeColorClass=scope.starType.star;
                    scope.hoverText=scope.starType.name;
                }
            });
        },
        template: '<span class="label {{ badgeColorClass}}" ' +
                        'title="{{ hoverText }}">' +
                        '<i class="glyphicon glyphicon-star-empty"></i>' +
                        '</span>'
    };
});

treeherder.directive('thShowJobs', function ($parse, thResultStatusInfo) {
    return {
        link: function(scope, element, attrs) {
            scope.$watch('resultSeverity', function(newVal) {
                if (newVal) {
                    var rsInfo = thResultStatusInfo(newVal)
                    scope.resultsetStateBtn = rsInfo.btnClass;
                    scope.icon = rsInfo.showButtonIcon;
                }
            });
        },
        template: '<a class="btn {{ resultsetStateBtn }} th-show-jobs-button pull-left" ' +
                       'ng-click="isCollapsedResults = !isCollapsedResults">' +
                       '<i class="{{ icon }}"></i> ' +
                       '{{ \' jobs\' | showOrHide:isCollapsedResults }}</a>'
    };
});

treeherder.directive('thRevision', function($parse) {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            scope.$watch('resultset.revisions', function(newVal) {
                if (newVal) {
                    scope.revisionUrl = scope.currentRepo.url + "/rev/" + scope.revision.revision;
                }
            }, true);
        },
        templateUrl: 'partials/thRevision.html'
    };
});


treeherder.directive('resizablePanel', function($document, $log) {
    return {
        restrict: "E",
        link: function(scope, element, attr) {
            var startY = 0
            var container = $(element.parent());

            element.css({
                position: 'absolute',
                cursor:'row-resize',
                top:'-2px',
                width: '100%',
                height: '5px',
                'z-index': '100'

            });

            element.on('mousedown', function(event) {
                // Prevent default dragging of selected content
                event.preventDefault();
                startY = event.pageY;
                $document.on('mousemove', mousemove);
                $document.on('mouseup', mouseup);
            });

            function mousemove(event) {
                var y = startY - event.pageY;
                startY = event.pageY;
                container.height(container.height() + y);

            }

            function mouseup() {
                $document.unbind('mousemove', mousemove);
                $document.unbind('mouseup', mouseup);

            }

        }
    };
});

treeherder.directive('personaButtons', function($http, $q, $log, $rootScope, localStorageService, thServiceDomain, BrowserId) {

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            localStorageService.clearAll()
            scope.user = scope.user || {};
            // check if already know who the current user is
            // if the user.email value is null, it means that he's not logged in
            scope.user.email = scope.user.email || localStorageService.get('user.email');
            scope.user.loggedin =  scope.user.email == null ? false : true;

            scope.login = function(){
                /*
                * BrowserID.login returns a promise of the verification.
                * If successful, we will find the user email in the response
                */
                BrowserId.login()
                .then(function(response){
                    scope.user.loggedin = true;
                    scope.user.email = response.data.email;
                    localStorageService.add('user.email', scope.user.email);
                },function(){
                    // logout if the verification failed
                    scope.logout();
                });
            };
            scope.logout = function(){
                BrowserId.logout().then(function(response){
                    scope.user.loggedin = false;
                    scope.user.email = null;
                    localStorageService.remove('user.loggedin');
                    localStorageService.remove('user.email');
                });
            };


            navigator.id.watch({
                /*
                * loggedinUser is all that we know about the user before
                * the interaction with persona. This value could come from a cookie to persist the authentication
                * among page reloads. If the value is null, the user is considered logged out.
                */

                loggedInUser: scope.user.email,
                /*
                * We need a watch call to interact with persona.
                * onLogin is called when persona provides an assertion
                * This is the only way we can know the assertion from persona,
                * so we resolve BrowserId.requestDeferred with the assertion retrieved
                */
                onlogin: function(assertion){
                    if (BrowserId.requestDeferred) {
                        BrowserId.requestDeferred.resolve(assertion);
                    }
                },

                /*
                * Resolve BrowserId.logoutDeferred once the user is logged out from persona
                */
                onlogout: function(){
                    if (BrowserId.logoutDeferred) {
                        BrowserId.logoutDeferred.resolve();
                    }
                }
            });
        },
        templateUrl: 'partials/persona_buttons.html'
    };
});

treeherder.directive('thSimilarJobs', function(ThJobModel, $log){
    return {
        restrict: "E",
        templateUrl: "partials/similar_jobs.html",
        link: function(scope, element, attr) {
            scope.$watch('job', function(newVal, oldVal){
                $log.log(newVal);
                if(newVal){
                    scope.update_similar_jobs(newVal);
                }
            });
            scope.similar_jobs = []
            scope.similar_jobs_filters = {
                "machine_id": true,
                "job_type_id": true,
                "build_platform_id": true
            }
            scope.update_similar_jobs = function(job){
                $log.log("updating similar jobs")
                var options = {result_set_id__ne: job.result_set_id};
                angular.forEach(scope.similar_jobs_filters, function(elem, key){
                    if(elem){
                        options[key] = job[key];
                    }
                });
                ThJobModel.get_list(options).then(function(data){
                    scope.similar_jobs = data;
                });
            };
        }
    }
});

treeherder.directive('thNotificationBox', function($log, thNotify){
    return {
        restrict: "E",
        template: '<div id="notification_box" ng-class="notify.current.severity" ng-if="notify.current.message">' +
                    '<p>{{notify.current.message}}' +
                    '<a ng-click="notify.clear()" ng-if="notify.current.sticky" title="close" class="close">x</a></p>' +
                  '</div>',
        link: function(scope, element, attr) {
            scope.notify = thNotify;
        }
    }
});
