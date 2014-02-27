"use strict";

treeherder.controller('SimilarJobsPluginCtrl',
    function SimilarJobsPluginCtrl($scope, $log, ThJobModel, thResultStatusInfo) {
        $log.debug("similar jobs plugin initialized");


        $scope.update_similar_jobs = function(newValue){
            if(newValue){$scope.similar_jobs_count = 20;}
            if($scope.job.id){
                var options = {
                    count: $scope.similar_jobs_count
                };
                angular.forEach($scope.similar_jobs_filters, function(value, key){
                    if(value){
                        options[key] = $scope.job[key];
                    }
                });
                $log.log(options);
                ThJobModel.get_list(options).then(function(data){
                    $scope.similar_jobs = data;
                });
                };
            }

        $scope.result_status_info = thResultStatusInfo

        $scope.$watch('job.job_guid', $scope.update_similar_jobs, true);
        $scope.similar_jobs = [];
        $scope.similar_jobs_filters = {
            "machine_id": false,
            "job_type_id": true,
            "build_platform_id": false
        };
        $scope.button_class = function(job){
            var resultState = job.result;
            if (job.state != "completed") {
                resultState = job.state;
            }
            return thResultStatusInfo(resultState).btnClass

        }
        $scope.show_more = function(){
            $scope.similar_jobs_count += 20;
            $scope.update_similar_jobs()
        };
    }
);


