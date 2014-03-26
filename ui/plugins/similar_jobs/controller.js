"use strict";

treeherder.controller('SimilarJobsPluginCtrl',
    function SimilarJobsPluginCtrl($scope, ThLog, $rootScope, ThJobModel, thResultStatusInfo, thEvents,
                                   numberFilter, dateFilter, thClassificationTypes, thResultStatus,
                                   ThJobArtifactModel) {
        var thLog = new ThLog(this.constructor.name);

        thLog.debug("similar jobs plugin initialized");

        // do the jobs retrieval based on the user selection
        $scope.get_similar_jobs = function(){
            var options = {
                    count: $scope.similar_jobs_count
                };
                angular.forEach($scope.similar_jobs_filters, function(value, key){
                    if(value){
                        options[key] = $scope.job[key];
                    }
                });
                thLog.log(options);
                ThJobModel.get_list(options).then(function(data){
                    thLog.log(data);
                    $scope.similar_jobs = data;
                });
        };

        // reset the counter and retrieve the list of jobs
        $scope.update_similar_jobs = function(event) {
            if($scope.job){
                $scope.similar_jobs_count = 20;
                $scope.similar_job_selected = null;
            }
            if($scope.job.id){
                $scope.get_similar_jobs();

            }
        };

        $scope.result_status_info = thResultStatusInfo;
        $scope.$on(thEvents.jobDetailLoaded, $scope.update_similar_jobs);
        $scope.similar_jobs = [];
        $scope.similar_jobs_filters = {
            "machine_id": false,
            "job_type_id": true,
            "build_platform_id": false
        };
        $scope.button_class = function(job){
            var resultState = job.result;
            if (job.state !== "completed") {
                resultState = job.state;
            }
            return thResultStatusInfo(resultState).btnClass;

        };

        // this is triggered by the show more link
        $scope.show_more = function(){
            $scope.similar_jobs_count += 20;
            $scope.get_similar_jobs();
        };

        $scope.similar_job_selected = null;

        $scope.show_job_info = function(job){
            ThJobModel.get(job.id)
            .then(function(job){
                $scope.similar_job_selected = job;
                $scope.similar_job_selected.result_status = thResultStatus($scope.similar_job_selected);
                var duration = (
                    $scope.similar_job_selected.end_timestamp - $scope.similar_job_selected.start_timestamp
                 )/60;
                if (duration) {
                    duration = numberFilter(duration, 0) + " minutes";
                }
                $scope.similar_job_selected.duration = duration;
                $scope.similar_job_selected.start_time = dateFilter(
                    $scope.similar_job_selected.start_timestamp*1000,
                    'short'
                );
                $scope.similar_job_selected.failure_classification_name = thClassificationTypes[
                    $scope.similar_job_selected.failure_classification_id
                ];

                //retrieve the list of error lines
                ThJobArtifactModel.get_list({
                    name: "Structured Log",
                    job_id: $scope.similar_job_selected.id
                })
                .then(function(artifact_list){
                        if(artifact_list.length > 0){
                            $scope.similar_job_selected.error_lines = artifact_list[0].blob.step_data.all_errors;
                        }
                    });
                });
        };

});


