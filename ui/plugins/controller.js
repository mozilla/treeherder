"use strict";

treeherder.controller('PluginCtrl', [
    '$scope', '$rootScope', '$location', '$http', 'thUrl', 'ThJobClassificationModel',
    'thClassificationTypes', 'ThJobModel', 'thEvents', 'dateFilter', 'thDateFormat',
    'numberFilter', 'ThBugJobMapModel', 'thResultStatus', 'thJobFilters',
    'ThResultSetModel', 'ThLog', '$q', 'thPinboard', 'ThJobArtifactModel',
    'ThJobDetailModel', 'thBuildApi', 'thNotify', 'ThJobLogUrlModel', 'ThModelErrors',
    'thTabs', '$timeout', 'thReftestStatus', 'ThResultSetStore',
    'PhSeries', 'thServiceDomain',
    function PluginCtrl(
        $scope, $rootScope, $location, $http, thUrl, ThJobClassificationModel,
        thClassificationTypes, ThJobModel, thEvents, dateFilter, thDateFormat,
        numberFilter, ThBugJobMapModel, thResultStatus, thJobFilters,
        ThResultSetModel, ThLog, $q, thPinboard, ThJobArtifactModel,
        ThJobDetailModel, thBuildApi, thNotify, ThJobLogUrlModel, ThModelErrors, thTabs,
        $timeout, thReftestStatus, ThResultSetStore, PhSeries,
        thServiceDomain) {

        var $log = new ThLog("PluginCtrl");

        $scope.job = {};
        $scope.artifacts = {};

        var reftestUrlRoot = "https://hg.mozilla.org/mozilla-central/raw-file/tip/layout/tools/reftest/reftest-analyzer.xhtml#logurl=";

        var getJobSearchStrHref = function(jobSearchStr){
            var absUrl = $location.absUrl();

            // Don't double up the searchStr param
            if(absUrl.indexOf('filter-searchStr=') !== -1){
                var replaceString = 'filter-searchStr=' +
                                    absUrl.split('filter-searchStr=')[1].split('&')[0];
                absUrl = absUrl.replace(replaceString, 'filter-searchStr=' +
                         encodeURIComponent(jobSearchStr));
            } else {
                // If there are parameters, the parameter delimiter '&'
                // should be used
                var delimiter = '?';
                if(absUrl.indexOf('?') !== -1){
                    delimiter = '&';
                }

                absUrl = absUrl + delimiter + 'filter-searchStr=' +
                         encodeURIComponent(jobSearchStr);
            }
            return absUrl;
        };

        $scope.filterByJobSearchStr = function(jobSearchStr) {
            thJobFilters.replaceFilter('searchStr', jobSearchStr || null);
        };

        // if the ``autoclassify`` param is set on the query sting, then
        // show the ``autoClassification`` tab.  Otherwise, hide it.
        // NOTE: This is a temporary param used during the evaluation/experimentation
        // phase of this feature.
        var showAutoClassifyTab = function() {
            thTabs.tabs.autoClassification.enabled = ($location.search().autoclassify === true ||
                                                      ($rootScope.user && $rootScope.user.is_staff) ||
                                                      $location.host().indexOf('herokuapp.com') !== -1) &&
                                                      $location.search().noautoclassify !== true;
        };
        showAutoClassifyTab();
        $rootScope.$on('$locationChangeSuccess', function() {
            showAutoClassifyTab();
        });
        $rootScope.$on('userChange', function() {
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

            // Error Classification/autoclassify special handling
            if ($scope.tabService.tabs.autoClassification.enabled) {
                failTab = "autoClassification";
            }

            $scope.tabService.tabs.perfDetails.enabled = false;
            // Load performance data regardless of status, but only switch to
            // it if job was successful.
            $http.get(thServiceDomain + '/api/project/' + $scope.repoName +
                      '/performance/data/?job_id=' + job.id).then(function(response) {
                          if (!_.isEmpty(response.data) && job.job_type_name !== "Build") {
                              $scope.tabService.tabs.perfDetails.enabled = true;
                              if (thResultStatus(job) === 'success') {
                                  $scope.tabService.selectedTab = 'perfDetails';
                              }
                          }
                      });
            if (thResultStatus(job) === 'success') {
                $scope.tabService.selectedTab = successTab;
            } else {
                $scope.tabService.selectedTab = failTab;
            }
        };

        // this promise will void all the ajax requests
        // triggered by selectJob once resolved
        var selectJobPromise = null;

        var selectJob = function(job) {
            // make super-extra sure that the autoclassify tab shows up when it should
            showAutoClassifyTab();

            // set the scope variables needed for the job detail panel
            if (job.id) {
                $scope.job_detail_loading = true;
                if(selectJobPromise !== null){
                    $log.debug("timing out previous job request");
                    selectJobPromise.resolve();
                }
                selectJobPromise = $q.defer();

                $scope.job = {};
                $scope.artifacts = {};
                $scope.job_details = [];
                var jobPromise = ThJobModel.get(
                    $scope.repoName, job.id,
                    {timeout: selectJobPromise});

                var jobDetailPromise = ThJobDetailModel.getJobDetails(
                    {job_guid: job.job_guid},
                    {timeout: selectJobPromise});

                var jobLogUrlPromise = ThJobLogUrlModel.get_list(
                    job.id,
                    {timeout: selectJobPromise});

                var phSeriesPromise = PhSeries.getSeriesData(
                    $scope.repoName, { job_id: job.id });

                return $q.all([
                    jobPromise,
                    jobDetailPromise,
                    jobLogUrlPromise,
                    phSeriesPromise
                ]).then(function(results){

                    //the first result comes from the job promise
                    $scope.job = results[0];
                    if ($scope.job.state === 'running') {
                        $scope.eta = $scope.job.running_time_remaining();
                        $scope.eta_abs = Math.abs($scope.eta);
                    }
                    $scope.average_duration = $scope.job.get_average_duration();
                    var resultsetId = ThResultSetStore.getSelectedJob($scope.repoName).job.result_set_id;
                    $scope.jobRevision = ThResultSetStore.getResultSet($scope.repoName, resultsetId).revision;

                    // set the tab options and selections based on the selected job
                    initializeTabs($scope.job);

                    // filtering values for data fields and signature
                    $scope.jobSearchStr = $scope.job.get_title();
                    $scope.jobSearchSignature = $scope.job.signature;
                    $scope.jobSearchStrHref = getJobSearchStrHref($scope.jobSearchStr);
                    $scope.jobSearchSignatureHref = getJobSearchStrHref($scope.job.signature);

                    // the second result comes from the job detail promise
                    $scope.job_details = results[1];

                    // incorporate the buildername into the job details if this is a buildbot job
                    // (i.e. it has a buildbot request id)
                    var buildbotRequestIdDetail = _.find($scope.job_details,
                                                   {title: 'buildbot_request_id'});
                    if (buildbotRequestIdDetail) {
                        $scope.job_details = $scope.job_details.concat({
                            title: "Buildername",
                            value: $scope.job.ref_data_name
                        });
                        $scope.buildernameIndex = _.findIndex($scope.job_details, {title: "Buildername"});
                        $scope.job.buildbot_request_id = parseInt(buildbotRequestIdDetail.value);
                    }

                    // the third result comes from the jobLogUrl artifact
                    // exclude the json log URLs
                    $scope.job_log_urls = _.reject(
                        results[2],
                        function(log) {
                            return log.name.endsWith("_json");
                        });

                    // Provide a parse status as a scope variable for logviewer shortcut
                    if (!$scope.job_log_urls.length) {
                        $scope.logParseStatus = 'unavailable';
                    } else if ($scope.job_log_urls[0].parse_status) {
                        $scope.logParseStatus = $scope.job_log_urls[0].parse_status;
                    }

                    // Provide a parse status for the model
                    $scope.jobLogsAllParsed = _.every($scope.job_log_urls, function(jlu) {
                        return jlu.parse_status !== 'pending';
                    });

                    $scope.lvUrl = thUrl.getLogViewerUrl($scope.job.id);
                    $scope.lvFullUrl = location.origin + "/" + $scope.lvUrl;
                    if ($scope.job_log_urls.length) {
                        $scope.reftestUrl = reftestUrlRoot + $scope.job_log_urls[0].url + "&only_show_unexpected=1";
                    }
                    $scope.resultStatusShading = "result-status-shading-" + thResultStatus($scope.job);

                    var performanceData = results[3];
                    if (performanceData) {
                        var seriesList = [];
                        $scope.perfJobDetail = [];
                        $q.all(_.chunk(_.keys(performanceData), 20).map(function(signatureHashes) {
                            var signatureIds = _.map(signatureHashes, function(signatureHash) {
                                return performanceData[signatureHash][0].signature_id;
                            });
                            return PhSeries.getSeriesList($scope.repoName, { id: signatureIds }).then(function(newSeriesList) {
                                seriesList = seriesList.concat(newSeriesList);
                            });
                        })).then(function() {
                            _.forEach(seriesList, function(series) {
                                // skip series which are subtests of another series
                                if (series.parentSignature)
                                    return;
                                var detail = {
                                    url: thServiceDomain + '/perf.html#/graphs?series=[' +
                                        [ $scope.repoName, series.signature, 1,
                                          series.frameworkId ] + ']&selected=[' +
                                        [ $scope.repoName, series.signature,
                                          $scope.job['result_set_id'], $scope.job['id'] ] +
                                        ']',
                                    value: performanceData[series.signature][0].value,
                                    title: series.suite
                                };
                                if (series.test && series.test.toLowerCase() !== series.suite) {
                                    detail['title'] += '_' + series.test.toLowerCase();
                                }

                                $scope.perfJobDetail.push(detail);
                            });
                        });
                    }

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
                         $scope.job.build_platform + " " +
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
                    return ThJobDetailModel.getJobDetails({"title": "buildbot_request_id",
                                                           "job_id__in": job_id_list.join(',')})
                        .then(function(data) {
                            var requestIdList = _.pluck(data, 'value');
                            requestIdList.forEach(function(requestId) {
                                thBuildApi.retriggerJob($scope.repoName, requestId);
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
            if ($scope.canBackfill()) {
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
            }
        };

        // Can we backfill? At the moment, this only ensures we're not in a 'try' repo.
        $scope.canBackfill = function() {
            return $scope.currentRepo && $scope.currentRepo.repository_group.name !== 'try';
        };

        $scope.backfillEnabledString = "Trigger jobs of this type on prior pushes, " +
                                       "to fill in gaps where the job was not run";
        $scope.backfillDisabledString = "Backfilling not available in this repository";

        $scope.cancelJob = function() {
            if ($scope.user.loggedin) {
                // See note in retrigger logic.
                ThJobModel.cancel($scope.repoName, $scope.job.id).then(function() {
                  // XXX: Remove this after 1134929 is resolved.
                    var requestId = $scope.job.buildbot_request_id;
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

        var selectJobAndRender = function(job) {
            $scope.jobLoadedPromise = selectJob(job);
            $scope.jobLoadedPromise.then(function(){
                thTabs.showTab(thTabs.selectedTab, job.id);
            });
        };

        $rootScope.$on(thEvents.jobClick, function(event, job) {
            selectJobAndRender(job);
            $rootScope.selectedJob = job;
        });

        $rootScope.$on(thEvents.clearSelectedJob, function() {
            if(selectJobPromise !== null){
                $timeout.cancel(selectJobPromise);
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

        $rootScope.$on(thEvents.jobsClassified, function() {
            // use $timeout here so that all the other $digest operations related to
            // the event of ``jobsClassified`` will be done.  This will then
            // be a new $digest cycle.
            $timeout($scope.updateClassifications);
        });

        $rootScope.$on(thEvents.bugsAssociated, function() {
            $scope.updateBugs();
        });

        $rootScope.$on(thEvents.classificationVerified, function() {
            // These operations are unneeded unless we verified the full job,
            // But getting that information to here seems to be non-trivial
            $scope.updateBugs();
            $timeout($scope.updateClassifications);
            ThResultSetStore.fetchJobs($scope.repoName, [$scope.job.id]);
            // Emit an event indicating that a job has been classified, although
            // it might in fact not have been
            var jobs = {};
            jobs[$scope.job.id] = $scope.job;
            $rootScope.$emit(thEvents.jobsClassified, {jobs: jobs});
        });

        $scope.pinboard_service = thPinboard;

        // expose the tab service properties on the scope
        $scope.tabService = thTabs;

        //fetch URLs
        $scope.getBugUrl = thUrl.getBugUrl;
        $scope.getSlaveHealthUrl = thUrl.getSlaveHealthUrl;
    }
]);
