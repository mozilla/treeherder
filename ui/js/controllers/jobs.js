"use strict";

treeherderApp.controller('JobsCtrl', [
    '$scope', '$http', '$rootScope', '$routeParams', 'ThLog',
    'thUrl', 'ThRepositoryModel', 'thDefaultRepo',
    'ThResultSetStore', 'thResultStatusList', '$location', 'thEvents',
    'ThJobModel',
    function JobsCtrl(
        $scope, $http, $rootScope, $routeParams, ThLog,
        thUrl, ThRepositoryModel, thDefaultRepo,
        ThResultSetStore, thResultStatusList, $location, thEvents, ThJobModel) {

        var $log = new ThLog(this.constructor.name);

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
            } else {
                return searchParamValue;
            }
        };

        if(ThResultSetStore.isNotLoaded($scope.repoName)){
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
    'ThModelErrors',
    function ResultSetCtrl(
        $scope, $rootScope, $http, ThLog, $location,
        thUrl, thServiceDomain, thResultStatusInfo, thDateFormat,
        ThResultSetStore, thEvents, thJobFilters, thNotify,
        thBuildApi, thPinboard, ThResultSetModel, dateFilter, ThModelErrors) {

        var $log = new ThLog(this.constructor.name);

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
        $scope.viewLog = function(job_uri) {
            // open the logviewer for this job in a new window
            // currently, invoked by right-clicking a job.

            $http.get(thServiceDomain + job_uri).
                success(function(data) {
                    if (data.hasOwnProperty("artifacts")) {
                        data.artifacts.forEach(function(artifact) {
                            if (artifact.name === "text_log_summary") {
                                window.open(thUrl.getLogViewerUrl(artifact.id));
                            }
                        });
                    } else {
                        $log.warn("Job had no artifacts: " + job_uri);
                    }
                });

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

        $scope.cancelAllJobs = function(revision) {
            if (!window.confirm('This will cancel all pending and running jobs for revision ' + revision + '!\n\nAre you sure?')) {
                return;
            }

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
            if (!window.confirm('This will trigger all missing jobs for revision ' + revision + '!\n\nDo you want to proceed?')) {
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
            if (!window.confirm('This will trigger all talos jobs for revision ' + revision + '!\n\nDo you want to proceed?')) {
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

        $scope.revisionResultsetFilterUrl = $scope.urlBasePath + "?repo=" +
            $scope.repoName + "&revision=" +
            $scope.resultset.revision;

        $scope.resultsetDateStr = dateFilter($scope.resultset.push_timestamp*1000,
                                             thDateFormat);

        $scope.authorResultsetFilterUrl = $scope.urlBasePath + "?repo=" +
            $scope.repoName + "&author=" +
            encodeURIComponent($scope.resultset.author);

        $rootScope.$on(thEvents.jobContextMenu, function(event, job){
            $log.debug("caught", thEvents.jobContextMenu);
            //$scope.viewLog(job.resource_uri);
        });
    }
]);

