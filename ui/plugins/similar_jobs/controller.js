"use strict";

treeherder.controller('SimilarJobsPluginCtrl', [
    '$scope', 'ThLog', 'ThJobModel', 'ThTextLogStepModel', 'thResultStatusInfo',
    'thEvents', 'numberFilter', 'dateFilter', 'thClassificationTypes',
    'thResultStatus', 'ThResultSetModel', 'thNotify',
    'thTabs',
    function SimilarJobsPluginCtrl(
        $scope, ThLog, ThJobModel, ThTextLogStepModel, thResultStatusInfo,
        thEvents, numberFilter, dateFilter, thClassificationTypes,
        thResultStatus, ThResultSetModel, thNotify,
        thTabs) {

        var $log = new ThLog(this.constructor.name);

        $log.debug("similar jobs plugin initialized");

        // do the jobs retrieval based on the user selection
        $scope.page_size = 20;
        $scope.get_similar_jobs = function(){
            thTabs.tabs.similarJobs.is_loading = true;
            var options = {
                count: $scope.page_size + 1,
                offset: ($scope.page - 1) * $scope.page_size
            };
            angular.forEach($scope.similar_jobs_filters, function(value, key){
                if (value){
                    options[key] = $scope.job[key];
                }
            });
            ThJobModel.get_similar_jobs($scope.repoName, $scope.job.id, options)
                .then(function(data){
                    if (data.length > 0){
                        if (data.length > $scope.page_size){
                            $scope.has_next_page = true;
                        } else {
                            $scope.has_next_page = false;
                        }
                        data.pop();
                        // retrieve the list of result_set_ids
                        var result_set_ids = _.uniq(
                            _.pluck(data, 'result_set_id')
                        );

                        // get resultsets and revisions for the given ids
                        ThResultSetModel.getResultSetList(
                            $scope.repoName, result_set_ids, true
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
                                $scope.similar_jobs = $.merge($scope.similar_jobs, data);
                                // on the first page show the first element info by default
                                if ($scope.page === 1 && $scope.similar_jobs.length > 0){
                                    $scope.show_job_info($scope.similar_jobs[0]);
                                }
                                thTabs.tabs.similarJobs.is_loading = false;
                            },
                            function(){
                                thNotify.send("Error fetching pushes for similar jobs","danger");
                            });
                    }
                });
        };

        // update function triggered by the plugins controller

        $scope.update_similar_jobs = function(){
            if (angular.isDefined($scope.jobLoadedPromise)){
                $scope.jobLoadedPromise.then(function(){
                    $scope.similar_jobs = [];
                    $scope.page = 1;
                    $scope.similar_job_selected = null;
                    $scope.get_similar_jobs();
                });
            }
        };

        // expose the update function on the tab service
        thTabs.tabs.similarJobs.update = $scope.update_similar_jobs;

        $scope.similar_jobs = [];

        $scope.result_status_info = thResultStatusInfo;

        $scope.similar_jobs_filters = {
            "machine_id": false,
            "build_platform_id": true,
            "option_collection_hash": true
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
                    duration = numberFilter(duration, 0);
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
                ThTextLogStepModel.query({
                    project: $scope.repoName,
                    jobId: $scope.similar_job_selected.id
                }, function(textLogSteps) {
                    $scope.similar_job_selected.error_lines = _.flatten(
                        textLogSteps.map(s => s.errors));
                });
            });
        };
    }
]);
