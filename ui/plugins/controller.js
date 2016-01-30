"use strict";

treeherder.controller('PluginCtrl', [
    '$scope', '$rootScope', '$location', '$http', 'thUrl', 'ThJobClassificationModel',
    'thClassificationTypes', 'ThJobModel', 'thEvents', 'dateFilter', 'thDateFormat',
    'numberFilter', 'ThBugJobMapModel', 'thResultStatus', 'thJobFilters',
    'ThResultSetModel', 'ThLog', '$q', 'thPinboard', 'ThJobArtifactModel',
    'thBuildApi', 'thNotify', 'ThJobLogUrlModel', 'ThModelErrors', 'thTabs',
    '$timeout', 'thJobSearchStr', 'thReftestStatus', 'ThResultSetStore',
    'PhSeries', 'thServiceDomain', 'ThFailureLinesModel',
    function PluginCtrl(
        $scope, $rootScope, $location, $http, thUrl, ThJobClassificationModel,
        thClassificationTypes, ThJobModel, thEvents, dateFilter, thDateFormat,
        numberFilter, ThBugJobMapModel, thResultStatus, thJobFilters,
        ThResultSetModel, ThLog, $q, thPinboard, ThJobArtifactModel,
        thBuildApi, thNotify, ThJobLogUrlModel, ThModelErrors, thTabs,
        $timeout, thJobSearchStr, thReftestStatus, ThResultSetStore, PhSeries,
        thServiceDomain, ThFailureLinesModel) {

        var $log = new ThLog("PluginCtrl");

        $scope.job = {};
        $scope.artifacts = {};

        var getJobSearchStrHref = function(jobSearchStr){

            var absUrl = $location.absUrl();
            var delimiter = '?';

            // If there are parameters the parameter delimiter &
            // should be used
            if(absUrl.indexOf('?') !== -1){
                delimiter = '&';
            }

            return absUrl + delimiter + 'filter-searchStr=' +
                   encodeURIComponent(jobSearchStr);
        };

        $scope.filterByJobSearchStr = function(jobSearchStr) {
            thJobFilters.replaceFilter('searchStr', jobSearchStr || null);
        };

        // if the ``autoclassify`` param is set on the query sting, then
        // show the ``autoClassification`` tab.  Otherwise, hide it.
        // NOTE: This is a temporary param used during the evaluation/experimentation
        // phase of this feature.
        var showAutoClassifyTab = function() {
            thTabs.tabs.autoClassification.enabled = ($location.search().autoclassify === true);
        };
        showAutoClassifyTab();
        $rootScope.$on('$locationChangeSuccess', function() {
            showAutoClassifyTab();
        });

        /**
         * Set the tab options and selections based on the selected job.
         * The default selected tab will be based on whether the job was a
         * success or failure.
         *
         * Some tabs will be shown/hidden based on the job (such as Talos)
         * and some based on query string params (such as autoClassification).
         *
         */
        var initializeTabs = function(job) {
            var successTab = "jobDetails";
            var failTab = "failureSummary";

            // show/hide perfDetails panel if there is performance data related to the job
            $http.get('https://treeherder.mozilla.org/api/project/mozilla-inbound/performance/data/?job_id='+job.id).then(
                function(response){
                    $scope.tabService.tabs.perfDetails.enabled = !(_.isEmpty(response.data));
                }
            );

            // Error Classification/autoclassify special handling
            if ($scope.tabService.tabs.autoClassification.enabled) {
                failTab = "autoClassification";
            }

            // set the selected tab
            if (thResultStatus(job) === 'success') {
                $scope.tabService.selectedTab = successTab;
            } else {
                $scope.tabService.selectedTab = failTab;
            }
        };

        // this promise will void all the ajax requests
        // triggered by selectJob once resolved
        var selectJobPromise = null;
        var selectJobRetryPromise = null;

        var selectJob = function(job_id) {
            // set the scope variables needed for the job detail panel
            if (job_id) {
                $scope.job_detail_loading = true;
                if(selectJobPromise !== null){
                    $log.debug("timing out previous job request");
                    selectJobPromise.resolve();
                }
                selectJobPromise = $q.defer();

                if( selectJobRetryPromise !== null){
                    $timeout.cancel(selectJobRetryPromise);
                }
                $scope.job = {};
                $scope.artifacts = {};
                $scope.job_details = [];
                var jobDetailPromise = ThJobModel.get(
                    $scope.repoName, job_id,
                    {timeout: selectJobPromise});

                var buildapiArtifactPromise = ThJobArtifactModel.get_list(
                    {name: "buildapi", "type": "json", job_id: job_id},
                    {timeout: selectJobPromise});

                var jobInfoArtifactPromise = ThJobArtifactModel.get_list({
                    name: "Job Info", "type": "json", job_id: job_id},
                    {timeout: selectJobPromise});

                var jobLogUrlPromise = ThJobLogUrlModel.get_list(
                    job_id,
                    {timeout: selectJobPromise});

                var jobIdPromise = PhSeries.getSeriesByJobId(
                    $scope.repoName, job_id);

                return $q.all([
                    jobDetailPromise,
                    buildapiArtifactPromise,
                    jobInfoArtifactPromise,
                    jobLogUrlPromise,
                    jobIdPromise
                ]).then(function(results){
                    //the first result comes from the job detail promise
                    $scope.job = results[0];
                    if ($scope.job.state =='running') {
                        $scope.eta = $scope.job.running_time_remaining();
                        $scope.eta_abs = Math.abs($scope.eta);
                    }
                    $scope.average_duration = $scope.job.get_average_duration();
                    $scope.jobRevision = ThResultSetStore.getSelectedJob($scope.repoName).job.revision;
                    $scope.performanceSignaturesForJob = results[4];

                    // set the tab options and selections based on the selected job
                    initializeTabs($scope.job);

                    // the second result come from the buildapi artifact promise
                    var buildapi_artifact = results[1];

                    // if this is a buildbot job use the buildername for searching
                    if (buildapi_artifact.length > 0 &&
                        _.has(buildapi_artifact[0], 'blob')){
                        // this is needed to cancel/retrigger jobs
                        $scope.artifacts.buildapi = buildapi_artifact[0];
                    }

                    // filtering values for data fields and signature
                    $scope.jobSearchStr = thJobSearchStr($scope.job);
                    $scope.jobSearchSignature = $scope.job.signature;
                    $scope.jobSearchStrHref = getJobSearchStrHref($scope.jobSearchStr);
                    $scope.jobSearchSignatureHref = getJobSearchStrHref($scope.job.signature);
                    // the third result comes from the job info artifact promise
                    var jobInfoArtifact = results[2];
                    if (jobInfoArtifact.length > 0) {
                        // The job artifacts may have many "Job Info" blobs so
                        // we merge them here to make displaying them in the UI
                        // easier.
                        $scope.job_details = jobInfoArtifact.reduce(function(result, artifact) {
                            if (artifact.blob && Array.isArray(artifact.blob.job_details)) {
                                result = result.concat(artifact.blob.job_details);
                            }
                            if ($scope.artifacts.buildapi) {
                                $scope.artifacts.buildapi.blob.title = "Buildername";
                                $scope.artifacts.buildapi.blob.value = $scope.artifacts.buildapi.blob.buildername;
                                result = result.concat($scope.artifacts.buildapi.blob);
                            }
                            return result;
                        }, []);
                        if ($scope.performanceSignaturesForJob !== null) {
                            var signatureList = _.keys($scope.performanceSignaturesForJob);
                            var seriesList = [];
                            $scope.perfJobDetail = [];
                            $q.all(_.chunk(signatureList, 20).map(function(signatureChunk) {
                                var url = '/performance/signatures/?signature=' + signatureChunk.pop();
                                signatureChunk.forEach(function(signature) {
                                    url = url + '&signature=' + signature;
                                });
                                return $http.get(thUrl.getProjectUrl(url, $scope.repoName)).then(
                                    function(response) {
                                        _.map(response.data, function(series, key) {
                                            series['signature'] = key;
                                            seriesList.push(series);
                                        });
                                    });
                            })).then(function(){
                                var allSubtestSignatures = _.flatten(_.map(seriesList, function(series) {
                                    return series.subtest_signatures ? series.subtest_signatures : [];
                                }));
                                _.forEach(seriesList, function(series) {
                                    if (!series.subtest_signatures) {
                                        if (_.contains(allSubtestSignatures, series.signature)) {
                                            return;
                                        }
                                    }
                                    var detail = {};
                                    detail['url'] = thServiceDomain + '/perf.html#/graphs?series=[' +
                                        $scope.repoName+ ',' + series.signature + ',1]&selected=[' +
                                        $scope.repoName + ',' +  series.signature + ',' +
                                        $scope.job['result_set_id'] + ',' + $scope.job['id'] + ']';
                                    detail['value'] = $scope.performanceSignaturesForJob[series.signature][0].value;
                                    detail['title'] = series.suite;
                                    if (series.hasOwnProperty('test') && series.test.toLowerCase() !== series.suite) {
                                        detail['title'] += '_' + series.test.toLowerCase();
                                    }

                                    $scope.perfJobDetail.push(detail);
                                });
                            });
                        }
                    }

                    // the fourth result comes from the jobLogUrl artifact
                    // exclude the json log URLs
                    $scope.job_log_urls = _.reject(results[3], {name: 'mozlog_json'});

                    // Provide a parse status as a scope variable for logviewer shortcut
                    if (!$scope.job_log_urls.length) {
                        $scope.logParseStatus = 'unavailable';
                    } else if ($scope.job_log_urls[0].parse_status) {
                        $scope.logParseStatus = $scope.job_log_urls[0].parse_status;
                    }

                    // Provide a parse status for the model
                    var logsNotParsed = [];
                    $scope.jobLogsAllParsed = _.every($scope.job_log_urls, function(jlu) {
                        if(jlu.parse_status === 'pending'){
                            logsNotParsed.push(jlu);
                            return false;
                        }else{
                            return true;
                        }
                    });

                    // retry to fetch the job info if a log hasn't been parsed yet
                    if(logsNotParsed.length > 0){
                        // first parse all the unparsed logs
                        $q.all(_.map(logsNotParsed, function(log){return log.parse();}))
                        .then(function(parseLogResponses){
                            // then retry to fetch the job info if the parse requests
                            // were successful
                            if(_.every(
                                parseLogResponses,
                                function(parseLogResponse){return parseLogResponse.status === 200;}
                            )){
                                selectJobRetryPromise = $timeout(function(){
                                    // refetch the job data details
                                    selectJobAndRender(job_id);
                                }, 5000);
                            }
                        });
                    }
                    $scope.lvUrl = thUrl.getLogViewerUrl($scope.job.id);
                    $scope.lvFullUrl = location.origin + "/" + $scope.lvUrl;
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
                "Build": $scope.job.build_architecture + " " +
                         $scope.job.build_platform  + " " +
                         $scope.job.build_os || undef,
                "Job name": $scope.job.job_type_name || undef
            };

            // time fields to show in detail panel, but that should be grouped together
            $scope.visibleTimeFields = {
                requestTime: dateFilter($scope.job.submit_timestamp*1000,
                                        thDateFormat)
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

            if ($scope.job.start_timestamp) {
                $scope.visibleTimeFields.startTime = dateFilter(
                    $scope.job.start_timestamp*1000, thDateFormat);
                $scope.visibleTimeFields.duration = duration;
            } else {
                $scope.visibleTimeFields.duration = "Not started (queued for " + duration + ")";
            }

            if ($scope.job.end_timestamp) {
                $scope.visibleTimeFields.endTime = dateFilter(
                    $scope.job.end_timestamp*1000, thDateFormat);
            }

            // Scroll the job details pane to the top during job selection
            var jobDetailsPane = document.getElementById('job-details-pane');
            jobDetailsPane.scrollTop = 0;
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

        $scope.canCancel = function() {
            return $scope.job &&
                   ($scope.job.state === "pending" || $scope.job.state === "running");
        };

        /**
         * Get the build_id needed to cancel or retrigger from the currently
         * selected job.
         */
        var getBuildbotRequestId = function() {
            if ($scope.artifacts.buildapi) {
                return $scope.artifacts.buildapi.blob.request_id;
            }
        };

        $scope.retriggerJob = function(jobs) {
            if ($scope.user.loggedin) {
                var job_id_list = _.pluck(jobs, 'id');
                // The logic here is somewhat complicated because we need to support
                // two use cases the first is the case where we notify a system
                // other then buildbot that a retrigger has been requested. The
                // second is when we have the buildapi id and need to send a request
                // to the self serve api (which does not listen over pulse!).
                ThJobModel.retrigger($scope.repoName, job_id_list).then(function() {
                    // XXX: Remove this after 1134929 is resolved.
                    return ThJobArtifactModel.get_list({"name": "buildapi", "type": "json", "job_id__in": job_id_list.join(',')})
                        .then(function(data) {
                            var request_id_list = _.pluck(_.pluck(data, 'blob'), 'request_id');
                            _.each(request_id_list, function(request_id) {
                                thBuildApi.retriggerJob($scope.repoName, request_id);
                            });
                        });
                }).then(function() {
                    thNotify.send("Retrigger request sent", "success");
                }, function(e) {
                    // Generic error eg. the user doesn't have LDAP access
                    thNotify.send(
                        ThModelErrors.format(e, "Unable to send retrigger"), 'danger');
                });
            } else {
                thNotify.send("Must be logged in to retrigger a job", 'danger');
            }
        };

        $scope.backfillJob = function() {
            if ($scope.user.loggedin) {
                // Only backfill if we have a valid loaded job, if the user
                // tries to backfill eg. via shortcut before the load we warn them
                if ($scope.job.id) {
                    ThJobModel.backfill($scope.repoName, $scope.job.id).then(function() {
                        thNotify.send("Request sent to backfill jobs", 'success');
                    }, function(e) {
                        // Generic error eg. the user doesn't have LDAP access
                        thNotify.send(
                            ThModelErrors.format(e, "Unable to send backfill"), 'danger');
                    });
                } else {
                    thNotify.send("Job not yet loaded for backfill", 'warning');
                }
            } else {
                thNotify.send("Must be logged in to backfill a job", 'danger');
            }
        };

        $scope.cancelJob = function() {
            if ($scope.user.loggedin) {
                // See note in retrigger logic.
                ThJobModel.cancel($scope.repoName, $scope.job.id).then(function() {
                  // XXX: Remove this after 1134929 is resolved.
                    var requestId = getBuildbotRequestId();
                    if (requestId) {
                        return thBuildApi.cancelJob($scope.repoName, requestId);
                    }
                }).catch(function(e) {
                    thNotify.send(
                        ThModelErrors.format(e, "Unable to cancel job"),
                        "danger", true
                    );
                });
            } else {
                thNotify.send("Must be logged in to cancel a job", 'danger');
            }
        };

        // Test to expose the reftest button in the job details navbar
        $scope.isReftest = function() {
            if ($scope.selectedJob) {
                return thReftestStatus($scope.selectedJob);
            }
        };

        var selectJobAndRender = function(job_id) {
            $scope.jobLoadedPromise = selectJob(job_id);
            $scope.jobLoadedPromise.then(function(){
                thTabs.showTab(thTabs.selectedTab, job_id);
            });
        };

        $rootScope.$on(thEvents.jobClick, function(event, job) {
            selectJobAndRender(job.id);
            $rootScope.selectedJob = job;
        });

        $rootScope.$on(thEvents.clearSelectedJob, function(event, job) {
            if(selectJobPromise !== null){
                $timeout.cancel(selectJobPromise);
            }
            if( selectJobRetryPromise !== null){
                $timeout.cancel(selectJobRetryPromise);
            }
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

        // Open the logviewer and provide notifications if it isn't available
        $rootScope.$on(thEvents.openLogviewer, function() {
            if ($scope.logParseStatus === 'pending') {
                thNotify.send("Log parsing in progress, log viewer not yet available", 'info');
            } else if ($scope.logParseStatus === 'failed') {
                thNotify.send("Log parsing has failed, log viewer is unavailable", 'warning');
            } else if ($scope.logParseStatus === 'unavailable') {
                thNotify.send("No logs available for this job", 'info');
            // If it's available open the logviewer
            } else if ($scope.logParseStatus === 'parsed') {
                $('#logviewer-btn')[0].click();
            }
        });

        $rootScope.$on(thEvents.jobRetrigger, function(event, job) {
            $scope.retriggerJob([job]);
        });

        $rootScope.$on(thEvents.jobsClassified, function(event, job) {
            // use $timeout here so that all the other $digest operations related to
            // the event of ``jobsClassified`` will be done.  This will then
            // be a new $digest cycle.
            $timeout($scope.updateClassifications);
        });

        $rootScope.$on(thEvents.bugsAssociated, function(event, job) {
            $scope.updateBugs();
        });

        $scope.pinboard_service = thPinboard;

        // expose the tab service properties on the scope
        $scope.tabService = thTabs;

        //fetch URLs
        $scope.getBugUrl = thUrl.getBugUrl;
        $scope.getSlaveHealthUrl = thUrl.getSlaveHealthUrl;
    }
]);
