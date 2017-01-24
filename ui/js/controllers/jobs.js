"use strict";

treeherderApp.controller('JobsCtrl', [
    '$scope', '$http', '$rootScope', '$routeParams', 'ThLog',
    'thUrl', 'ThRepositoryModel', 'thDefaultRepo',
    'ThResultSetStore', 'thResultStatusList', '$location', 'thEvents',
    'ThJobModel', 'thNotify',
    function JobsCtrl(
        $scope, $http, $rootScope, $routeParams, ThLog,
        thUrl, ThRepositoryModel, thDefaultRepo,
        ThResultSetStore, thResultStatusList, $location, thEvents, ThJobModel, thNotify) {

        // load our initial set of resultsets
        // scope needs this function so it can be called directly by the user, too.
        $scope.getNextResultSets = function(count, keepFilters) {
            var revision = $location.search().revision;
            if (revision) {
                $rootScope.skipNextPageReload = true;
                $location.search('revision', null);
                $location.search('tochange', revision);
            }
            ThResultSetStore.fetchResultSets($scope.repoName, count, keepFilters).
                then(function() {

                    // since we fetched more resultsets, we need to persist the
                    // resultset state in the URL.
                    var rsArray = ThResultSetStore.getResultSetsArray($scope.repoName);
                    var updatedLastRevision = _.last(rsArray).revision;
                    if ($location.search().fromchange !== updatedLastRevision) {
                        $rootScope.skipNextPageReload = true;
                        $location.search('fromchange', updatedLastRevision);
                    }
                });
        };

        // set to the default repo if one not specified
        if ($routeParams.hasOwnProperty("repo") &&
            $routeParams.repo !== "") {
            $rootScope.repoName = $routeParams.repo;
        } else {
            $rootScope.repoName = thDefaultRepo;
            $location.search("repo", $rootScope.repoName);
        }

        ThResultSetStore.addRepository($scope.repoName);

        $scope.isLoadingRsBatch = ThResultSetStore.getLoadingStatus($scope.repoName);
        $scope.result_sets = ThResultSetStore.getResultSetsArray($scope.repoName);
        $scope.job_map = ThResultSetStore.getJobMap($scope.repoName);

        $scope.searchParams = $location.search();
        $scope.locationHasSearchParam = function(prop) {
            return _.has($scope.searchParams, prop);
        };

        $scope.getSearchParamValue = function(param) {
            var params = $location.search();
            var searchParamValue = params[param];
            // in the event the user manually strips off the search
            // parameter and its = sign, which would return true
            if (searchParamValue === true) {
                return "";
            }
            return searchParamValue;
        };

        if ($location.search().revision === 'undefined') {
            thNotify.send("Invalid value for revision parameter.", 'danger');
        }

        if (ThResultSetStore.isNotLoaded($scope.repoName)) {
            // get our first set of resultsets
            ThResultSetStore.fetchResultSets(
                $scope.repoName,
                ThResultSetStore.defaultResultSetCount,
                true);
        }

        $rootScope.$on(thEvents.toggleAllRevisions, function(ev, expand) {
            _.forEach($scope.result_sets, function(rs) {
                $rootScope.$emit(thEvents.toggleRevisions, rs, expand);
            });
        });
    }
]);


