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
    '$scope', '$rootScope', '$http', 'ThLog', '$location', '$interval',
    'thUrl', 'thServiceDomain', 'thResultStatusInfo', 'thDateFormat',
    'ThResultSetStore', 'thEvents', 'thJobFilters', 'thNotify',
    'thBuildApi', 'thPinboard', 'ThResultSetModel', 'dateFilter',
    'ThModelErrors', 'ThJobModel', 'ThJobDetailModel',
    function ResultSetCtrl(
        $scope, $rootScope, $http, ThLog, $location, $interval,
        thUrl, thServiceDomain, thResultStatusInfo, thDateFormat,
        ThResultSetStore, thEvents, thJobFilters, thNotify,
        thBuildApi, thPinboard, ThResultSetModel, dateFilter, ThModelErrors, ThJobModel,
        ThJobDetailModel) {

        // These have to be $rootScope because $scope is per-push, which makes this useless
        $rootScope.watchedResultsets = [];
        $rootScope.watchedResultsetsInterval = undefined;
        $rootScope.removeFromWatchedResultsets = function(rs) {
            var i = $rootScope.watchedResultsets.indexOf(rs);
            $rootScope.watchedResultsets.splice(i,1);
        };

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

        $scope.notifyWhenDone = function(revision) {
            Notification.requestPermission().then(function(result) {
                if(result === "granted") {
                    if($rootScope.watchedResultsets.length === 0) {
                        if(!angular.isDefined($rootScope.watchedResultsetsInterval)) {
                            $rootScope.watchedResultsetsInterval = $interval(function() {
                                $rootScope.watchedResultsets.forEach(function(revision) {
                                    var resultsets = ThResultSetStore.getResultSetsArray($scope.repoName);
                                    resultsets.forEach(function(rs) {
                                        if(rs.revision === revision) {
                                            var percent = rs.job_counts.percentComplete;
                                            if(percent === 100) {
                                                spawnNotification("Push completed", revision, revision);
                                                $rootScope.removeFromWatchedResultsets(revision);
                                            } else {
                                                console.log(percent);
                                            }
                                        }
                                    });
                                });
                            }, 10000);
                        }

                    }
                    if($rootScope.watchedResultsets.indexOf(revision) >= 0) {
                        thNotify.send("This revision is already being watched", "warning");
                        // I guess this could be a toggle and remove revision from watchedResultsets?
                    } else {
                        $rootScope.watchedResultsets.push(revision);
                        thNotify.send("Watching revision: " + revision);
                    }
                } else if(result === "denied") {
                    thNotify.send("Notifications for " + document.domain + " denied.",
                                  "danger", "true");
                }
            });
        };

        function spawnNotification(title, body, tag) {
            var options = {
                body: body,
                icon: "img/tree_open.png",
                tag: tag
            };
            var n = new Notification(title, options);
            n.addEventListener('click', notification_clicked);
        }

        function notification_clicked(evt) {
            console.log(evt.target);
        }

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

        $scope.canCancelJobs = function(revision) {
            if (!$scope.user || !$scope.user.loggedin) {
                return false;
            }
            var job = ThResultSetStore.getSelectedJob($scope.repoName).job;
            var singleJobSelected = job instanceof ThJobModel;
            if (singleJobSelected && job.revision === revision) {
                // Check whether the job can be cancelled
                return job.state === "pending" || job.state === "running";
            }

            return true;
        };

        $scope.cancelJobs = function(revision) {
            if (!$scope.canCancelJobs()) {
                return;
            }
            var job = ThResultSetStore.getSelectedJob($scope.repoName).job;
            var singleJobSelected = job instanceof ThJobModel && job.revision === revision;
            var message = singleJobSelected ?
                          'This will cancel the selected job. !\n\nClick "OK" if you\'re sure.':
                          'This will cancel all pending and running jobs for revision ' + revision + '!\n\nClick "OK" if you\'re sure.';
            if (!window.confirm(message)) {
                return;
            }

            if (singleJobSelected) {
                ThJobModel.cancel($scope.repoName, job.id).then(function() {
                    // XXX: Remove this after 1134929 is resolved.
                    ThJobDetailModel.getJobDetails({
                        title: "buildbot_request_id",
                        job_id: job.id
                    }).then(function(data) {
                        // non-buildbot jobs will have no request id, and that's ok (they
                        // are covered above)
                        if (data.length) {
                            return thBuildApi.cancelJob($scope.repoName, data[0].value);
                        }
                    });
                }).catch(function(e) {
                    thNotify.send(
                        ThModelErrors.format(e, "Unable to cancel job"),
                        "danger", true
                    );
                });
            } else {
                ThResultSetModel.cancelAll($scope.resultset.id, $scope.repoName).then(function() {
                    return thBuildApi.cancelAll($scope.repoName, revision);
                }).catch(function(e) {
                    thNotify.send(
                        ThModelErrors.format(e, "Failed to cancel all jobs"),
                        'danger', true
                    );
                });
            }
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
                var decisionTaskID = ThResultSetStore.getGeckoDecisionTaskID($rootScope.repoName, $scope.resultset.id);
                ThResultSetModel.triggerNewJobs($scope.repoName, $scope.resultset.id, buildernames, decisionTaskID).then(function() {
                    thNotify.send("Trigger request sent", "success");
                    ThResultSetStore.deleteRunnableJobs($scope.repoName, $scope.resultset);
                }, function(e) {
                    // Generic error eg. the user doesn't have permission
                    thNotify.send(
                        ThModelErrors.format(e, "Unable to send trigger"), 'danger');
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
