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
    function PushCtrl($scope, $rootScope, $http, $log, thResults, thUrl, thServiceDomain) {
        // whether or not revision list for a push is collapsed
        $scope.isCollapsedRevisions = true;

        $scope.isCollapsedResults = true;

        // get the jobs list for the current resultset
        thResults.getResults($scope.push, $scope);

        $scope.viewJob = function(job) {
            // view the job details in the lower job-details section

            $rootScope.selectedJob = job;

            // fields that will show in the job detail panel
            $rootScope.selectedJob.visibleFields = {
                "Reason": job.reason,
                "State": job.state,
                "Result": job.result,
                "Type Name": job.job_type_name,
                "Type Desc": job.job_type_description,
                "Who": job.who,
                "Job GUID": job.job_guid,
                "Machine Name": job.machine_name,
                "Machine Platform Arch": job.machine_platform_architecture,
                "Machine Platform OS": job.machine_platform_os,
                "Build Platform": job.build_platform,
                "Build Arch": job.build_architecture,
                "Build OS": job.build_os
            };
            $http.get(thServiceDomain + job.resource_uri).
                success(function(data) {
                    $rootScope.selectedJob.logs = data.logs;

                    data.artifacts.forEach(function(artifact) {
                        if (artifact.name.contains("Job Artifact")) {
                            // we don't return the blobs with job, just resource_uris
                            // to them.  For the Job Artifact, we want that blob, so we
                            // need to fetch the detail to get the blob which has the
                            // tinderbox_printlines, etc.
                            $http.get(thServiceDomain + artifact.resource_uri).
                                success(function(data) {
                                    $rootScope.selectedJob.jobArtifact = data;
                                });
                        } else if (artifact.name === "Structured Log") {
                            // for the structured log, we don't need the blob here, we
                            // have everything we need in the artifact as is, so
                            // just save it.
                            $rootScope.selectedJob.lvArtifact=artifact;
                            $rootScope.selectedJob.lvUrl = thUrl.getLogViewerUrl(artifact.id);
                        }
                    });
                });
        };

        $scope.viewLog = function(job_uri) {
            // open the logviewer for this job in a new window
            // currently, invoked by right-clicking a job.

            $http.get(thServiceDomain + job_uri).
                success(function(data) {
                    if (data.hasOwnProperty("artifacts")) {
                        data.artifacts.forEach(function(artifact) {
                            if (artifact.name === "Structured Log") {
                                window.open(thUrl.getLogViewerUrl(artifact.id));
                            }
                        });
                    } else {
                        $log.warn("Job had no artifacts: " + job_uri);
                    }
                });

        };
    }
);
