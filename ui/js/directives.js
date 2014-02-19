'use strict';

/* Directives */
treeherder.directive('thCloneJobs', function($compile, $interpolate, thResultStatusInfo){

    var revisionLiHtml = '<li><th-revision></th-revision></li>';

    var platformHtml = '<td class="col-xs-2 platform">' +
                            '<span>{{ name }} {{ option }} </span>' +
                       '</td>';

    var jobGroupAttHtml = '<td class="col-xs-10"></td>';

    var jobGroupBeginHtml = '<span style="margin-right:6px;" class="platform-group">' +
                            '<span class="disabled job-group" title="{{ name }}">{{ symbol }}(</span>' +
                            '</span>';

    var jobGroupEndHtml = '<span class="job-group-r-paren">)</span>';

    var jobBtnHtml = '<span style="margin-right:1px;" class="btn job-btn btn-xs" data-job-id="" ' +
                     'ng-right-click="viewLog(job_map.{{ key }}.resource_uri)" ' +
                     'ng-hide="job_map.{{ key }}.job_coalesced_to_guid" ' +
                     'ng-click="viewJob(job_map.{{ key }})" ng-class="' +
                    "{\'btn-lg selected-job\': (selectedJob==job_map.{{key}}), " +
                    "\'btn-xs\': (selectedJob!=job)}\"" +
                    "></span></span>";

    var getJobMapKey = function(job){
        return 'key' + job.id;
        };

    var getHoverText = function(job) {
        var duration = Math.round((job.end_timestamp - job.submit_timestamp) / 60);
        var status = job.result;
        if (job.state != "completed") {
            status = job.state;
        }
        return job.job_type_name + " - " + status + " - " + duration + "mins";
    };

    var addJobBtnEls = function(jgObj, jobBtnInterpolator, jobGroupAttEl){

        var job = {};
        var hText = "";
        var key = "";
        var jobStatus = {};
        var jobBtn = {};
        var resultState = "";
        var l = 0;

        for(; l<jgObj.jobs.length; l++){

            job = jgObj.jobs[l];
            hText = getHoverText(job);
            key = getJobMapKey(job);

            resultState = job.result;
            if (job.state != "completed") {
                resultState = job.state;
            }

            jobStatus = thResultStatusInfo(resultState);

            jobStatus['key'] = key;

            jobBtn = $( jobBtnInterpolator(jobStatus) );

            jobBtn.addClass(jobStatus.btnClass);
            jobBtn.text(job.job_type_symbol);
            jobBtn.prop('title', hText);

            jobGroupAttEl.append(jobBtn);
        }
    };

    var linker = function(scope, element, attrs){
        var jobWatcher = function(newValue) {
            var resultState = scope.job.result;
            if (scope.job.state != "completed") {
                resultState = scope.job.state;
            }
            scope.job.display = thResultStatusInfo(resultState);
            scope.hoverText = getHoverText(scope.job);

            if (scope.job.state == "completed") {
                //Remove watchers when a job has a completed status
                //unbindWatcher();
            }
        };

        //Clone the target html
        var targetEl = $( $('.th-jobs-clone-target').html() );

        //Add revisions
        var ulEl = targetEl.find('.th-revision-att-site');

        for(var i=0; i<scope.resultset.revisions.length; i++){
            ulEl.append( revisionLiHtml );
        }

        //Instantiate platform interpolator
        var tableEl = targetEl.find('table');
        var platformInterpolator = $interpolate(platformHtml);

        //Instantiate job group interpolator
        var jobGroupInterpolator = $interpolate(jobGroupBeginHtml);

        //Instantiate job btn interpolator
        var jobBtnInterpolator = $interpolate(jobBtnHtml);

        scope.resultset.platforms.sort();
        for(var j=0; j<scope.resultset.platforms.length; j++){

            var row = $('<tr></tr>');

            var name = Config.OSNames[name] ||
                scope.resultset.platforms[j].name;

            //Add platforms
            var platformTd = platformInterpolator({'name':name});

            //Retrieve job group attachment element
            var jobGroupAttEl = $(jobGroupAttHtml);

            for(var k=0; k<scope.resultset.platforms[j].groups.length; k++){

                var jgObj = scope.resultset.platforms[j].groups[k];

                if(jgObj.symbol != '?'){
                    var jobGroup = jobGroupInterpolator(
                        scope.resultset.platforms[j].groups[k]
                        );
                    jobGroupAttEl.append(jobGroup);

                    addJobBtnEls(
                        jgObj, jobBtnInterpolator, jobGroupAttEl
                        );
//result === 'success' and state === 'completed'

                    jobGroupAttEl.append(jobGroupEndHtml);
                }else{

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

        //$compile(element.contents())(scope);
    }

    return {
        link:linker,
        replace:true
        }

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

