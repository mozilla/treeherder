'use strict';


treeherder.directive('thPinnedJob', [
    'thResultStatusInfo', 'thResultStatus',
    function (thResultStatusInfo, thResultStatus) {

    var getHoverText = function(job) {
        var duration = Math.round((job.end_timestamp - job.start_timestamp) / 60);
        var status = thResultStatus(job);
        return job.job_type_name + " - " + status + " - " + duration + "mins";
    };

    return {
        restrict: "E",
        link: function(scope, element, attrs) {
            var unbindWatcher = scope.$watch("job", function(newValue) {
                var resultState = thResultStatus(scope.job);
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
}]);

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

treeherder.directive('thFailureClassification', [
    '$parse', 'thClassificationTypes',
    function ($parse, thClassificationTypes) {
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
}]);

treeherder.directive('resizablePanel', [
    '$document', 'ThLog',
    function($document, ThLog) {
    return {
        restrict: "E",
        link: function(scope, element, attr) {
            var position  = attr.position || "top";
            var start = {x: 0, y: 0};
            var container = $(element.parent());

            var css_properties  = {
                position: 'absolute',
                cursor:'row-resize',
                'z-index': '100'
            };

            switch(position){
                case 'top':
                    css_properties.top = '-2px';
                    css_properties.width = '100%';
                    css_properties.height = '5px';
                    break;
                case 'bottom':
                    css_properties.bottom = '-2px';
                    css_properties.width = '100%';
                    css_properties.height = '5px';
                    break;
                case 'left':
                    css_properties.left = '-2px';
                    css_properties.height = '100%';
                    css_properties.width = '5px';
                    break;
                case 'right':
                    css_properties.right = '-2px';
                    css_properties.height = '100%';
                    css_properties.width = '5px';
                    break;
            }

            element.css(css_properties);

            element.on('mousedown', function(event) {
                // Prevent default dragging of selected content
                event.preventDefault();
                start.x = event.pageX;
                start.y = event.pageY;
                $document.on('mousemove', mousemove);
                $document.on('mouseup', mouseup);
            });

            function mousemove(event) {
                var distance = {
                    x: start.x - event.pageX,
                    y: start.y - event.pageY
                };
                switch(position){
                    case 'top':
                    case 'bottom':
                        container.height(container.height() + distance.y);
                        break;
                    case 'left':
                    case 'right':
                        container.width(container.width() + distance.x);
                        break;
                }

                start.x = event.pageX;
                start.y = event.pageY;
            }

            function mouseup() {
                $document.unbind('mousemove', mousemove);
                $document.unbind('mouseup', mouseup);

            }

        }
    };
}]);

treeherder.directive('thSimilarJobs', [
    'ThJobModel', 'ThLog',
    function(ThJobModel, ThLog){
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
                ThJobModel.get_list(scope.repoName, options).then(function(data){
                    scope.similar_jobs = data;
                });
            };
        }
    };
}]);

treeherder.directive('thPinboardPanel', function(){
    return {
        restrict: "E",
        templateUrl: "partials/thPinboardPanel.html"
    };
});
