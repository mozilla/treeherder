"use strict";

treeherder.controller('JobDetailPluginCtrl',
    function JobDetailPluginCtrl($scope, $resource, $http,
                                 thServiceDomain, thUrl) {

        $scope.$watch('selectedJob', function(newValue, oldValue) {
            // preferred way to get access to the selected job
            if (newValue) {
                $scope.job = newValue;

                var undef = "---undefined---";
                // fields that will show in the job detail panel
                $scope.visibleFields = {
                    "Reason": $scope.job.reason || undef,
                    "State": $scope.job.state || undef,
                    "Result": $scope.job.result || undef,
                    "Type Name": $scope.job.job_type_name || undef,
                    "Type Desc": $scope.job.job_type_description || undef,
                    "Who": $scope.job.who || undef,
                    "Job GUID": $scope.job.job_guid || undef,
                    "Machine Name": $scope.job.machine_name || undef,
                    "Machine Platform Arch": $scope.job.machine_platform_architecture || undef,
                    "Machine Platform OS": $scope.job.machine_platform_os || undef,
                    "Build Platform": $scope.job.build_platform || undef,
                    "Build Arch": $scope.job.build_architecture || undef,
                    "Build OS": $scope.job.build_os || undef
                };
                $http.get(thServiceDomain + $scope.job.resource_uri).
                    success(function(data) {
                        $scope.logs = data.logs;

                        data.artifacts.forEach(function(artifact) {
                            if (artifact.name.contains("Job Artifact")) {
                                // we don't return the blobs with job, just
                                // resource_uris to them.  For the Job Artifact,
                                // we want that blob, so we need to fetch the
                                // detail to get the blob which has the
                                // tinderbox_printlines, etc.
                                $scope.jobArtifact = $resource(
                                    thServiceDomain + artifact.resource_uri).get();
                            } else if (artifact.name === "Structured Log") {
                                // for the structured log, we don't need the blob
                                // here, we have everything we need in the artifact
                                // as is, so just save it.
                                $scope.lvArtifact=artifact;
                                $scope.lvUrl = thUrl.getLogViewerUrl(artifact.id);
                            }
                        });
                    });
            }
        }, true);
    }
);
