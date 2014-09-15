"use strict";

treeherder.controller('PluginCtrl', [
    '$scope', '$rootScope', '$location', 'thUrl', 'ThJobClassificationModel',
    'thClassificationTypes', 'ThJobModel', 'thEvents', 'dateFilter',
    'numberFilter', 'ThBugJobMapModel', 'thResultStatus', 'thSocket',
    'ThResultSetModel', 'ThLog', '$q', 'thPinboard', 'ThJobArtifactModel',
    'thBuildApi', 'thNotify', 'ThJobLogUrlModel', 'thTabs',
    function PluginCtrl(
        $scope, $rootScope, $location, thUrl, ThJobClassificationModel,
        thClassificationTypes, ThJobModel, thEvents, dateFilter,
        numberFilter, ThBugJobMapModel, thResultStatus, thSocket,
        ThResultSetModel, ThLog, $q, thPinboard, ThJobArtifactModel,
        thBuildApi, thNotify, ThJobLogUrlModel, thTabs) {

        var $log = new ThLog("PluginCtrl");

        $scope.job = {};

        var timeout_promise = null;

        var setBuildernameHref = function(buildername){

            var absUrl = $location.absUrl();
            var delimiter = '?';

            // If there are parameters the parameter delimiter &
            // should be used
            if(absUrl.indexOf('?') != -1){
                delimiter = '&';
            }

            $scope.buildbotJobnameHref = absUrl + delimiter + 'searchQuery=' + buildername;

        };

        var selectJob = function(newValue, oldValue) {
            $scope.artifacts = {};

            // preferred way to get access to the selected job
            if (newValue) {
                $scope.job_detail_loading = true;
                $scope.job = newValue;

                $scope.visibleFields = {
                    "Job name": $scope.job.job_type_name,
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
                        $scope.buildbotJobname = $scope.artifacts.buildapi.blob.buildername;
                        setBuildernameHref($scope.buildbotJobname);

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
                var undef = "",
                    duration = "";
                // fields that will show in the job detail panel
                $scope.visibleFields = {
                    "Job name": $scope.job.job_type_name || undef,
                    "Build": $scope.job.build_architecture + " " +
                             $scope.job.build_platform  + " " +
                             $scope.job.build_os || undef
                };
                if (_.has($scope.artifacts, "buildapi")) {
                    $scope.buildbotJobname = $scope.artifacts.buildapi.blob.buildername;
                    setBuildernameHref($scope.buildbotJobname);
                }

                // time fields to show in detail panel, but that should be grouped together
                $scope.visibleTimeFields = {
                    requestTime: dateFilter($scope.job.submit_timestamp*1000, 'short')
                };

                /*
                    display appropriate times and duration

                    If start time is 0, then duration should be from requesttime to now
                    If we have starttime and no endtime, then duration should be starttime to now
                    If we have both starttime and endtime, then duration will be between those two
                */
                var endtime = $scope.job.end_timestamp || Date.now()/1000;
                var starttime = $scope.job.start_timestamp || $scope.job.submit_timestamp;
                duration = numberFilter((endtime-starttime)/60, 0) + " minute(s)";

                $scope.visibleTimeFields.duration = duration;

                if ($scope.job.start_timestamp) {
                    $scope.visibleTimeFields.startTime = dateFilter(
                        $scope.job.start_timestamp*1000, 'short');
                }
                if ($scope.job.end_timestamp) {
                    $scope.visibleTimeFields.endTime = dateFilter(
                        $scope.job.end_timestamp*1000, 'short');
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
            thBuildApi.cancelJob($scope.repoName, getRequestId()).then(function() {
                ThJobModel.cancel($scope.repoName, $scope.job.id);
            });
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

        $scope.$on(thEvents.jobClick, function(event, job) {
            selectJob(job, $rootScope.selectedJob);
            $rootScope.selectedJob = job;
            thTabs.showTab(thTabs.selectedTab, job.id);
        });

        $scope.$on(thEvents.jobClear, function(event, job) {
            $rootScope.selectedJob = null;
            $scope.$digest();
        });

        $scope.bug_job_map_list = [];

        $scope.classificationTypes = thClassificationTypes;

        // load the list of existing classifications (including possibly a new one just
        // added).
        $scope.updateClassifications = function() {
            ThJobClassificationModel.get_list({job_id: $scope.job.id}).then(function(response) {
                $scope.classifications = response;
                $scope.job.note = $scope.classifications[0]
            });
        };

        // load the list of bug associations (including possibly new ones just
        // added).
        $scope.updateBugs = function() {
            if (_.has($scope.job, "id")) {
                ThBugJobMapModel.get_list({job_id: $scope.job.id}).then(function (response) {
                    $scope.bugs = response;
                });
            }
        };

        $scope.$on(thEvents.jobsClassified, function(event, job) {
            $scope.updateClassifications();
        });

        $scope.$on(thEvents.bugsAssociated, function(event, job) {
            $scope.updateBugs();
        });

        $scope.pinboard_service = thPinboard;

        // expose the tab service properties on the scope
        $scope.tabService = thTabs;
    }
]);

treeherder.controller('JobDetailsPluginCtrl', [
    '$scope', '$rootScope', 'ThLog', 'ThJobArtifactModel',
    '$q', 'thEvents',
    function JobDetails(
        $scope, $rootScope, ThLog, ThJobArtifactModel, $q, thEvents) {

        var $log = new ThLog(this.constructor.name);

        $log.debug("JobDetails plugin initialized");
        var timeout_promise = null;

        var update_job_info = function(event, job){
            $scope.job_details = [];
            $scope.job_details_parsed = [];
            $scope.is_loading = true;
            if(timeout_promise !== null){
                timeout_promise.resolve();
            }
            timeout_promise = $q.defer();

            ThJobArtifactModel.get_list({
                name: "Job Info",
                "type": "json",
                job_id: job.id
            }, {timeout: timeout_promise})
            .then(function(data){
                //We must check for ``blob`` in ``Job Info``
                // because ``Job Info`` can exist without the blob as the promise is
                // fulfilled.
                if (data.length === 1 && _.has(data[0], 'blob')){
                    $scope.job_details = data[0].blob.job_details;
                }

            })
            .finally(function(){
                $scope.is_loading = false;
            });
        };
        $scope.$on(thEvents.jobClick, update_job_info);
    }
]);
