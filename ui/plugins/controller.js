"use strict";


treeherder.controller('PluginCtrl',
    function PluginCtrl($scope, $rootScope, $resource, $http,
                        thServiceDomain, thUrl, thJobNote, thStarTypes,
                        thJobModel, thEvents, $log) {

        $scope.job = {};

        var selectJob = function(newValue, oldValue) {
            // preferred way to get access to the selected job
            if (newValue) {

                $scope.job = newValue;

                // get the details of the current job
                ThJobModel.get($scope.job.id).then(function(data){
                    _.extend($scope.job, data);
                    $scope.logs = data.logs;
                });

                $scope.artifacts = {};

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

                $scope.tab_loading = true;
                $scope.lvUrl = thUrl.getLogViewerUrl($scope.job.id);

                $scope.updateNotes();


            }
        };

        //$scope.$watch('selectedJob', selectJob, true);

        $rootScope.$on(thEvents.jobClick, function(event, job){
            selectJob(job, $rootScope.selectedJob);
            $rootScope.selectedJob = job;
        });

        $scope.starTypes = thStarTypes;

        // load the list of existing notes (including possibly a new one just
        // added).
        $scope.updateNotes = function() {
            ThJobNoteModel.get_list({job_id: $scope.job.id}).then(function(response){
                $scope.notes = response;
            });
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
            $scope.newNote = new ThJobNoteModel({
                job_id: $scope.job.id,
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
            $scope.newNote.create()
                .then(function(response){
                    $scope.updateNotes();
                    $scope.clearNewNote();
                });
        };

        $scope.tabs = {
            "tinderbox": {
                title: "Job Details",
                content: "plugins/tinderbox/main.html"
            },
            "notes": {
                title: "Notes",
                content: "plugins/notes/main.html"
            },
            "bugs_suggestions": {
                title: "Bugs suggestions",
                content: "plugins/bugs_suggestions/main.html"
            },
            "similar_jobs": {
                title: "Similar jobs",
                content: "plugins/similar_jobs/main.html"
            }
        };

    }
);
