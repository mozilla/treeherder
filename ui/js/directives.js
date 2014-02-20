'use strict';

/* Directives */
treeherder.directive('thCloneJobs', function(
        $rootScope, $compile, $http, $log, $interpolate,
        thUrl, thServiceDomain, thResultStatusInfo){

    var lastJobElSelected = {};

    // CSS classes
    var btnCls = 'btn-xs';
    var selectedBtnCls = 'selected-job';
    var largeBtnCls = 'btn-lg';

    // CSS class selectors
    var jobsCloneTargetClsSel = '.th-jobs-clone-target';
    var revisionAttSiteClsSel = '.th-revision-att-site';

    // Events
    var jobClickEvt = 'job-click-EVT';
    var jobContextmenuEvt = 'job-contextmenu-EVT';

    // Custom Attributes
    var jobKeyAttr = 'data-jmkey';

    // HTML Templates
    var revisionLiHtml = '<li><th-revision></th-revision></li>';

    var platformHtml = '<td class="col-xs-2 platform">' +
                            '<span>{{ name }} {{ option }} </span>' +
                       '</td>';

    var jobGroupAttHtml = '<td class="col-xs-10"></td>';

    var jobGroupBeginHtml = '<span style="margin-right:6px;" class="platform-group">' +
                            '<span class="disabled job-group" title="{{ name }}">' +
                            '{{ symbol }}(</span></span>';

    var jobGroupEndHtml = '<span class="job-group-r-paren">)</span>';

    var jobBtnHtml = '<span style="margin-right:1px;" ' +
                     'class="btn job-btn btn-xs {{ btn_class }}" ' +
                     'data-jmkey="{{ key }}" title="{{ title }}" ' +
                     '>{{ value }}</span>';


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
        $rootScope.$broadcast(jobClickEvt, job);
    };

    var jobContextmenuCb = function(ev, el, job){

        ev.preventDefault();

        var job_uri = job.resource_uri;

        $http.get(thServiceDomain + job_uri).
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

    var addJobBtnEls = function(jgObj, jobBtnInterpolator, jobGroupAttEl){

        var l = 0;
        var hText, key, resultState = "";
        var job, jobStatus, jobBtn = {};

        for(; l<jgObj.jobs.length; l++){

            job = jgObj.jobs[l];

            if(job.job_coalesced_to_guid != undefined){
                // Don't render coalesced jobs
                continue;
            }

            hText = getHoverText(job);
            key = getJobMapKey(job);

            resultState = job.result;
            if (job.state != "completed") {
                resultState = job.state;
            }

            jobStatus = thResultStatusInfo(resultState);

            jobStatus['key'] = key;
            jobStatus['value'] = job.job_type_symbol;
            jobStatus['title'] = hText;
            jobStatus['btn_class'] = jobStatus.btnClass;

            jobBtn = $( jobBtnInterpolator(jobStatus) );

            jobGroupAttEl.append(jobBtn);
        }
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

        console.log(resultset.revisions);
        //if(revisions.length > 0){

            //var ulEl = element.find(revisionAttSiteClsSel);
            //for(var i=0; i<revisions.length; i++){
            //    ulEl.append( revisionLiHtml );
            //}
        //}
    };

    var linker = function(scope, element, attrs){

        //Remove any jquery on() bindings
        element.off();

        //Register events callback
        element.on('mousedown', _.bind(jobMouseDown, scope));

        $rootScope.$on(
            'revisions-loaded-EVT', function(ev, rs){

                if(rs.id === scope.resultset.id){
                    _.bind(addRevisions, scope, rs, element)();
                }
            }
            );

        //Clone the target html
        var targetEl = $( $(jobsCloneTargetClsSel).html() );

        //Instantiate platform interpolator
        var tableEl = targetEl.find('table');
        var platformInterpolator = $interpolate(platformHtml);

        //Instantiate job group interpolator
        var jobGroupInterpolator = $interpolate(jobGroupBeginHtml);

        //Instantiate job btn interpolator
        var jobBtnInterpolator = $interpolate(jobBtnHtml);

        var j = 0;
        var name, option = "";
        var row, platformTd, jobGroupAttEl = {};

        for(; j<scope.resultset.platforms.length; j++){

            row = $('<tr></tr>');

            name = Config.OSNames[scope.resultset.platforms[j].name];
            option = scope.resultset.platforms[j].option;

            if(name === undefined){
                name = scope.resultset.platforms[j].name;
            }
            //Add platforms
            platformTd = platformInterpolator(
                {'name':name, 'option':option}
                );

            //Retrieve job group attachment element
            jobGroupAttEl = $(jobGroupAttHtml);

            var k = 0;
            var jgObj = {};
            var jobGroup = "";

            for(; k<scope.resultset.platforms[j].groups.length; k++){

                jgObj = scope.resultset.platforms[j].groups[k];

                if(jgObj.symbol != '?'){
                    // Job group detected, add job group symbols
                    jobGroup = jobGroupInterpolator(
                        scope.resultset.platforms[j].groups[k]
                        );

                    jobGroupAttEl.append(jobGroup);

                    // Add the job btn spans
                    addJobBtnEls(
                        jgObj, jobBtnInterpolator, jobGroupAttEl
                        );

                    // Add the job group closure span
                    jobGroupAttEl.append(jobGroupEndHtml);

                }else{

                    // Add the job btn spans
                    addJobBtnEls(
                        jgObj, jobBtnInterpolator, jobGroupAttEl
                        );
                }
            }

            row.append(platformTd);
            row.append(jobGroupAttEl);
            tableEl.append(row);
        }

        element.append(targetEl);

        //NOTE: If compile is called here it will set up all
        // ng-* directives but it's SLOOOOOOOOOW
        //$compile(element.contents())(scope);
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

