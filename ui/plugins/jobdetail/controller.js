"use strict";

treeherder.controller('JobDetailPluginCtrl',
    function JobDetailPluginCtrl($scope, $resource, $http,
                                 thServiceDomain, thUrl, thJobNote) {

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

        var JobNote = thJobNote;

        // load the list of existing notes (including possibly a new one just
        // added).
        $scope.updateNotes = function() {
            $scope.comments = JobNote.query({job_id: $scope.job.job_id});
        };

        // open form to create a new note
        $scope.addNote = function() {
            $scope.newNote = new JobNote({
                job_id: $scope.job.job_id,
                note: "",
                who: "camd",
                failure_classification_id: 0
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
