import { getBtnClass, getStatus } from "../../../helpers/jobHelper";

treeherder.directive('thPinnedJob', function () {

    var getHoverText = function (job) {
        var duration = Math.round((job.end_timestamp - job.start_timestamp) / 60);
        var status = getStatus(job);
        return job.job_type_name + " - " + status + " - " + duration + "mins";
    };

    return {
        restrict: "E",
        link: function (scope) {
            var unbindWatcher = scope.$watch("job", function () {
                var resultState = getStatus(scope.job);
                scope.job.btnClass = getBtnClass(resultState, scope.job.failure_classification_id);
                scope.hoverText = getHoverText(scope.job);

                if (scope.job.state === "completed") {
                    //Remove watchers when a job has a completed status
                    unbindWatcher();
                }

            }, true);
        },
        templateUrl: 'partials/main/thPinnedJob.html'
    };
});

treeherder.directive('thRelatedBugQueued', function () {

    return {
        restrict: "E",
        templateUrl: 'partials/main/thRelatedBugQueued.html'
    };
});
