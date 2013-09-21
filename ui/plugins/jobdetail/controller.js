"use strict";

treeherder.controller('JobDetailPluginCtrl',
    function JobDetailPluginCtrl($scope, $resource, $http,
                                 thServiceDomain, thUrl) {

        $scope.$watch('selectedJob', function(newValue, oldValue) {
            // preferred way to get access to the selected job
            if (newValue) {
                $scope.job = newValue;

                // fields that will show in the job detail panel
                $scope.visibleFields = {
                    "Result": $scope.job.result,
                    "Job GUID": $scope.job.job_guid,
                    "Machine Name": "<a href='https://secure.pub.build.mozilla.org/builddata/reports/slave_health/slave.html?name=" + $scope.job.machine_name + "'>" + $scope.job.machine_name + "</a>",
                    "Machine Platform Arch": $scope.job.machine_platform_architecture,
                    "Machine Platform OS": $scope.job.machine_platform_os,
                    "Build Platform": $scope.job.build_platform,
                    "Build Arch": $scope.job.build_architecture,
                    "Build OS": $scope.job.build_os
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
                $scope.comments = [
                    {
                        who: "spectre",
                        date: 1379709198,
                        note: "wazzon chokey?"
                    },
                    {
                        who: "fucci ca pesta",
                        date: 1379709198,
                        note: "my eyes are burning"
                    },
                    {
                        who: "camd",
                        date:  1376122980,
                        note: "happy birthday to me.  this is my day."
                    }
                ];
            }
        }, true);

        $scope.addNote = function() {
            $scope.noteJob = $scope.job;
        };
    }
);

treeherder.controller('JobNoteCtrl',
    function JobNoteCtrl($scope) {
        // bind to individual values in this scope, rather than a whole item.
        // each scope item binds to part of noteJob.
        // noteJob should probably be a copy?  or we won't change anything.
        // just display values from it, maybe...

            $scope.who = "camd";
            $scope.note = "";
            $scope.failure_classification_id = 2;
    }
);
