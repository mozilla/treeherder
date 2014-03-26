'use strict';


treeherder.directive('thPinnedJob', function (thResultStatusInfo) {

    var getHoverText = function(job) {
        var duration = Math.round((job.end_timestamp - job.start_timestamp) / 60);
        var status = job.result;
        if (job.state !== "completed") {
            status = job.state;
        }
        return job.job_type_name + " - " + status + " - " + duration + "mins";
    };

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            var unbindWatcher = scope.$watch("job", function(newValue) {
                var resultState = scope.job.result;
                if (scope.job.state !== "completed") {
                    resultState = scope.job.state;
                }
                scope.job.display = thResultStatusInfo(resultState);
                scope.hoverText = getHoverText(scope.job);

                if (scope.job.state === "completed") {
                    //Remove watchers when a job has a completed status
                    unbindWatcher();
                }

            }, true);
        },
        templateUrl: 'partials/thPinnedJob.html'
    };
});

treeherder.directive('thRelatedBugSaved', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thRelatedBugSaved.html'
    };
});

treeherder.directive('thRelatedBugQueued', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/thRelatedBugQueued.html'
    };
});

treeherder.directive('thFailureClassification', function ($parse, thClassificationTypes) {
    return {
        scope: {
            failureId: "="
        },
        link: function(scope, element, attrs) {
            scope.$watch('failureId', function(newVal) {
                if (newVal) {
                    scope.classification = thClassificationTypes.classifications[newVal];
                    scope.badgeColorClass=scope.classification.star;
                    scope.hoverText=scope.classification.name;
                }
            });
        },
        template: '<span class="label {{ badgeColorClass}}" ' +
                        'title="{{ hoverText }}">' +
                        '<i class="glyphicon glyphicon-star-empty"></i>' +
                        '</span> {{ hoverText }}'
    };
});

treeherder.directive('resizablePanel', function($document, ThLog) {
    return {
        restrict: "E",
        link: function(scope, element, attr) {
            var startY = 0;
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

treeherder.directive('thSimilarJobs', function(ThJobModel, ThLog){
    return {
        restrict: "E",
        templateUrl: "partials/similar_jobs.html",
        link: function(scope, element, attr) {
            scope.$watch('job', function(newVal, oldVal){
                if(newVal){
                    scope.update_similar_jobs(newVal);
                }
            });
            scope.similar_jobs = [];
            scope.similar_jobs_filters = {
                "machine_id": true,
                "job_type_id": true,
                "build_platform_id": true
            };
            scope.update_similar_jobs = function(job){
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
    };
});

treeherder.directive('thPinboardPanel', function(){
    return {
        restrict: "E",
        templateUrl: "partials/thPinboardPanel.html"
    };
});
