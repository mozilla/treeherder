treeherderApp.controller('JobsCtrl', [
    '$scope', '$rootScope', '$routeParams',
    'thDefaultRepo',
    'ThResultSetStore', '$location', 'thEvents',
    'thNotify',
    function JobsCtrl(
        $scope, $rootScope, $routeParams,
        thDefaultRepo,
        ThResultSetStore, $location, thEvents, thNotify) {

        // load our initial set of resultsets
        // scope needs this function so it can be called directly by the user, too.
        $scope.getNextResultSets = function (count, keepFilters) {
            var revision = $location.search().revision;
            if (revision) {
                $rootScope.skipNextPageReload = true;
                $location.search('revision', null);
                $location.search('tochange', revision);
            }
            ThResultSetStore.fetchResultSets($scope.repoName, count, keepFilters)
                .then(function () {

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
        $scope.locationHasSearchParam = function (prop) {
            return _.has($scope.searchParams, prop);
        };

        $scope.getSearchParamValue = function (param) {
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
    }
]);


treeherderApp.controller('ResultSetCtrl', [
    '$scope', '$rootScope',
    'thResultStatusInfo', 'thDateFormat',
    'ThResultSetStore', 'thEvents', 'thNotify',
    'thBuildApi', 'thPinboard', 'ThResultSetModel', 'dateFilter',
    'ThModelErrors', 'ThTaskclusterErrors', '$uibModal', 'thPinboardCountError',
    function ResultSetCtrl(
        $scope, $rootScope,
        thResultStatusInfo, thDateFormat,
        ThResultSetStore, thEvents, thNotify,
        thBuildApi, thPinboard, ThResultSetModel, dateFilter, ThModelErrors,
        ThTaskclusterErrors, $uibModal, thPinboardCountError) {

        $scope.getCountClass = function (resultStatus) {
            return thResultStatusInfo(resultStatus).btnClass;
        };
        $scope.getCountText = function (resultStatus) {
            return thResultStatusInfo(resultStatus).countText;
        };
        $scope.viewJob = function (job) {
            // set the selected job
            $rootScope.selectedJob = job;
        };

        $scope.toggleRevisions = function () {

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
        $scope.pinAllShownJobs = function () {
            if (!thPinboard.spaceRemaining()) {
                thNotify.send(thPinboardCountError, 'danger');
                return;
            }
            var shownJobs = ThResultSetStore.getAllShownJobs(
                $rootScope.repoName,
                thPinboard.spaceRemaining(),
                thPinboardCountError,
                $scope.resultset.id
            );
            thPinboard.pinJobs(shownJobs);

            if (!$rootScope.selectedJob) {
                $scope.viewJob(shownJobs[0]);
            }

        };

        $scope.showRunnableJobs = function () {
            if ($scope.user.loggedin) {
                $rootScope.$emit(thEvents.showRunnableJobs, $scope.resultset);
            }
        };

        $scope.deleteRunnableJobs = function () {
            $rootScope.$emit(thEvents.deleteRunnableJobs, $scope.resultset);
        };

        $scope.getCancelJobsTitle = function () {
            if (!$scope.user || !$scope.user.loggedin) {
                return "Must be logged in to cancel jobs";
            }
            return "Cancel all jobs";
        };

        $scope.canCancelJobs = function () {
            return $scope.user && $scope.user.loggedin;
        };

        $scope.confirmCancelAllJobs = function () {
            $scope.showConfirmCancelAll = true;
        };

        $scope.hideConfirmCancelAll = function () {
            $scope.showConfirmCancelAll = false;
        };

        $scope.cancelAllJobs = function (revision) {
            $scope.showConfirmCancelAll = false;
            if (!$scope.canCancelJobs()) return;

            ThResultSetModel.cancelAll($scope.resultset.id, $scope.repoName).then(function () {
                return thBuildApi.cancelAll($scope.repoName, revision);
            }).catch(function (e) {
                thNotify.send(
                    ThModelErrors.format(e, "Failed to cancel all jobs"),
                    'danger', true
                );
            });
        };

        $scope.customPushAction = function () {
            $uibModal.open({
                templateUrl: 'partials/main/tcjobactions.html',
                controller: 'TCJobActionsCtrl',
                size: 'lg',
                resolve: {
                    job: () => null,
                    repoName: function () {
                        return $scope.repoName;
                    },
                    resultsetId: function () {
                        return $scope.resultset.id;
                    }
                }
            });
        };

        $scope.triggerMissingJobs = function (revision) {
            if (!window.confirm('This will trigger all missing jobs for revision ' + revision + '!\n\nClick "OK" if you want to proceed.')) {
                return;
            }

            ThResultSetStore.getGeckoDecisionTaskId(
                $scope.repoName,
                $scope.resultset.id
            ).then(function (decisionTaskID) {
                ThResultSetModel.triggerMissingJobs(
                    decisionTaskID
                ).then(function (msg) {
                    thNotify.send(msg, "success");
                }, function (e) {
                    thNotify.send(
                        ThModelErrors.format(e, "The action 'trigger missing jobs' failed"),
                        'danger', true
                    );
                });
            });
        };

        $scope.triggerAllTalosJobs = function (revision) {
            if (!window.confirm('This will trigger all talos jobs for revision ' + revision + '!\n\nClick "OK" if you want to proceed.')) {
                return;
            }

            var times = parseInt(window.prompt("Enter number of instances to have for each talos job", 6));
            while (times < 1 || times > 6 || isNaN(times)) {
                times = window.prompt("We only allow instances of each talos job to be between 1 to 6 times. Enter again", 6);
            }

            ThResultSetStore.getGeckoDecisionTaskId(
                $scope.repoName,
                $scope.resultset.id
            ).then(function (decisionTaskID) {
                ThResultSetModel.triggerAllTalosJobs(
                    times,
                    decisionTaskID
                ).then(function (msg) {
                    thNotify.send(msg, "success");
                }, function (e) {
                    thNotify.send(ThTaskclusterErrors.format(e), 'danger', { sticky: true });
                });
            });
        };

        $scope.showTriggerButton = function () {
            var buildernames = ThResultSetStore.getSelectedRunnableJobs($rootScope.repoName, $scope.resultset.id);
            return buildernames.length > 0;
        };

        $scope.triggerNewJobs = function () {
            if (!window.confirm(
                'This will trigger all selected jobs. Click "OK" if you want to proceed.')) {
                return;
            }
            if ($scope.user.loggedin) {
                var buildernames = ThResultSetStore.getSelectedRunnableJobs($rootScope.repoName, $scope.resultset.id);
                ThResultSetStore.getGeckoDecisionTaskId($rootScope.repoName, $scope.resultset.id).then(function (decisionTaskID) {
                    ThResultSetModel.triggerNewJobs(buildernames, decisionTaskID).then(function (result) {
                        thNotify.send(result, "success");
                        ThResultSetStore.deleteRunnableJobs($scope.repoName, $scope.resultset);
                    }, function (e) {
                        thNotify.send(ThTaskclusterErrors.format(e), 'danger', { sticky: true });
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
