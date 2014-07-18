"use strict";

treeherder.controller('PluginCtrl', [
    '$scope', '$rootScope', 'thUrl', 'ThJobClassificationModel',
    'thClassificationTypes', 'ThJobModel', 'thEvents', 'dateFilter',
    'numberFilter', 'ThBugJobMapModel', 'thResultStatus', 'thSocket',
    'ThResultSetModel', 'ThLog', '$q', 'thPinboard', 'ThJobArtifactModel',
    'thBuildApi', 'thNotify', 'ThJobLogUrlModel',
    function PluginCtrl(
        $scope, $rootScope, thUrl, ThJobClassificationModel,
        thClassificationTypes, ThJobModel, thEvents, dateFilter,
        numberFilter, ThBugJobMapModel, thResultStatus, thSocket,
        ThResultSetModel, ThLog, $q, thPinboard, ThJobArtifactModel,
        thBuildApi, thNotify, ThJobLogUrlModel) {

        var $log = new ThLog("PluginCtrl");

        $scope.job = {};

        var timeout_promise = null;

        var selectJob = function(newValue, oldValue) {
            $scope.artifacts = {};

            // preferred way to get access to the selected job
            if (newValue) {
                $scope.job_detail_loading = true;
                $scope.job = newValue;

                $scope.visibleFields = {
                    "Job Name": $scope.job.job_type_name,
                    "Start time": "",
                    "Duration":  "",
                    "Machine ": "",
                    "Build": ""
                };

                if(timeout_promise !== null){
                    $log.debug("timing out previous job request");
                    timeout_promise.resolve();
                }
                timeout_promise = $q.defer();

                // get the details of the current job
                ThJobModel.get($scope.repoName, $scope.job.id, {
                    timeout: timeout_promise
                }).then(function(data){
                    $scope.job = data;
                    $rootScope.$broadcast(thEvents.jobDetailLoaded);
                    updateVisibleFields();
                    $scope.job_detail_loading = false;
                    $scope.logs = data.logs;
                });

                ThJobArtifactModel.get_list({
                    name: "buildapi",
                    "type": "json",
                    job_id: $scope.job.id
                }, {timeout: timeout_promise})
                .then(function(data) {
                    if (data.length > 0 && _.has(data[0], 'blob')){
                        _.forEach(data, function(item) {
                            $scope.artifacts[item.name] = item;
                        });
                        $scope.visibleFields.Buildername = $scope.artifacts.buildapi.blob.buildername;
                        $log.debug("buildapi artifacts", $scope.artifacts);
                    }
                });

                ThJobLogUrlModel.get_list($scope.job.id)
                .then(function(data){
                    $scope.job_log_urls = data;
                });

                $scope.lvUrl = thUrl.getLogViewerUrl($scope.job.id);
                $scope.resultStatusShading = "result-status-shading-" + thResultStatus($scope.job);

                $scope.updateClassifications();
                $scope.updateBugs();
            }
        };

        var updateVisibleFields = function() {
                var undef = "";
                // fields that will show in the job detail panel
                var duration = ($scope.job.end_timestamp-$scope.job.start_timestamp)/60;
                if (duration) {
                    duration = numberFilter(duration, 0) + " minutes";
                }

                $scope.visibleFields = {
                    "Job Name": $scope.job.job_type_name || undef,
                    "Start time": dateFilter($scope.job.start_timestamp*1000, 'short') || undef,
                    "Duration":  duration || undef,
                    "Machine ": $scope.job.machine_platform_architecture + " " +
                                $scope.job.machine_platform_os || undef,
                    "Build": $scope.job.build_architecture + " " +
                             $scope.job.build_platform  + " " +
                             $scope.job.build_os || undef
                };
                if (_.has($scope.artifacts, "buildapi")) {
                    $scope.visibleFields.Buildername = $scope.artifacts.buildapi.blob.buildername;
                }
        };

        $scope.getCountPinnedJobs = function() {
            return thPinboard.count.numPinnedJobs;
        };

        $scope.togglePinboardVisibility = function() {
            $scope.isPinboardVisible = !$scope.isPinboardVisible;
        };

        $scope.$watch('getCountPinnedJobs()', function(newVal, oldVal) {
            if (oldVal === 0 && newVal > 0) {
                $scope.isPinboardVisible = true;
            }
        });

        $scope.canRetrigger = function() {
            return ($scope.job && $scope.artifacts && _.has($scope.artifacts, "buildapi"));
        };

        $scope.canCancel = function() {
            return $scope.job && $scope.artifacts && _.has($scope.artifacts, "buildapi") &&
                ($scope.job.state === "pending" || $scope.job.state === "running");
        };

        /**
         * Get the build_id needed to cancel or retrigger from the currently
         * selected job.
         */
        var getRequestId = function() {
            if ($scope.artifacts.buildapi) {
                return $scope.artifacts.buildapi.blob.request_id;
            } else {
                // this is super unlikely since we'd need to have at least one of those
                // artifacts to even create the job in treeherder.  This is just a fallback...
                thNotify.send("Unable to get request id for retrigger/cancel", "danger", true);
                return null;
            }
        };

        $scope.retriggerJob = function() {
            thBuildApi.retriggerJob($scope.repoName, getRequestId());
        };

        $scope.cancelJob = function() {
            thBuildApi.cancelJob($scope.repoName, getRequestId());
        };

        $scope.cancelAll = function(resultsetId) {
            var rs = ThResultSetModel.getResultSet($scope.repoName, resultsetId);
            thBuildApi.cancelAllJobs($scope.repoName, rs.revision);
        };

        /**
         * Test whether or not the selected job is a reftest
         */
        $scope.isReftest = function() {
            if ($scope.selectedJob) {
                return $scope.selectedJob.job_group_symbol === "R";
            } else {
                return false;
            }
        };

        $rootScope.$on(thEvents.jobClick, function(event, job) {
            selectJob(job, $rootScope.selectedJob);
            $rootScope.selectedJob = job;
        });

        $rootScope.$on(thEvents.jobsClassified, function(event, job) {
            $scope.updateClassifications();
        });

        $rootScope.$on(thEvents.bugsAssociated, function(event, job) {
            $scope.updateBugs();
        });

        $scope.bug_job_map_list = [];

        $scope.classificationTypes = thClassificationTypes.classifications;

        // load the list of existing classifications (including possibly a new one just
        // added).
        $scope.updateClassifications = function() {
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

        // load the list of bug associations (including possibly new ones just
        // added).
        $scope.updateBugs = function() {
            if (_.has($scope.job, "id")) {
                ThBugJobMapModel.get_list({job_id: $scope.job.id}).then(function (response) {
                    $scope.bugs = response;
                });
            }
        };

        $scope.pinboard_service = thPinboard;

        var updateClassification = function(classification){
            if(classification.who !== $scope.user.email){
                // get a fresh version of the job
                ThJobModel.get_list($scope.repoName, {id:classification.id})
                .then(function(job_list){
                    if(job_list.length > 0){
                        var job = job_list[0];
                        // get the list of jobs we know about
                        var jobMap  = ThResultSetModel.getJobMap(classification.branch);
                        var map_key = "key"+job.id;
                        if(jobMap.hasOwnProperty(map_key)){
                            // update the old job with the new info
                            _.extend(jobMap[map_key].job_obj,job);
                            var params = { jobs: {}};
                            params.jobs[job.id] = jobMap[map_key].job_obj;
                            // broadcast the job classification event
                            $rootScope.$broadcast(thEvents.jobsClassified, params);
                        }
                    }

                });

            }

        };

        thSocket.on("job_classification", updateClassification);

        $scope.tabs = {
            "failure_summary": {
                title: "Failure summary",
                content: "plugins/failure_summary/main.html",
                active: true
            },
            "annotations": {
                title: "Annotations",
                content: "plugins/annotations/main.html"
            },
            "similar_jobs": {
                title: "Similar jobs",
                content: "plugins/similar_jobs/main.html"
            }
        };

        $scope.show_tab = function(tab){
            if(tab.active !== true){
                angular.forEach($scope.tabs, function(v,k){
                    v.active=false;
                });
                tab.active = true;
            }
        };

    }
]);

treeherder.controller('JobDetailsPluginCtrl', [
    '$scope', '$rootScope', 'ThLog', 'ThJobArtifactModel', '$q',
    function JobDetails(
        $scope, $rootScope, ThLog, ThJobArtifactModel, $q) {

        var $log = new ThLog(this.constructor.name);

        $log.debug("JobDetails plugin initialized");
        var timeout_promise = null;


        var update_job_info = function(newValue, oldValue){
            $scope.job_details = [];
            $scope.job_details_parsed = [];

            if(newValue){
                $scope.is_loading = true;

                if(timeout_promise !== null){
                            timeout_promise.resolve();
                }
                timeout_promise = $q.defer();

                ThJobArtifactModel.get_list({
                    name: "Job Info",
                    "type": "json",
                    job_id: newValue
                }, {timeout: timeout_promise})
                .then(function(data){
                    // ``artifacts`` is set as a result of a promise, so we must have
                    // the watch have ``true`` as the last param to watch the value,
                    // not just the reference.  We also must check for ``blob`` in ``Job Info``
                    // because ``Job Info`` can exist without the blob as the promise is
                    // fulfilled.
                    if (data.length === 1 && _.has(data[0], 'blob')){
                        $scope.job_details = data[0].blob.job_details;
                    }

                })
                .finally(function(){
                    $scope.is_loading = false;
                });
            }
        };
        $scope.$watch("job.id", update_job_info, true);
    }
]);
