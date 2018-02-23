treeherder.controller('AnnotationsPluginCtrl', [
    '$scope', '$rootScope', 'thNotify',
    'thEvents', 'ThResultSetStore', 'thTabs',
    function AnnotationsPluginCtrl(
        $scope, $rootScope, thNotify,
        thEvents, ThResultSetStore, thTabs) {

        $scope.$watch('classifications', function (newValue) {
            thTabs.tabs.annotations.num_items = newValue ? $scope.classifications.length : 0;
        }, true);

        $rootScope.$on(thEvents.deleteClassification, function () {
            if ($scope.classifications[0]) {
                $scope.deleteClassification($scope.classifications[0]);

                // Delete any number of bugs if they exist
                for (var i = 0; i < $scope.bugs.length; i++) {
                    $scope.deleteBug($scope.bugs[i]);
                }
            } else {
                thNotify.send("No classification on this job to delete", 'warning');
            }
        });

        $scope.deleteClassification = function (classification) {

            var key = `${classification.job_id}`;
            var jobMap = ThResultSetStore.getJobMap();
            var job = jobMap[key].job_obj;

            // this $evalAsync will be sure that the * is added or removed in
            // the job in the jobs table when this change takes place.
            $scope.$evalAsync(function () { job.failure_classification_id = 1; });
            ThResultSetStore.updateUnclassifiedFailureMap(job);

            classification.delete()
                .then(
                    function () {
                        thNotify.send("Classification successfully deleted", "success");
                        var jobs = {};
                        jobs[$scope.selectedJob.id] = $scope.selectedJob;

                        // also be sure the job object in question gets updated to the latest
                        // classification state (in case one was added or removed).
                        ThResultSetStore.fetchJobs([$scope.job.id]);

                        $rootScope.$emit(thEvents.jobsClassified, { jobs: jobs });
                    },
                    function () {
                        thNotify.send("Classification deletion failed", "danger", { sticky: true });
                    }
                );
        };

        $scope.deleteBug = function (bug) {
            bug.delete()
                .then(
                    function () {
                        thNotify.send("Association to bug " + bug.bug_id + " successfully deleted", "success");
                        var jobs = {};
                        jobs[$scope.selectedJob.id] = $scope.selectedJob;

                        $rootScope.$emit(thEvents.bugsAssociated, { jobs: jobs });
                    },
                    function () {
                        thNotify.send("Association to bug " + bug.bug_id + " deletion failed", "danger", { sticky: true });
                    }
                );
        };
    }
]);
