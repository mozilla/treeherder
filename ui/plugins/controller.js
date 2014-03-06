"use strict";

treeherder.controller('PluginCtrl',
    function PluginCtrl($scope, $rootScope, $resource, $http,
                        thServiceDomain, thUrl, ThJobNoteModel, thStarTypes,
                        ThJobModel, thEvents, dateFilter, numberFilter, $log) {

        $scope.job = {};
        $rootScope.pinnedJobs = {};

        var selectJob = function(newValue, oldValue) {
            // preferred way to get access to the selected job
            if (newValue) {

                $scope.job = newValue;

                // get the details of the current job
                ThJobModel.get($scope.job.id).then(function(data){
                    _.extend($scope.job, data);
                    updateVisibleFields();
                    $scope.logs = data.logs;
                });

                $scope.artifacts = {};

                updateVisibleFields();

                $scope.tab_loading = true;
                $scope.lvUrl = thUrl.getLogViewerUrl($scope.job.id);

                $scope.updateNotes();


            }
        };

        $scope.pinJob = function(job) {
            $rootScope.pinnedJobs[job.id] = job;
        };

        $scope.unPinJob = function(id) {
            delete $rootScope.pinnedJobs[id];
        };

        $scope.unPinAll = function() {
            $rootScope.pinnedJobs = {};
        };

        // open form to create a new note
        $scope.addNewBatchClassification = function() {
            var fci = 0;
            $scope.newBatchClassification = new ThJobNoteModel({
                job_id: $scope.job.id,
                note: "",
                who: $scope.username,
                failure_classification_id: fci
            });
            $scope.focusInput=true;
        };

        // done adding a new note, so clear and hide the form
        $scope.clearNewBatchClassification = function() {
            $scope.newBatchClassification = null;
        };

        // save the note and hide the form
        $scope.saveNewBatchClassification = function() {
            alert("I'm saved!");
//            $scope.newBatchClassification.create()
//                .then(function(response){
//                    $scope.updateNotes();
//                    $scope.clearNewNote();
//                });
        };


        $scope.hasPinnedJobs = function() {
            return !_.isEmpty($scope.pinnedJobs);
        };

        $scope.viewJob = function(job) {
            $rootScope.selectedJob = job;
            $rootScope.$broadcast(thEvents.jobClick, job);
        };

        var updateVisibleFields = function() {
                var undef = "---undefined---";
                // fields that will show in the job detail panel

                $scope.visibleFields = {
                    "Job Name": $scope.job.job_type_name || undef,
                    "Start time": dateFilter($scope.job.start_timestamp*1000, 'short') || undef,
                    "Duration": numberFilter(($scope.job.end_timestamp-$scope.job.start_timestamp)/60, 0) + " minutes" || undef,
                    "Machine ": $scope.job.machine_platform_architecture + " " +
                                $scope.job.machine_platform_os || undef,
                    "Build": $scope.job.build_architecture + " " +
                             $scope.job.build_platform  + " " +
                             $scope.job.build_os || undef
                };
        };

        //$scope.$watch('selectedJob', selectJob, true);

        $rootScope.$on(thEvents.jobClick, function(event, job) {
            selectJob(job, $rootScope.selectedJob);
            $rootScope.selectedJob = job;
        });

        $rootScope.$on(thEvents.jobPin, function(event, job) {
            $scope.pinJob(job);
        });

        $scope.starTypes = thStarTypes;

        // load the list of existing notes (including possibly a new one just
        // added).
        $scope.updateNotes = function() {
            ThJobNoteModel.get_list({job_id: $scope.job.id}).then(function(response) {
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
