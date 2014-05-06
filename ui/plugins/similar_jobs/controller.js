"use strict";

treeherder.controller('SimilarJobsPluginCtrl', [
    '$scope', 'ThLog', '$rootScope', 'ThJobModel', 'thResultStatusInfo',
    'thEvents', 'numberFilter', 'dateFilter', 'thClassificationTypes',
    'thResultStatus', 'ThJobArtifactModel', 'thResultSets', 'thNotify',
    function SimilarJobsPluginCtrl(
        $scope, ThLog, $rootScope, ThJobModel, thResultStatusInfo, thEvents,
        numberFilter, dateFilter, thClassificationTypes, thResultStatus,
        ThJobArtifactModel, thResultSets, thNotify) {

        var $log = new ThLog(this.constructor.name);

        $log.debug("similar jobs plugin initialized");

        // do the jobs retrieval based on the user selection
        $scope.page_size = 20;
        $scope.get_similar_jobs = function(){
            $scope.tabs.similar_jobs.is_loading = true;
            var options = {
                    count: $scope.page_size +1,
                    offset: ($scope.page-1) * $scope.page_size,
                    full: false
                };
                angular.forEach($scope.similar_jobs_filters, function(value, key){
                    if(value){
                        options[key] = $scope.job[key];
                    }
                });
                ThJobModel.get_list($scope.repoName, options)
                    .then(function(data){
                        if(data.length > 0){
                            if(data.length > $scope.page_size){
                                $scope.has_next_page = true;
                            }else{
                                $scope.has_next_page = false;
                            }
                            data.pop();
                            // retrieve the list of result_set_ids
                            var result_set_ids = _.uniq(
                                _.pluck(data, 'result_set_id')
                            );

                            // get resultsets and revisions for the given ids
                            thResultSets.getResultSets(
                                $scope.repoName, null, 100, result_set_ids, false, true
                                ).then(function(response){
                                    //decorate the list of jobs with their result sets
                                    var resultsets = _.indexBy(response.data.results, "id");
                                    angular.forEach(data, function(obj){
                                        obj.result_set = resultsets[obj.result_set_id];
                                        obj.revisionResultsetFilterUrl = $scope.urlBasePath + "?repo=" +
                                            $scope.repoName + "&revision=" + obj.result_set.revisions[0].revision;
                                        obj.authorResultsetFilterUrl = $scope.urlBasePath + "?repo=" +
                                            $scope.repoName + "&author=" + encodeURIComponent(obj.result_set.author);
                                    });
                                    $scope.similar_jobs = data;
                                    // on the first page show the first element info by default
                                    if($scope.page === 1){
                                        $scope.show_job_info($scope.similar_jobs[0]);
                                    }
                                    $scope.tabs.similar_jobs.is_loading = false;
                                },
                                function(){
                                    thNotify.send("Error fetching result sets for similar jobs","danger");
                                });
                        }
                    });
        };

        // reset the page counter and retrieve the list of jobs
        $scope.update_similar_jobs = function(event) {
            if($scope.job){
                $scope.page = 1;
                $scope.has_next_page = false;
                $scope.similar_jobs = [];
                $scope.similar_job_selected = null;
                $scope.get_similar_jobs();
            }
        };

        $scope.similar_jobs = [];

        $scope.result_status_info = thResultStatusInfo;

        $rootScope.$on(thEvents.jobDetailLoaded, $scope.update_similar_jobs);
        $scope.similar_jobs_filters = {
            "machine_id": false,
            "job_type_id": true,
            "build_platform_id": true
        };
        $scope.button_class = function(job){
            var resultState = job.result;
            if (job.state !== "completed") {
                resultState = job.state;
            }
            return thResultStatusInfo(resultState).btnClass;
        };

        // this is triggered by the show more link
        $scope.show_next = function(){
            $scope.page += 1;
            $scope.get_similar_jobs();
        };

        $scope.similar_job_selected = null;

        $scope.show_job_info = function(job){
            ThJobModel.get($scope.repoName, job.id)
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
                $scope.similar_job_selected.start_time = $scope.similar_job_selected.start_timestamp !== 0 ? dateFilter(
                    $scope.similar_job_selected.start_timestamp*1000,
                    'short'
                ) : "";
                $scope.similar_job_selected.failure_classification = thClassificationTypes.classifications[
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
}]);


