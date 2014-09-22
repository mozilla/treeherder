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
        $scope.artifacts = {};

        var timeout_promise = null;

        var setBuildernameHref = function(buildername){

            var absUrl = $location.absUrl();
            var delimiter = '?';

            // If there are parameters the parameter delimiter &
            // should be used
            if(absUrl.indexOf('?') !== -1){
                delimiter = '&';
            }

            $scope.buildbotJobnameHref = absUrl + delimiter + 'searchQuery=' + buildername;

        };

        var selectJob = function(job_id) {
            // set the scope variables needed for the job detail panel
            if (job_id) {
                $scope.job_detail_loading = true;
                if(timeout_promise !== null){
                    $log.debug("timing out previous job request");
                    timeout_promise.resolve();
                }
                timeout_promise = $q.defer();

                var jobDetailPromise = ThJobModel.get(
                    $scope.repoName, job_id,
                    {timeout: timeout_promise});

                var buildapiArtifactPromise = ThJobArtifactModel.get_list(
                    {name: "buildapi", "type": "json", job_id: job_id},
                    {timeout: timeout_promise});

                var jobInfoArtifactPromise = ThJobArtifactModel.get_list({
                    name: "Job Info", "type": "json", job_id: job_id},
                    {timeout: timeout_promise});

                var jobLogUrlPromise = ThJobLogUrlModel.get_list(
                    job_id,
                    {timeout: timeout_promise});

                return $q.all([
                    jobDetailPromise,
                    buildapiArtifactPromise,
                    jobInfoArtifactPromise,
                    jobLogUrlPromise
                ]).then(function(results){
                    //the first result comes from the job detail promise
                    $scope.job = results[0];
                    // the second result come from the buildapi artifact promise
                    var buildapi_artifact = results[1];
                    if (buildapi_artifact.length > 0 &&
                        _.has(buildapi_artifact[0], 'blob')){
                        // this is needed to cancel/retrigger jobs
                        $scope.artifacts.buildapi = buildapi_artifact[0];
                        $scope.buildbotJobname = $scope.artifacts.buildapi.blob.buildername;
                        setBuildernameHref($scope.buildbotJobname);
                    }
                    // the third result comes from the job info artifact promise
                    var jobInfoArtifact = results[2];
                    if (jobInfoArtifact.length > 0 &&
                        _.has(jobInfoArtifact[0], 'blob')){
                        $scope.job_details = jobInfoArtifact[0].blob.job_details;
                    }
                    //the fourth result comes form the jobLogUrl artifact
                    $scope.job_log_urls = results[3];
                    $scope.jobLogsAllParsed = _.every($scope.job_log_urls, function(jlu) {
                        return jlu.parse_status === 'parsed';
                    });

                    $scope.lvUrl = thUrl.getLogViewerUrl($scope.job.id);
                    $scope.resultStatusShading = "result-status-shading-" + thResultStatus($scope.job);

                    updateVisibleFields();
                    $scope.updateClassifications();
                    $scope.updateBugs();

                    $scope.job_detail_loading = false;
                });


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
            $scope.jobLoadedPromise = selectJob(job.id);
            thTabs.showTab(thTabs.selectedTab, job.id);

            $rootScope.selectedJob = job;
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
                $scope.job.note = $scope.classifications[0];
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
