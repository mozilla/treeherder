"use strict";

treeherder.controller('AnnotationsPluginCtrl', [
    '$scope', '$rootScope', 'ThLog', 'ThJobClassificationModel', 'thNotify',
    'thEvents', 'ThResultSetModel', 'ThBugJobMapModel', 'thTabs',
    function AnnotationsPluginCtrl(
        $scope, $rootScope, ThLog, ThJobClassificationModel,
        thNotify, thEvents, ThResultSetModel, ThBugJobMapModel, thTabs) {

        var $log = new ThLog(this.constructor.name);

        $log.debug("annotations plugin initialized");

        $scope.$watch('classifications', function(newValue, oldValue){

            thTabs.tabs.annotations.num_items = newValue ? $scope.classifications.length : 0;
        }, true);

        $scope.deleteClassification = function(classification) {
            var jcModel = new ThJobClassificationModel(classification);
            jcModel.delete()
                .then(
                    function(){
                        thNotify.send("Classification successfully deleted", "success", false);
                        var jobs = {};
                        jobs[$scope.selectedJob.id] = $scope.selectedJob;

                        // also be sure the job object in question gets updated to the latest
                        // classification state (in case one was added or removed).
                        ThResultSetModel.fetchJobs($scope.repoName, [$scope.job.id]);

                        $rootScope.$broadcast(thEvents.jobsClassified, {jobs: jobs});
                    },
                    function(){
                        thNotify.send("Classification deletion failed", "danger", true);
                    }
                );
        };

        $scope.deleteBug = function(bug) {
            var bjmModel = new ThBugJobMapModel(bug);
            bjmModel.delete()
                .then(
                    function(){
                        thNotify.send("Association to bug " + bug.bug_id + " successfully deleted", "success", false);
                        var jobs = {};
                        jobs[$scope.selectedJob.id] = $scope.selectedJob;

                        $rootScope.$broadcast(thEvents.bugsAssociated, {jobs: jobs});
                    },
                    function(){
                        thNotify.send("Association to bug " + bug.bug_id + " deletion failed", "danger", true);
                    }
                );
        };
    }
]);
