"use strict";

treeherder.controller('PluginCtrl',
    function PluginCtrl($scope, $rootScope, $resource, $http,
                        thServiceDomain, thUrl, ThJobClassificationModel, thStarTypes,
                        ThJobModel, thEvents, dateFilter, numberFilter,
                        thPinboard, $log) {

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

                $scope.updateclassifications();
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

        $scope.starTypes = thStarTypes;

        // load the list of existing classifications (including possibly a new one just
        // added).
        $scope.updateclassifications = function() {
            ThJobClassificationModel.get_list({job_id: $scope.job.id}).then(function(response) {
                $scope.classifications = response;
            });
        };
        // when classifications comes in, then set the latest note for the job
        $scope.$watch('classifications', function(newValue, oldValue) {
            if (newValue && newValue.length > 0) {
                $scope.job.note=newValue[0];
            }
        });

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
                alert("you must be logged in");
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
