"use strict";

treeherder.controller('PluginCtrl',
    function PluginCtrl($scope, $rootScope, $resource, $http,
                        thServiceDomain, thUrl, ThJobClassificationModel, thClassificationTypes,
                        ThJobModel, thEvents, dateFilter, numberFilter,
                        thPinboard, ThBugJobMapModel, thResultStatusInfo,
                        thResultStatus, $log) {

        $scope.job = {};

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
                $scope.resultStatusClass = thResultStatusInfo(thResultStatus($scope.job)).btnClass + "-count-classified";

                $scope.updateClassifications();
                $scope.updateBugs();
            }
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

        $rootScope.$on(thEvents.jobsClassified, function(event, job) {
            $scope.updateClassifications();
        });

        $rootScope.$on(thEvents.bugsAssociated, function(event, job) {
            $scope.updateBugs();
        });

        $scope.classificationTypes = thClassificationTypes;

        // load the list of existing classifications (including possibly a new one just
        // added).
        $scope.updateClassifications = function() {
            ThJobClassificationModel.get_list({job_id: $scope.job.id}).then(function(response) {
                $scope.classifications = response;
            });
//            $scope.classifications = [
//                {note_timestamp: 123453432, who: "camd", failure_classification_id: 1, note: "wazzon chokey1?"},
//                {note_timestamp: 123453432, who: "camd", failure_classification_id: 2, note: "wazzon chokey2?"},
//                {note_timestamp: 123453432, who: "camd", failure_classification_id: 3, note: "wazzon chokey3?"},
//                {note_timestamp: 123453432, who: "camd", failure_classification_id: 4, note: "wazzon really really long one with a lot of text that will wrap and just be a funny funny guy chokey4?"}
//            ];
        };
        // when classifications comes in, then set the latest note for the job
        $scope.$watch('classifications', function(newValue, oldValue) {
            if (newValue && newValue.length > 0) {
                $scope.job.note=newValue[0];
            }
        });

        // load the list of bug associations (including possibly new ones just
        // added).
        $scope.updateBugs = function() {
            ThBugJobMapModel.get_list({job_id: $scope.job.id}).then(function(response) {
                $scope.bugs = response;
            });
//            $scope.bugs = [
//                {"bug_id": 809752},
//                {"bug_id": 960129},
//                {"bug_id": 960129},
//                {"bug_id": 960129},
//                {"bug_id": 960129},
//                {"bug_id": 902551}
//            ];
        };

        /*
         * Pinboard functionality
         */
        $scope.pinJob = function(job) {
            thPinboard.pinJob(job);
        };

        $scope.unPinJob = function(id) {
            thPinboard.unPinJob(id);
        };

        $scope.addBug = function(bug) {
            thPinboard.addBug(bug);
        };

        $scope.removeBug = function(id) {
            thPinboard.removeBug(id);
        };

        $scope.unPinAll = function() {
            thPinboard.unPinAll();
        };

        $scope.save = function() {
            if ($scope.user.loggedin) {
                $scope.classification.who = $scope.user.email;
                thPinboard.save($scope.classification);
            } else {
                // @@@ DEBUG ONLY!!!!
                $scope.classification.who = "guest";
                thPinboard.save($scope.classification);
            }
        };

        $scope.saveClassificationOnly = function() {
            if ($scope.user.loggedin) {
                $scope.classification.who = $scope.user.email;
                thPinboard.saveClassificationOnly($scope.classification);
            } else {
                // @@@ DEBUG ONLY!!!!
                $scope.classification.who = "cdawson@mozilla.com";
                thPinboard.saveClassificationOnly($scope.classification);
            }
        };

        $scope.saveBugsOnly = function() {
            if ($scope.user.loggedin) {
                thPinboard.saveBugsOnly();
            } else {
                // @@@ DEBUG ONLY!!!!
                thPinboard.saveBugsOnly();
            }
        };

        $scope.hasPinnedJobs = function() {
            return thPinboard.hasPinnedJobs();
        };


        $scope.viewJob = function(job) {
            $rootScope.selectedJob = job;
            $rootScope.$broadcast(thEvents.jobClick, job);
        };

        $scope.classification = thPinboard.createNewClassification();
        $scope.pinnedJobs = thPinboard.pinnedJobs;
        $scope.relatedBugs = thPinboard.relatedBugs;


        $scope.tabs = {
            "tinderbox": {
                title: "Job Details",
                content: "plugins/tinderbox/main.html"
            },
            "annotations": {
                title: "Annotations",
                content: "plugins/annotations/main.html"
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
