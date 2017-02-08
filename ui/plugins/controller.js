"use strict";

treeherder.controller('PluginCtrl', [
    '$scope', '$rootScope', '$location', '$http', '$interpolate', 'thUrl', 'ThJobClassificationModel',
    'thClassificationTypes', 'ThJobModel', 'thEvents', 'dateFilter', 'thDateFormat',
    'numberFilter', 'ThBugJobMapModel', 'thResultStatus', 'thJobFilters',
    'ThResultSetModel', 'ThLog', '$q', 'thPinboard',
    'ThJobDetailModel', 'thBuildApi', 'thNotify', 'ThJobLogUrlModel', 'ThModelErrors', 'ThTaskclusterErrors',
    'thTabs', '$timeout', 'thReftestStatus', 'ThResultSetStore',
    'PhSeries', 'thServiceDomain', 'thTaskcluster',
    function PluginCtrl(
        $scope, $rootScope, $location, $http, $interpolate, thUrl, ThJobClassificationModel,
        thClassificationTypes, ThJobModel, thEvents, dateFilter, thDateFormat,
        numberFilter, ThBugJobMapModel, thResultStatus, thJobFilters,
        ThResultSetModel, ThLog, $q, thPinboard,
        ThJobDetailModel, thBuildApi, thNotify, ThJobLogUrlModel, ThModelErrors, ThTaskclusterErrors, thTabs,
        $timeout, thReftestStatus, ThResultSetStore, PhSeries,
        thServiceDomain, thTaskcluster) {

        var $log = new ThLog("PluginCtrl");

        $scope.job = {};

        var reftestUrlRoot = "https://hg.mozilla.org/mozilla-central/raw-file/tip/layout/tools/reftest/reftest-analyzer.xhtml#logurl=";

        var getJobSearchStrHref = function(jobSearchStr){
            var absUrl = $location.absUrl();

            // Don't double up the searchStr param
            if (absUrl.indexOf('filter-searchStr=') !== -1){
                var replaceString = 'filter-searchStr=' +
                                    absUrl.split('filter-searchStr=')[1].split('&')[0];
                absUrl = absUrl.replace(replaceString, 'filter-searchStr=' +
                         encodeURIComponent(jobSearchStr));
            } else {
                // If there are parameters, the parameter delimiter '&'
                // should be used
                var delimiter = '?';
                if (absUrl.indexOf('?') !== -1){
                    delimiter = '&';
                }

                absUrl = absUrl + delimiter + 'filter-searchStr=' +
                         encodeURIComponent(jobSearchStr);
            }
            return absUrl;
        };

        // Take a taskcluster task and make all of the timestamps
        // new again. This is pretty much lifted verbatim from
        // mozilla_ci_tools which is used by pulse_actions.
        // We need to do this because action tasks are created with
        // timestamps for expires/created/deadline that are based
        // on the time of the original decision task creation. We must
        // update to the current time, or Taskcluster will reject the
        // task upon creation.
        var refreshTimestamps = function(task) {
            task.expires = thTaskcluster.fromNow('366 days');
            task.created = thTaskcluster.fromNow(0);
            task.deadline = thTaskcluster.fromNow('1 day');
            _.map(task.payload.artifacts, function(artifact) {
                artifact.expires = thTaskcluster.fromNow('365 days');
            });
            return task;
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
                if (selectJobPromise !== null){
                    $log.debug("timing out previous job request");
                    selectJobPromise.resolve();
                }
                selectJobPromise = $q.defer();

                $scope.job = {};
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
                    $scope.resultsetId = ThResultSetStore.getSelectedJob($scope.repoName).job.result_set_id;
                    $scope.jobRevision = ThResultSetStore.getResultSet($scope.repoName, $scope.resultsetId).revision;

                    // set the tab options and selections based on the selected job
                    initializeTabs($scope.job);

                    // filtering values for data fields and signature
                    $scope.jobSearchStr = $scope.job.get_title();
                    $scope.jobSearchSignature = $scope.job.signature;
                    $scope.jobSearchStrHref = getJobSearchStrHref($scope.jobSearchStr);
                    $scope.jobSearchSignatureHref = getJobSearchStrHref($scope.job.signature);

                    // the second result comes from the job detail promise
                    $scope.job_details = results[1];

                    // parse out some specific taskcluster options for display
                    // in the action menu (if they exist)
                    $scope.taskclusterOptions = [];
                    $scope.job_details.forEach((line) => {
                        if (line.value === "Inspect Task" ||
                            line.value === "One Click Loaner") {
                            $scope.taskclusterOptions.push({
                                title: line.value,
                                url: line.url
                            });
                        }
                    });

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
                    }

                    // the third result comes from the jobLogUrl promise
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
                                    title: series.name
                                };

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

        $scope.getCountPinnedTitle = function() {
            var title = "";

            if (thPinboard.count.numPinnedJobs === 1) {
                title = "You have " + thPinboard.count.numPinnedJobs + " job pinned";
            } else if (thPinboard.count.numPinnedJobs > 1) {
                title = "You have " + thPinboard.count.numPinnedJobs + " jobs pinned";
            }

            return title;
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
                                                           "repository": $scope.repoName,
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
                    if ($scope.job.id) {
                        if ($scope.job.build_system_type === 'taskcluster') {
                            ThResultSetStore.getGeckoDecisionTaskID(
                                $scope.repoName,
                                $scope.resultsetId).then(function(decisionTaskId) {
                                    let queue = new thTaskcluster.Queue();
                                    let url = "";
                                    try {
                                        // buildSignedUrl is documented at
                                        // https://github.com/taskcluster/taskcluster-client#construct-signed-urls
                                        // It is necessary here because getLatestArtifact assumes it is getting back
                                        // JSON as a reponse due to how the client library is constructed. Since this
                                        // result is yml, we'll fetch it manually using $http and can use the url
                                        // returned by this method.
                                        url = queue.buildSignedUrl(
                                            queue.getLatestArtifact,
                                            decisionTaskId,
                                            'public/action.yml'
                                        );
                                    } catch (e) {
                                        let errorMsg = 'Missing Taskcluster credentials! Please log out and back in again.';
                                        thNotify.send(errorMsg, 'danger', true);
                                        return;
                                    }
                                    $http.get(url).then(function(resp) {
                                        let action = resp.data;
                                        let template = $interpolate(action);
                                        action = template({
                                            action: 'backfill',
                                            action_args: '--project ' + $scope.repoName + ' --job ' + $scope.job.id,
                                        });
                                        let task = refreshTimestamps(jsyaml.safeLoad(action));
                                        let taskId = thTaskcluster.slugid();
                                        queue.createTask(taskId, task).then(function() {
                                            $scope.$apply(thNotify.send("Request sent to backfill jobs", 'success'));
                                        }, function(e) {
                                            // The full message is too large to fit in a Treeherder
                                            // notification box.
                                            $scope.$apply(thNotify.send(ThTaskclusterErrors.format(e), 'danger', true));
                                        });
                                    });
                                });
                        } else {
                            ThJobModel.backfill(
                                $scope.repoName,
                                $scope.job.id
                            ).then(function() {
                                thNotify.send("Request sent to backfill jobs", 'success');
                            }, function(e) {
                                // Generic error eg. the user doesn't have LDAP access
                                thNotify.send(
                                    ThModelErrors.format(e, "Unable to send backfill"),
                                    'danger'
                                );
                            });
                        }
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
            return $scope.user.loggedin && $scope.currentRepo &&
                   $scope.currentRepo.repository_group.name !== 'try';
        };

        $scope.backfillButtonTitle = function() {
            var title = "";

            // Ensure currentRepo is available on initial page load
            if (!$scope.currentRepo) {
                // still loading
                return undefined;
            }

            if (!$scope.user.loggedin) {
                title = title.concat("must be logged in to backfill a job / ");
            }

            if ($scope.currentRepo.repository_group.name === 'try') {
                title = title.concat("backfill not available in this repository");
            }

            if (title === "") {
                title = "Trigger jobs of ths type on prior pushes " +
                        "to fill in gaps where the job was not run";
            } else {
                // Cut off trailing "/ " if one exists, capitalize first letter
                title = title.replace(/\/ $/,"");
                title = title.replace(/^./, function(l) { return l.toUpperCase(); });
            }

            return title;
        };

        $scope.cancelJobs = function(jobs) {
            var jobIdsToCancel = jobs.filter(job => (job.state === "pending" ||
                                                     job.state === "running")).map(
                                                         job => job.id);
            // get buildbot ids of any buildbot jobs we want to cancel
            // first
            ThJobDetailModel.getJobDetails({
                job_id__in: jobIdsToCancel,
                title: 'buildbot_request_id'
            }).then(function(buildbotRequestIdDetails) {
                return ThJobModel.cancel($scope.repoName, jobIdsToCancel).then(
                    function() {
                        buildbotRequestIdDetails.forEach(
                            function(buildbotRequestIdDetail) {
                                var requestId = parseInt(buildbotRequestIdDetail.value);
                                thBuildApi.cancelJob($scope.repoName, requestId);
                            });
                    });
            }).then(function() {
                thNotify.send("Cancel request sent", "success");
            }).catch(function(e) {
                thNotify.send(
                    ThModelErrors.format(e, "Unable to cancel job"),
                    "danger", true
                );
            });
        };

        $scope.cancelJob = function() {
            $scope.cancelJobs([$scope.job]);
        };

        // Test to expose the reftest button in the job details navbar
        $scope.isReftest = function() {
            if ($scope.selectedJob) {
                return thReftestStatus($scope.selectedJob);
            }
        };

        var selectJobAndRender = function(job) {
            $scope.jobLoadedPromise = selectJob(job);
            $scope.jobLoadedPromise.then(function() {
                thTabs.showTab(thTabs.selectedTab, job.id);
            });
        };

        $rootScope.$on(thEvents.jobClick, function(event, job) {
            selectJobAndRender(job);
            $rootScope.selectedJob = job;
        });

        $rootScope.$on(thEvents.clearSelectedJob, function() {
            if (selectJobPromise !== null){
                $timeout.cancel(selectJobPromise);
            }
        });

        $rootScope.$on(thEvents.selectNextTab, function() {
            // Establish the visible tabs for the job
            var visibleTabs = [];
            for (var i in thTabs.tabOrder) {
                if (thTabs.tabs[thTabs.tabOrder[i]].enabled) {
                    visibleTabs.push(thTabs.tabOrder[i]);
                }
            }

            // Establish where we are and increment one tab
            var t = visibleTabs.indexOf(thTabs.selectedTab);
            if (t === visibleTabs.length - 1) {
                t = 0;
            } else {
                t++;
            }

            // Select that new tab
            thTabs.showTab(visibleTabs[t], $scope.selectedJob.id);
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
