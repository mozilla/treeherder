/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

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
                console.log("set skip page", $scope.skipNextPageReload);
                $location.search('revision', null);
                $location.search('tochange', revision);
            }
            ThResultSetStore.fetchResultSets($scope.repoName, count, keepFilters).
                then(function() {

                    // since we fetched more resultsets, we need to persist the
                    // resultset state in the URL.
                    $rootScope.skipNextPageReload = true;
                    console.log("setting location");
                    var rsArray = ThResultSetStore.getResultSetsArray($scope.repoName)
//                    $location.search('tochange', _.first(rsArray).revision);
                    $location.search('fromchange', _.last(rsArray).revision);
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
        $scope.toggleJobs = function() {

            $rootScope.$emit(
                thEvents.toggleJobs, $scope.resultset
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
                $scope.resultset.id,
                $scope.resultStatusFilters
            );
            thPinboard.pinJobs(shownJobs);

            if (!$rootScope.selectedJob) {
                $scope.viewJob(shownJobs[0]);
            }

        };

        /**
         * Whether or not a job should be shown based on the global filters.
         * @param job
         */
        $scope.showJob = function(job) {
            return thJobFilters.showJob(job, $scope.resultStatusFilters);
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

        $scope.revisionResultsetFilterUrl = $scope.urlBasePath + "?repo=" +
                                            $scope.repoName + "&revision=" +
                                            $scope.resultset.revision;

        $scope.resultsetDateStr = dateFilter($scope.resultset.push_timestamp*1000,
                                             thDateFormat);

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

