import jsyaml from 'js-yaml';
import { Queue, slugid } from 'taskcluster-client-web';

import treeherder from '../js/treeherder';
import thTaskcluster from '../js/services/taskcluster';
import tcJobActionsTemplate from '../partials/main/tcjobactions.html';
import intermittentTemplate from '../partials/main/intermittent.html';
import { getStatus, isReftest } from '../helpers/jobHelper';
import {
  getBugUrl,
  getSlaveHealthUrl,
  getInspectTaskUrl,
  getLogViewerUrl,
  getReftestUrl,
} from '../helpers/urlHelper';
import { thEvents } from "../js/constants";

treeherder.controller('PluginCtrl', [
    '$scope', '$rootScope', '$location', '$http', '$interpolate', '$uibModal',
    'ThJobClassificationModel',
    'thClassificationTypes', 'ThJobModel', 'dateFilter',
    'numberFilter', 'ThBugJobMapModel', 'thJobFilters',
    '$q', 'thPinboard',
    'ThJobDetailModel', 'thBuildApi', 'thNotify', 'ThJobLogUrlModel', 'ThModelErrors', 'ThTaskclusterErrors',
    'thTabs', '$timeout', 'ThResultSetStore',
    'PhSeries', 'tcactions', 'ThBugSuggestionsModel', 'ThTextLogStepModel',
    function PluginCtrl(
        $scope, $rootScope, $location, $http, $interpolate, $uibModal,
        ThJobClassificationModel,
        thClassificationTypes, ThJobModel, dateFilter,
        numberFilter, ThBugJobMapModel, thJobFilters,
        $q, thPinboard,
        ThJobDetailModel, thBuildApi, thNotify, ThJobLogUrlModel, ThModelErrors, ThTaskclusterErrors, thTabs,
        $timeout, ThResultSetStore, PhSeries,
        tcactions, ThBugSuggestionsModel, ThTextLogStepModel) {

        $scope.job = {};
        $scope.revisionList = [];

        // Show the Failure Summary tab, except if there's a URL parameter to enable Failure Classification one.
        const showAutoClassifyTab = function () {
            thTabs.tabs.autoClassification.enabled = $location.search().autoclassify === true;
        };
        showAutoClassifyTab();
        $rootScope.$on('$locationChangeSuccess', function () {
            showAutoClassifyTab();
        });
        $rootScope.$on('userChange', function () {
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
        const initializeTabs = function (job, hasPerformanceData) {
            let successTab = "jobDetails";
            let failTab = "failureSummary";

            // Error Classification/autoclassify special handling
            if ($scope.tabService.tabs.autoClassification.enabled) {
                failTab = "autoClassification";
            }

            $scope.tabService.tabs.perfDetails.enabled = hasPerformanceData;
            // the success tabs should be "performance" if job was not a build
            const jobType = job.job_type_name;
            if (hasPerformanceData && jobType !== "Build" && jobType !== "Nightly" &&
                !jobType.startsWith('build-')) {
                successTab = 'perfDetails';
            }

            if (getStatus(job) === 'success') {
                $scope.tabService.selectedTab = successTab;
            } else {
                $scope.tabService.selectedTab = failTab;
            }
        };

        $scope.loadBugSuggestions = function () {
            $scope.errors = [];
            ThBugSuggestionsModel.query({
                project: $rootScope.repoName,
                jobId: $scope.job.id
            }, (suggestions) => {
                suggestions.forEach(function (suggestion) {
                    suggestion.bugs.too_many_open_recent = (
                        suggestion.bugs.open_recent.length > $scope.bug_limit
                    );
                    suggestion.bugs.too_many_all_others = (
                        suggestion.bugs.all_others.length > $scope.bug_limit
                    );
                    suggestion.valid_open_recent = (
                        suggestion.bugs.open_recent.length > 0 &&
                            !suggestion.bugs.too_many_open_recent
                    );
                    suggestion.valid_all_others = (
                        suggestion.bugs.all_others.length > 0 &&
                            !suggestion.bugs.too_many_all_others &&
                            // If we have too many open_recent bugs, we're unlikely to have
                            // relevant all_others bugs, so don't show them either.
                            !suggestion.bugs.too_many_open_recent
                    );
                });

                // if we have no bug suggestions, populate with the raw errors from
                // the log (we can do this asynchronously, it should normally be
                // fast)
                if (!suggestions.length) {
                    ThTextLogStepModel.query({
                        project: $rootScope.repoName,
                        jobId: $scope.job.id
                    }, function (textLogSteps) {
                        $scope.errors = textLogSteps
                            .filter(step => step.result !== 'success')
                            .map(function (step) {
                                return {
                                    name: step.name,
                                    result: step.result,
                                    lvURL: getLogViewerUrl($scope.job.id, $rootScope.repoName, step.finished_line_number)
                                };
                            });
                    });
                }
                $scope.suggestions = suggestions;
                $scope.bugSuggestionsLoading = false;
            });
        };

        $scope.fileBug = function (index) {
          const summary = $scope.suggestions[index].search;
          const crashRegex = /application crashed \[@ (.+)\]$/g;
          const crash = summary.match(crashRegex);
          const crashSignatures = crash ? [crash[0].split("application crashed ")[1]] : [];
          const allFailures = $scope.suggestions.map(sugg => (sugg.search.split(" | ")));

          const modalInstance = $uibModal.open({
            template: intermittentTemplate,
            controller: 'BugFilerCtrl',
            size: 'lg',
            openedClass: "filer-open",
            resolve: {
              summary: () => (summary),
              search_terms: () => ($scope.suggestions[index].search_terms),
              fullLog: () => ($scope.job_log_urls[0].url),
              parsedLog: () => ($scope.lvFullUrl),
              reftest: () => ($scope.isReftest() ? $scope.reftestUrl : ""),
              selectedJob: () => ($scope.selectedJob),
              allFailures: () => (allFailures),
              crashSignatures: () => (crashSignatures),
              successCallback: () => (data) => {
                // Auto-classify this failure now that the bug has been filed
                // and we have a bug number
                thPinboard.addBug({ id: data.success });
                $rootScope.$evalAsync(
                  $rootScope.$emit(
                    thEvents.saveClassification));
                // Open the newly filed bug in a new tab or window for further editing
                window.open(getBugUrl(data.success));
              }
            }
          });
          thPinboard.pinJob($scope.selectedJob);

          modalInstance.opened.then(function () {
            window.setTimeout(() => modalInstance.initiate(), 0);
          });
        };

        // this promise will void all the ajax requests
        // triggered by selectJob once resolved
        let selectJobPromise = null;

        const selectJob = function (job) {
            $scope.bugSuggestionsLoading = true;
            // make super-extra sure that the autoclassify tab shows up when it should
            showAutoClassifyTab();

            // set the scope variables needed for the job detail panel
            if (job.id) {
                $scope.job_detail_loading = true;
                if (selectJobPromise !== null) {
                    selectJobPromise.resolve();
                }
                selectJobPromise = $q.defer();

                $scope.job = {};
                $scope.job_details = [];
                const jobPromise = ThJobModel.get(
                    $scope.repoName, job.id,
                    { timeout: selectJobPromise });

                const jobDetailPromise = ThJobDetailModel.getJobDetails(
                    { job_guid: job.job_guid },
                    { timeout: selectJobPromise });

                const jobLogUrlPromise = ThJobLogUrlModel.get_list(
                    job.id,
                    { timeout: selectJobPromise });

                const phSeriesPromise = PhSeries.getSeriesData(
                    $scope.repoName, { job_id: job.id });

                return $q.all([
                    jobPromise,
                    jobDetailPromise,
                    jobLogUrlPromise,
                    phSeriesPromise
                ]).then(function (results) {

                    //the first result comes from the job promise
                    $scope.job = results[0];
                    $scope.resultsetId = ThResultSetStore.getSelectedJob().job.result_set_id;
                    $scope.jobRevision = ThResultSetStore.getPush($scope.resultsetId).revision;

                    // the second result comes from the job detail promise
                    $scope.job_details = results[1];

                    // incorporate the buildername into the job details if this is a buildbot job
                    // (i.e. it has a buildbot request id)
                    const buildbotRequestIdDetail = _.find($scope.job_details,
                                                   { title: 'buildbot_request_id' });
                    if (buildbotRequestIdDetail) {
                        $scope.job_details = $scope.job_details.concat({
                            title: "Buildername",
                            value: $scope.job.ref_data_name
                        });
                        $scope.buildernameIndex = _.findIndex($scope.job_details, { title: "Buildername" });
                    }

                    // the third result comes from the jobLogUrl promise
                    // exclude the json log URLs
                    $scope.job_log_urls = _.reject(
                        results[2],
                        function (log) {
                            return log.name.endsWith("_json");
                        });

                    // Provide a parse status as a scope variable for logviewer shortcut
                    if (!$scope.job_log_urls.length) {
                        $scope.logParseStatus = 'unavailable';
                    } else if ($scope.job_log_urls[0].parse_status) {
                        $scope.logParseStatus = $scope.job_log_urls[0].parse_status;
                    }

                    // Provide a parse status for the model
                    $scope.jobLogsAllParsed = ($scope.job_log_urls ?
                      $scope.job_log_urls.every(jlu => jlu.parse_status !== 'pending') :
                      false);

                    $scope.lvUrl = getLogViewerUrl($scope.job.id, $scope.repoName);
                    $scope.lvFullUrl = location.origin + "/" + $scope.lvUrl;
                    if ($scope.job_log_urls.length) {
                        $scope.reftestUrl = `${getReftestUrl($scope.job_log_urls[0].url)}&only_show_unexpected=1`;
                    }

                    const performanceData = _.flatten(Object.values(results[3]));
                    if (performanceData) {
                        const signatureIds = _.uniq(_.map(performanceData, 'signature_id'));
                        $q.all(_.chunk(signatureIds, 20).map(
                            signatureIdChunk => PhSeries.getSeriesList($scope.repoName, { id: signatureIdChunk })
                        )).then((seriesListList) => {
                            const seriesList = _.flatten(seriesListList);
                            $scope.perfJobDetail = performanceData.map(d => ({
                                series: seriesList.find(s => d.signature_id === s.id),
                                ...d
                            })).filter(d => !d.series.parentSignature).map(d => ({
                                url: `/perf.html#/graphs?series=${[$scope.repoName, d.signature_id, 1, d.series.frameworkId]}&selected=${[$scope.repoName, d.signature_id, $scope.job.result_set_id, d.id]}`,
                                value: d.value,
                                title: d.series.name
                            }));
                        });
                    }

                    // set the tab options and selections based on the selected job
                    initializeTabs($scope.job, (Object.keys(performanceData).length > 0));

                    $scope.updateClassifications();
                    $scope.updateBugs();
                    $scope.loadBugSuggestions();

                    $scope.job_detail_loading = false;
                });
            }
        };

        $scope.getCountPinnedJobs = function () {
            return thPinboard.count.numPinnedJobs;
        };

        $scope.getCountPinnedTitle = function () {
            let title = "";

            if (thPinboard.count.numPinnedJobs === 1) {
                title = "You have " + thPinboard.count.numPinnedJobs + " job pinned";
            } else if (thPinboard.count.numPinnedJobs > 1) {
                title = "You have " + thPinboard.count.numPinnedJobs + " jobs pinned";
            }

            return title;
        };

        $scope.togglePinboardVisibility = function () {
            $scope.isPinboardVisible = !$scope.isPinboardVisible;
        };

        const getRevisionTips = function (list) {
            list.splice(0, list.length);
            const rsArr = ThResultSetStore.getPushArray();
            rsArr.forEach((rs) => {
                list.push({
                    revision: rs.revision,
                    author: rs.author,
                    title: rs.revisions[0].comments.split('\n')[0]
                });
            });
        };

        $scope.$watch('getCountPinnedJobs()', function (newVal, oldVal) {
            if (oldVal === 0 && newVal > 0) {
                $scope.isPinboardVisible = true;
                getRevisionTips($scope.revisionList);
            }
        });

        $scope.canCancel = function () {
            return $scope.job &&
                   ($scope.job.state === "pending" || $scope.job.state === "running");
        };

        $scope.retriggerJob = function (jobs) {
            if ($scope.user.loggedin) {
                // Spin the retrigger button when retriggers happen
                $("#retrigger-btn > span").removeClass("action-bar-spin");
                window.requestAnimationFrame(function () {
                    window.requestAnimationFrame(function () {
                        $("#retrigger-btn > span").addClass("action-bar-spin");
                    });
                });

                const job_id_list = _.map(jobs, 'id');
                // The logic here is somewhat complicated because we need to support
                // two use cases the first is the case where we notify a system other
                // then buildbot that a retrigger has been requested (eg mozilla-taskcluster).
                // The second is when we have the buildapi id and need to send a request
                // to the self serve api (which does not listen over pulse!).
                ThJobModel.retrigger($scope.repoName, job_id_list).then(function () {
                    return ThJobDetailModel.getJobDetails({
                        title: "buildbot_request_id",
                        repository: $scope.repoName,
                        job_id__in: job_id_list.join(',')
                    }).then(function (data) {
                        const requestIdList = _.map(data, 'value');
                        requestIdList.forEach(function (requestId) {
                            thBuildApi.retriggerJob($scope.repoName, requestId);
                        });
                    });
                }).then(function () {
                    thNotify.send("Retrigger request sent", "success");
                }, function (e) {
                    // Generic error eg. the user doesn't have LDAP access
                    thNotify.send(
                        ThModelErrors.format(e, "Unable to send retrigger"), 'danger');
                });
            } else {
                thNotify.send("Must be logged in to retrigger a job", 'danger');
            }
        };

        $scope.backfillJob = function () {
            if (!$scope.canBackfill()) {
                return;
            }
            if (!$scope.user.loggedin) {
                thNotify.send("Must be logged in to backfill a job", 'danger');
                return;
            }
            if (!$scope.job.id) {
                thNotify.send("Job not yet loaded for backfill", 'warning');
                return;
            }

            if ($scope.job.build_system_type === 'taskcluster' || $scope.job.reason.startsWith('Created by BBB for task')) {
                ThResultSetStore.getGeckoDecisionTaskId(
                    $scope.resultsetId).then(function (decisionTaskId) {
                        return tcactions.load(decisionTaskId, $scope.job).then((results) => {
                            const actionTaskId = slugid();
                            if (results) {
                                const backfilltask = _.find(results.actions, { name: 'backfill' });
                                // We'll fall back to actions.yaml if this isn't true
                                if (backfilltask) {
                                    return tcactions.submit({
                                        action: backfilltask,
                                        actionTaskId,
                                        decisionTaskId,
                                        taskId: results.originalTaskId,
                                        task: results.originalTask,
                                        input: {},
                                        staticActionVariables: results.staticActionVariables,
                                    }).then(function () {
                                        $scope.$apply(thNotify.send(`Request sent to backfill job via actions.json (${actionTaskId})`, 'success'));
                                    }, function (e) {
                                        // The full message is too large to fit in a Treeherder
                                        // notification box.
                                        $scope.$apply(thNotify.send(ThTaskclusterErrors.format(e), 'danger', { sticky: true }));
                                    });
                                }
                            }

                            // Otherwise we'll figure things out with actions.yml
                            const queue = new Queue({ credentialAgent: thTaskcluster.getAgent() });

                            // buildUrl is documented at
                            // https://github.com/taskcluster/taskcluster-client-web#construct-urls
                            // It is necessary here because getLatestArtifact assumes it is getting back
                            // JSON as a reponse due to how the client library is constructed. Since this
                            // result is yml, we'll fetch it manually using $http and can use the url
                            // returned by this method.
                            const url = queue.buildUrl(
                                queue.getLatestArtifact,
                                decisionTaskId,
                                'public/action.yml'
                            );
                            $http.get(url).then(function (resp) {
                                let action = resp.data;
                                const template = $interpolate(action);
                                action = template({
                                    action: 'backfill',
                                    action_args: '--project=' + $scope.repoName + ' --job=' + $scope.job.id,
                                });

                                const task = thTaskcluster.refreshTimestamps(jsyaml.safeLoad(action));
                                queue.createTask(actionTaskId, task).then(function () {
                                    $scope.$apply(thNotify.send(`Request sent to backfill job via actions.yml (${actionTaskId})`, 'success'));
                                }, function (e) {
                                    // The full message is too large to fit in a Treeherder
                                    // notification box.
                                    $scope.$apply(thNotify.send(ThTaskclusterErrors.format(e), 'danger', { sticky: true }));
                                });
                            });
                        });
                    });
            } else {
                thNotify.send('Unable to backfill this job type!', 'danger', { sticky: true });
            }
        };

        // Can we backfill? At the moment, this only ensures we're not in a 'try' repo.
        $scope.canBackfill = function () {
            return $scope.user.loggedin && $scope.currentRepo &&
                   !$scope.currentRepo.is_try_repo;
        };

        $scope.backfillButtonTitle = function () {
            let title = "";

            // Ensure currentRepo is available on initial page load
            if (!$scope.currentRepo) {
                // still loading
                return undefined;
            }

            if (!$scope.user.loggedin) {
                title = title.concat("must be logged in to backfill a job / ");
            }

            if ($scope.currentRepo.is_try_repo) {
                title = title.concat("backfill not available in this repository");
            }

            if (title === "") {
                title = "Trigger jobs of ths type on prior pushes " +
                        "to fill in gaps where the job was not run";
            } else {
                // Cut off trailing "/ " if one exists, capitalize first letter
                title = title.replace(/\/ $/, "");
                title = title.replace(/^./, l => l.toUpperCase());
            }
            return title;
        };

        $scope.cancelJobs = function (jobs) {
            const jobIdsToCancel = jobs.filter(job => (job.state === "pending" ||
                                                     job.state === "running")).map(
                                                         job => job.id);
            // get buildbot ids of any buildbot jobs we want to cancel
            // first
            ThJobDetailModel.getJobDetails({
                job_id__in: jobIdsToCancel,
                title: 'buildbot_request_id'
            }).then(function (buildbotRequestIdDetails) {
                return ThJobModel.cancel($scope.repoName, jobIdsToCancel).then(
                    function () {
                        buildbotRequestIdDetails.forEach(
                            function (buildbotRequestIdDetail) {
                                const requestId = parseInt(buildbotRequestIdDetail.value);
                                thBuildApi.cancelJob($scope.repoName, requestId);
                            });
                    });
            }).then(function () {
                thNotify.send("Cancel request sent", "success");
            }).catch(function (e) {
                thNotify.send(
                    ThModelErrors.format(e, "Unable to cancel job"),
                    "danger",
                    { sticky: true }
                );
            });
        };

        $scope.cancelJob = function () {
            $scope.cancelJobs([$scope.job]);
        };

        $scope.customJobAction = function () {
            $uibModal.open({
                template: tcJobActionsTemplate,
                controller: 'TCJobActionsCtrl',
                size: 'lg',
                resolve: {
                    job: function () {
                        return $scope.job;
                    },
                    repoName: function () {
                        return $scope.repoName;
                    },
                    resultsetId: function () {
                        return $scope.resultsetId;
                    }
                }
            });
        };

        // Test to expose the reftest button in the job details navbar
        $scope.isReftest = function () {
            if ($scope.selectedJob) {
                return isReftest($scope.selectedJob);
            }
        };

        const selectJobAndRender = function (job) {
            $scope.jobLoadedPromise = selectJob(job);
            $('#info-panel').addClass('info-panel-slide');
            $scope.jobLoadedPromise.then(function () {
                thTabs.showTab(thTabs.selectedTab, job.id);
            });
        };

        $rootScope.$on(thEvents.jobClick, function (event, job) {
            selectJobAndRender(job);
            $rootScope.selectedJob = job;
        });

        $rootScope.$on(thEvents.clearSelectedJob, function () {
            if (selectJobPromise !== null) {
                $timeout.cancel(selectJobPromise);
            }
        });

        $rootScope.$on(thEvents.selectNextTab, function () {
            // Establish the visible tabs for the job
            const visibleTabs = [];
            for (const i in thTabs.tabOrder) {
                if (thTabs.tabs[thTabs.tabOrder[i]].enabled) {
                    visibleTabs.push(thTabs.tabOrder[i]);
                }
            }

            // Establish where we are and increment one tab
            let t = visibleTabs.indexOf(thTabs.selectedTab);
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
        $scope.updateClassifications = function () {
            ThJobClassificationModel.get_list({ job_id: $scope.job.id }).then(function (response) {
                $scope.classifications = response;
                $scope.latestClassification = $scope.classifications[0];
            });
        };

        // load the list of bug associations (including possibly new ones just
        // added).
        $scope.updateBugs = function () {
            if (_.has($scope.job, "id")) {
                ThBugJobMapModel.get_list({ job_id: $scope.job.id }).then(function (response) {
                    $scope.bugs = response;
                });
            }
        };

        // Open the logviewer and provide notifications if it isn't available
        $rootScope.$on(thEvents.openLogviewer, function () {
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

        $rootScope.$on(thEvents.jobRetrigger, function (event, job) {
            $scope.retriggerJob([job]);
        });

        $rootScope.$on(thEvents.jobsClassified, function () {
            // use $timeout here so that all the other $digest operations related to
            // the event of ``jobsClassified`` will be done.  This will then
            // be a new $digest cycle.
            $timeout($scope.updateClassifications);
        });

        $rootScope.$on(thEvents.bugsAssociated, function () {
            $scope.updateBugs();
        });

        $rootScope.$on(thEvents.autoclassifyVerified, function () {
            // These operations are unneeded unless we verified the full job,
            // But getting that information to here seems to be non-trivial
            $scope.updateBugs();
            $timeout($scope.updateClassifications);
            ThResultSetStore.fetchJobs([$scope.job.id]);
            // Emit an event indicating that a job has been classified, although
            // it might in fact not have been
            const jobs = {};
            jobs[$scope.job.id] = $scope.job;
            $rootScope.$emit(thEvents.jobsClassified, { jobs: jobs });
        });

        $scope.pinboard_service = thPinboard;

        // expose the tab service properties on the scope
        $scope.tabService = thTabs;

        //fetch URLs
        $scope.getBugUrl = getBugUrl;
        $scope.getSlaveHealthUrl = getSlaveHealthUrl;
        $scope.getInspectTaskUrl = getInspectTaskUrl;
    }
]);
