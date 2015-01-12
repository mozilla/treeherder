/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

treeherder.controller('JobsCtrl', [
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
        $scope.fetchResultSets = function(count, keepFilters) {
            ThResultSetStore.fetchResultSets($scope.repoName, count, keepFilters);
        };

        // set the default repo to mozilla-central if not specified
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
        $scope.statusList = thResultStatusList.counts();

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

        // determine how many resultsets to fetch.  default to 10.
        var count = ThResultSetStore.defaultResultSetCount;
        if ((_.has($scope.searchParams, "startdate") || _.has($scope.searchParams, "fromchange")) &&
            (_.has($scope.searchParams, "enddate") || _.has($scope.searchParams, "tochange"))) {
            // just fetch all (up to 100) the resultsets if an upper AND lower range is specified

            count = 100;
        }
        if(ThResultSetStore.isNotLoaded($scope.repoName)){
            // get our first set of resultsets
            ThResultSetStore.fetchResultSets($scope.repoName, count, true);
        }

        $rootScope.$on(
            thEvents.toggleAllJobs, function(ev, expand){
                _.forEach($scope.result_sets, function(rs) {
                    $rootScope.$emit(thEvents.toggleJobs, rs, expand);
                });
            });

        $rootScope.$on(
            thEvents.toggleAllRevisions, function(ev, expand){
                _.forEach($scope.result_sets, function(rs) {
                    $rootScope.$emit(thEvents.toggleRevisions, rs, expand);
                });
            });

        var updateClassification = function(classification){
            if(classification.who !== $scope.user.email){
                // get a fresh version of the job
                ThJobModel.get($scope.repoName, classification.id)
                .then(function(job){
                    // get the list of jobs we know about
                    var jobMap  = ThResultSetStore.getJobMap(classification.branch);
                    var map_key = "key"+job.id;
                    if(jobMap.hasOwnProperty(map_key)){
                        // update the old job with the new info
                        _.extend(jobMap[map_key].job_obj,job);
                        var params = { jobs: {}};
                        params.jobs[job.id] = jobMap[map_key].job_obj;
                        // broadcast the job classification event
                        $rootScope.$emit(thEvents.jobsClassified, params);
                    }
                });
            }
        };
    }
]);


treeherder.controller('ResultSetCtrl', [
    '$scope', '$rootScope', '$http', 'ThLog', '$location',
    'thUrl', 'thServiceDomain', 'thResultStatusInfo',
    'ThResultSetStore', 'thEvents', 'thJobFilters', 'thNotify',
    'thBuildApi', 'thPinboard', 'ThResultSetModel', 'dateFilter',
    function ResultSetCtrl(
        $scope, $rootScope, $http, ThLog, $location,
        thUrl, thServiceDomain, thResultStatusInfo,
        ThResultSetStore, thEvents, thJobFilters, thNotify,
        thBuildApi, thPinboard, ThResultSetModel, dateFilter) {

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
                            if (artifact.name === "Structured Log") {
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
        $scope.toggleJobs = function() {

            $rootScope.$emit(
                thEvents.toggleJobs, $scope.resultset
                );

        };

        /**
         * Pin all jobs that pass the GLOBAL filters.  Ignores toggling at
         * the result set level.
         *
         * If optional resultsetId is passed in, then only pin jobs from that
         * resultset.
         */
        $scope.pinAllShownJobs = function() {
            if (!thPinboard.spaceRemaining()) {
                thNotify.send("Pinboard is full.  Can not pin any more jobs.",
                    "danger",
                    true);
                return;
            }
            var shownJobs = ThResultSetStore.getAllShownJobs(
                $rootScope.repoName,
                thPinboard.spaceRemaining(),
                $scope.resultset.id,
                $scope.resultStatusFilters
            );
            thPinboard.pinJobs(shownJobs);

            if (!$rootScope.selectedJob) {
                $scope.viewJob(shownJobs[0]);
            }

        };

        /**
         * When the user clicks one of the resultStates on the resultset line,
         * then toggle what is showing for just this resultset.
         *
         * @param resultStatus - Which resultStatus to toggle.
         */
        $scope.toggleResultSetResultStatusFilter = function(resultStatus) {
            var idx = $scope.resultStatusFilters.indexOf(resultStatus);
            if (idx < 0) {
                $scope.resultStatusFilters.push(resultStatus);
            } else {
                $scope.resultStatusFilters.splice(idx, 1);
            }

            $rootScope.$emit(
                thEvents.resultSetFilterChanged, $scope.resultset
                );

            $log.debug("toggled: ", resultStatus);
            $log.debug("resultStatusFilters", $scope.resultStatusFilters);
        };

        /**
         * Whether or not a job should be shown based on the global and local
         * filters.
         * @param job
         */
        $scope.showJob = function(job) {
            return thJobFilters.showJob(job, $scope.resultStatusFilters);
        };

        $scope.cancelAllJobs = function(revision) {
            if (!window.confirm('This will cancel all pending and running jobs for revision ' + revision + '!\n\nAre you sure?')) {
                return;
            }
            thBuildApi.cancelAll($scope.repoName, revision).then(function() {
                ThResultSetModel.cancelAll($scope.resultset.id, $scope.repoName);
            });
        };

        $scope.revisionResultsetFilterUrl = $scope.urlBasePath + "?repo=" +
                                            $scope.repoName + "&revision=" +
                                            $scope.resultset.revision;

        $scope.resultsetDateStr = dateFilter($scope.resultset.push_timestamp*1000,
                                             'EEE MMM d, H:mm:ss');

        $scope.authorResultsetFilterUrl = $scope.urlBasePath + "?repo=" +
                                          $scope.repoName + "&author=" +
                                          encodeURIComponent($scope.resultset.author);

        $scope.resultStatusFilters = thJobFilters.getResultStatusArray();

        $rootScope.$on(thEvents.jobContextMenu, function(event, job){
            $log.debug("caught", thEvents.jobContextMenu);
            //$scope.viewLog(job.resource_uri);
        });
    }
]);

