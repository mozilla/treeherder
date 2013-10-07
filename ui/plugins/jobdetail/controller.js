"use strict";

treeherder.controller('JobDetailPluginCtrl',
    function JobDetailPluginCtrl($scope, $resource, $http,
                                 thServiceDomain, thUrl, thJobNote, thStarTypes) {

        $scope.$watch('selectedJob', function(newValue, oldValue) {
            // preferred way to get access to the selected job
            if (newValue) {
                $scope.job = newValue;

                var undef = "---undefined---";
                // fields that will show in the job detail panel
                $scope.visibleFields = {
                    "Result": $scope.job.result || undef,
                    "Job GUID": $scope.job.job_guid || undef,
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
                            if (artifact.name.indexOf("Job Artifact") !== -1) {
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

        $scope.starTypes = thStarTypes;
        var JobNote = thJobNote;

        // load the list of existing notes (including possibly a new one just
        // added).
        $scope.updateNotes = function() {
            $scope.notes = JobNote.query({job_id: $scope.job.job_id});
        };
        // when notes comes in, then set the latest note for the job
        $scope.$watch('notes', function(newValue, oldValue) {
            if (newValue && newValue.length > 0) {
                $scope.job.note=newValue[0];
            }
        });

        // open form to create a new note
        $scope.addNote = function() {
            var fci = 0;
            if ($scope.notes && $scope.notes.length > 0) {
                fci = $scope.notes[0].failure_classification_id;
            }
            $scope.newNote = new JobNote({
                job_id: $scope.job.job_id,
                note: "",
                who: $scope.username,
                failure_classification_id: fci
            });
            $scope.focusInput=true;
        };

        // done adding a new note, so clear and hide the form
        $scope.clearNewNote = function() {
            $scope.newNote = null;
        };

        // save the note and hide the form
        $scope.saveNote = function() {
            $scope.newNote.thSave();
            $scope.updateNotes();
            $scope.clearNewNote();
        };
    }
);

treeherder.factory('thJobNote', function($resource, $http, thUrl) {
    var JobNote = $resource(thUrl.getProjectUrl("/note/"));

    // Workaround to the fact that $resource strips trailing slashes
    // out of urls.  This causes a 301 redirect on POST because it does a
    // preflight OPTIONS call.  Tastypie gives up on the POST after this
    // and nothing happens.  So this alternative "thSave" command avoids
    // that by using the trailing slash directly in a POST call.
    // @@@ This may be fixed in later versions of Angular.  Or perhaps there's
    // a better way?
    JobNote.prototype.thSave = function() {
        $http.post(thUrl.getProjectUrl("/note/"), {
            job_id: this.job_id,
            note: this.note,
            who: this.who,
            failure_classification_id: this.failure_classification_id
        });
    };
    return JobNote;
});