treeherderApp.controller('ResultSetCtrl', [
    '$scope', '$rootScope', '$http', 'ThLog', '$location',
    'thUrl', 'thServiceDomain', 'thResultStatusInfo', 'thDateFormat',
    'ThResultSetStore', 'thEvents', 'thJobFilters', 'thNotify',
    'thBuildApi', 'thPinboard', 'ThResultSetModel', 'dateFilter',
    'ThModelErrors', 'ThJobModel',
    function ResultSetCtrl(
        $scope, $rootScope, $http, ThLog, $location,
        thUrl, thServiceDomain, thResultStatusInfo, thDateFormat,
        ThResultSetStore, thEvents, thJobFilters, thNotify,
        thBuildApi, thPinboard, ThResultSetModel, dateFilter, ThModelErrors,
        ThJobModel) {

        $scope.getCountClass = function(resultStatus) {
            return thResultStatusInfo(resultStatus).btnClass;
        };
        $scope.getCountText = function(resultStatus) {
            return thResultStatusInfo(resultStatus).countText;
        };
        $scope.viewJob = function(job) {
            // set the selected job
            $rootScope.selectedJob = job;
        };

        $scope.toggleRevisions = function() {

            ThResultSetStore.loadRevisions(
                $rootScope.repoName, $scope.resultset.id
            );

            $rootScope.$emit(
                thEvents.toggleRevisions, $scope.resultset
            );

        };

        /**
         * Pin all jobs that pass the global filters.
         *
         * If optional resultsetId is passed in, then only pin jobs from that
         * resultset.
         */
        $scope.pinAllShownJobs = function() {
            if (!thPinboard.spaceRemaining()) {
                thNotify.send("Pinboard is full.  Can not pin any more jobs.",
                              "danger");
                return;
            }
            var shownJobs = ThResultSetStore.getAllShownJobs(
                $rootScope.repoName,
                thPinboard.spaceRemaining(),
                thPinboard.maxNumPinned,
                $scope.resultset.id
            );
            thPinboard.pinJobs(shownJobs);

            if (!$rootScope.selectedJob) {
                $scope.viewJob(shownJobs[0]);
            }

        };

        $scope.showRunnableJobs = function() {
            $rootScope.$emit(thEvents.showRunnableJobs, $scope.resultset);
        };

        $scope.deleteRunnableJobs = function() {
            $rootScope.$emit(thEvents.deleteRunnableJobs, $scope.resultset);
        };

        $scope.getCancelJobsTitle = function(revision) {
            if (!$scope.user || !$scope.user.loggedin) {
                return "Must be logged in to cancel jobs";
            }
            var job = ThResultSetStore.getSelectedJob($scope.repoName).job;
            var singleJobSelected = job instanceof ThJobModel;
            if (singleJobSelected && job.revision === revision) {
                if ($scope.canCancelJobs()) {
                    return "Cancel selected job";
                }
                return "Cannot cancel completed job";
            }
            return "Cancel all jobs";
        };

        $scope.canCancelJobs = function() {
            return $scope.user && $scope.user.loggedin;
        };

        $scope.confirmCancelAllJobs = function() {
            $scope.showConfirmCancelAll = true;
        };

        $scope.hideConfirmCancelAll = function() {
            $scope.showConfirmCancelAll = false;
        };

        $scope.cancelAllJobs = function(revision) {
            $scope.showConfirmCancelAll = false;
            if (!$scope.canCancelJobs())
                return;

            ThResultSetModel.cancelAll($scope.resultset.id, $scope.repoName).then(function() {
                return thBuildApi.cancelAll($scope.repoName, revision);
            }).catch(function(e) {
                thNotify.send(
                    ThModelErrors.format(e, "Failed to cancel all jobs"),
                    'danger', true
                );
            });
        };

        $scope.triggerMissingJobs = function(revision) {
            if (!window.confirm('This will trigger all missing jobs for revision ' + revision + '!\n\nClick "OK" if you want to proceed.')) {
                return;
            }

            ThResultSetModel.triggerMissingJobs($scope.resultset.id, $scope.repoName).then(function() {
                thNotify.send("Request sent to trigger missing jobs", "success");
            }, function(e) {
                thNotify.send(
                    ThModelErrors.format(e, "The action 'trigger missing jobs' failed"),
                    'danger', true
                );
            });
        };

        $scope.triggerAllTalosJobs = function(revision) {
            if (!window.confirm('This will trigger all talos jobs for revision ' + revision + '!\n\nClick "OK" if you want to proceed.')) {
                return;
            }

            var times = parseInt(window.prompt("Enter number of instances to have for each talos job", 6));
            while (times < 1 || times > 6 || isNaN(times)) {
                times = window.prompt("We only allow instances of each talos job to be between 1 to 6 times. Enter again", 6);
            }

            ThResultSetModel.triggerAllTalosJobs($scope.resultset.id, $scope.repoName, times).then(function() {
                thNotify.send("Request sent to trigger all talos jobs " + times + " time(s)", "success");
            }, function(e) {
                thNotify.send(
                    ThModelErrors.format(e, "The action 'trigger all talos jobs' failed"),
                    'danger', true
                );
            });
        };

        $scope.showTriggerButton = function() {
            var buildernames = ThResultSetStore.getSelectedRunnableJobs($rootScope.repoName, $scope.resultset.id);
            return buildernames.length > 0;
        };

        $scope.triggerNewJobs = function() {
            if (!window.confirm(
                'This will trigger all selected jobs. Click "OK" if you want to proceed.')) {
                return;
            }
            if ($scope.user.loggedin) {
                var buildernames = ThResultSetStore.getSelectedRunnableJobs($rootScope.repoName, $scope.resultset.id);
                ThResultSetStore.getGeckoDecisionTaskID($rootScope.repoName, $scope.resultset.id).then(function(decisionTaskID) {
                    ThResultSetModel.triggerNewJobs($scope.repoName, $scope.resultset.id, buildernames, decisionTaskID).then(function() {
                        thNotify.send("Trigger request sent", "success");
                        ThResultSetStore.deleteRunnableJobs($scope.repoName, $scope.resultset);
                    }, function(e) {
                        // Generic error eg. the user doesn't have permission
                        thNotify.send(
                            ThModelErrors.format(e, "Unable to send trigger"), 'danger');
                    });
                });
            } else {
                thNotify.send("Must be logged in to trigger a job", 'danger');
            }
        };

        $scope.revisionResultsetFilterUrl = $scope.urlBasePath + "?repo=" +
            $scope.repoName + "&revision=" +
            $scope.resultset.revision;

        $scope.resultsetDateStr = dateFilter($scope.resultset.push_timestamp*1000,
                                             thDateFormat);

        $scope.authorResultsetFilterUrl = $scope.urlBasePath + "?repo=" +
            $scope.repoName + "&author=" +
            encodeURIComponent($scope.resultset.author);
    }
]);
