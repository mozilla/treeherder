"use strict";

treeherder.controller('AnnotationsPluginCtrl',
    function AnnotationsPluginCtrl($scope, $rootScope, $log, ThJobClassificationModel,
                                   thNotify, thEvents, ThResultSetModel, ThBugJobMapModel) {
        $log.debug("annotations plugin initialized");

        $scope.$watch('classifications', function(newValue, oldValue){

            $scope.tabs.annotations.num_items = newValue ? $scope.classifications.length : 0;
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
);
