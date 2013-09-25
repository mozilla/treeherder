"use strict";

treeherder.controller('JobDetailPluginCtrl',
    function JobDetailPluginCtrl($scope, $resource, $http,
                                 thServiceDomain, thUrl, thJobNotes) {

        $scope.$watch('selectedJob', function(newValue, oldValue) {
            // preferred way to get access to the selected job
            if (newValue) {
                $scope.job = newValue;

                var undef = "---undefined---";
                // fields that will show in the job detail panel
                $scope.visibleFields = {
                    "Result": $scope.job.result || undef,
                    "Job GUID": $scope.job.job_guid || undef,
                    "Job ID": $scope.job.id || undef,
                    "Machine Name": "<a href='https://secure.pub.build.mozilla.org/builddata/reports/slave_health/slave.html?name=" + $scope.job.machine_name + "'>" + $scope.job.machine_name + "</a>",
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
                    $scope.updateNotes();
            }
        }, true);

        $scope.updateNotes = function() {
            thJobNotes.getAll($scope.job.job_id).
                success(function(data) {
                    $scope.comments = data;
                });
        };

        $scope.addNote = function() {
            $scope.newNote = {
                who: "camd",
                note: "",
                failure_classification_id: 0,
                job_id: $scope.job.job_id
            };
        };

        $scope.clearNewNote = function() {
            $scope.newNote = null;
        };
    }
);

treeherder.controller('JobNoteCtrl',
    function JobNoteCtrl($scope, thJobNotes) {
        // bind to individual values in this scope, rather than a whole item.
        // each scope item binds to part of noteJob.
        // noteJob should probably be a copy?  or we won't change anything.
        // just display values from it, maybe...

        $scope.saveNote = function() {
            thJobNotes.create(
                $scope.newNote.job_id,
                $scope.newNote.note,
                $scope.newNote.who,
                $scope.newNote.failure_classification_id
            );
            $scope.updateNotes();
            $scope.clearNewNote();
        };
    }
);

////////////////////////
//
//  Services
//
///////////////////////

treeherder.factory('thJobNotes',
                   ['$http', 'thUrl',
                   function($http, thUrl) {
    return {
        apiPath: thUrl.getProjectUrl("/note/"),
        getAll: function(job_id) {
            return $http.get(this.apiPath + "?job_id=" + job_id);
        },
        create: function(job_id, note, who, failure_classification_id) {
            $http.post(this.apiPath, {
                job_id: job_id,
                note: note,
                who: who,
                failure_classification_id: failure_classification_id
            });
        }
    };
}]);

