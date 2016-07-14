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
                    scope.job.display = thResultStatusInfo(resultState, scope.job.failure_classification_id);
                    scope.hoverText = getHoverText(scope.job);

                    if (scope.job.state === "completed") {
                        //Remove watchers when a job has a completed status
                        unbindWatcher();
                    }

                }, true);
            },
            templateUrl: 'partials/main/thPinnedJob.html'
        };
    }]);

treeherder.directive('thRelatedBugSaved', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/main/thRelatedBugSaved.html'
    };
});

treeherder.directive('thRelatedBugQueued', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/main/thRelatedBugQueued.html'
    };
});

treeherder.directive('thFailureClassification', [
    '$parse', 'thClassificationTypes',
    function ($parse, thClassificationTypes) {
        return {
            scope: {
                failureId: "=",
                jobResult: "="
            },
            link: function(scope, element, attrs) {
                scope.$watch('[failureId, jobResult]', function() {
                    if (scope.failureId) {
                        scope.classification = thClassificationTypes.classifications[scope.failureId];
                        scope.hoverText=scope.classification.name;
                        scope.iconCls = (scope.failureId === 7 ? "glyphicon-star-empty" : "glyphicon glyphicon-star") +
                                         " star-" + scope.jobResult;
                    }
                });
            },
            template: '<span title="{{hoverText}}">' +
                '<i class="glyphicon {{iconCls}}"></i>' +
                '</span> {{hoverText}}'
        };
    }]);

treeherder.directive('thSimilarJobs', [
    'ThJobModel', 'ThLog',
    function(ThJobModel, ThLog){
        return {
            restrict: "E",
            templateUrl: "partials/main/similar_jobs.html",
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
        templateUrl: "partials/main/thPinboardPanel.html"
    };
});
