"use strict";

treeherder.controller('JobsCtrl',
    function JobsCtrl($scope, $http, $rootScope, $location, $routeParams, thResultSets) {

        // set the default repo to mozilla-central if not specified
        if ($routeParams.hasOwnProperty("repo") &&
            $routeParams.repo !== "") {
            $rootScope.repo = $routeParams.repo;
        } else {
            $rootScope.repo = "mozilla-inbound";
        }

        // get the job groups
        // todo: should this be a service too?
        $http.get('resources/job_groups.json').success(function(data) {
            $scope.job_groups = data;
            $scope.job_types = [];
            // extract the job_types from the job_groups and place them in scope
            for (var group in $scope.job_groups){
                if ($scope.job_groups.hasOwnProperty(group)) {
                    for(var job_type in $scope.job_groups[group]){
                        if ($scope.job_groups[group].hasOwnProperty(job_type)) {
                            $scope.job_types.push($scope.job_groups[group][job_type]);
                        }
                    }
                }
            }
        });

        thResultSets.getResultSets().
            success(function(data) {
                $rootScope.result_sets = data;
            });

    }
);

treeherder.controller('PushCtrl',
    function PushCtrl($scope, $rootScope, $http, thResults, thServiceDomain) {
        // whether or not revision list for a push is collapsed
        $scope.isCollapsedRevisions = true;

        $scope.isCollapsedResults = true;
        thResults.getResults($scope.push, $scope);

        $scope.viewJob = function(job_uri) {
            console.log(job_uri);
            $http.get(thServiceDomain + job_uri).
                success(function(data) {
                    console.log(data);
                    $rootScope.selectedJob = data;
                    data.artifacts.forEach(function(artifact) {
                        if (artifact.name.contains("Job Artifact")) {
                            $rootScope.jobArtifact=artifact;
                            $http.get(thServiceDomain + artifact.resource_uri).
                                success(function(data) {
                                    $rootScope.jobPrintlines = data.blob.tinderbox_printlines;
                                });
                        } else if (artifact.name === "Structured Log") {
                            $rootScope.lvArtifact=artifact;
                        }
                    });
                });
        };
    }
);
