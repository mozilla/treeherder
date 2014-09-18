"use strict";

treeherder.controller('JobsCtrl', [
    '$scope', '$http', '$rootScope', '$routeParams', 'ThLog', '$cookies',
    'localStorageService', 'thUrl', 'ThRepositoryModel', 'thSocket',
    'ThResultSetModel', 'thResultStatusList', '$location', 'thEvents',
    'ThJobModel',
    function JobsCtrl(
        $scope, $http, $rootScope, $routeParams, ThLog, $cookies,
        localStorageService, thUrl, ThRepositoryModel, thSocket,
        ThResultSetModel, thResultStatusList, $location, thEvents, ThJobModel) {

        var $log = new ThLog(this.constructor.name);

        // load our initial set of resultsets
        // scope needs this function so it can be called directly by the user, too.
        $scope.fetchResultSets = function(count) {
            ThResultSetModel.fetchResultSets($scope.repoName, count);
        };

        // set the default repo to mozilla-central if not specified
        if ($routeParams.hasOwnProperty("repo") &&
            $routeParams.repo !== "") {
            $rootScope.repoName = $routeParams.repo;
        } else {
            $rootScope.repoName = "mozilla-central";
            $location.search("repo", "mozilla-central");
        }

        ThResultSetModel.addRepository($scope.repoName);

        $scope.isLoadingRsBatch = ThResultSetModel.getLoadingStatus($scope.repoName);
        $scope.result_sets = ThResultSetModel.getResultSetsArray($scope.repoName);
        $scope.job_map = ThResultSetModel.getJobMap($scope.repoName);
        $scope.statusList = thResultStatusList.counts();

        $scope.searchParams = $location.search();
        $scope.locationHasSearchParam = function(prop) {
            return _.has($scope.searchParams, prop);
        }

        // determine how many resultsets to fetch.  default to 10.
        var count = ThResultSetModel.defaultResultSetCount;
        if ((_.has($scope.searchParams, "startdate") || _.has($scope.searchParams, "fromchange") &&
            (_.has($scope.searchParams, "enddate")) || _.has($scope.searchParams, "tochange"))) {
            // just fetch all (up to 1000) the resultsets if an upper AND lower range is specified

            count = 1000;
        }
        if(ThResultSetModel.isNotLoaded($scope.repoName)){
            // get our first set of resultsets
            ThResultSetModel.fetchResultSets($scope.repoName, count);
        }

        $rootScope.$on(
            thEvents.toggleAllJobs, function(ev, expand){
                _.forEach($scope.result_sets, function(rs) {
                    $rootScope.$broadcast(thEvents.toggleJobs, rs, expand);
                });
            });

        $rootScope.$on(
            thEvents.toggleAllRevisions, function(ev, expand){
                _.forEach($scope.result_sets, function(rs) {
                    $rootScope.$broadcast(thEvents.toggleRevisions, rs, expand);
                });
            });

        var updateClassification = function(classification){
            if(classification.who !== $scope.user.email){
                // get a fresh version of the job
                ThJobModel.get($scope.repoName, classification.id)
                .then(function(job){
                    // get the list of jobs we know about
                    var jobMap  = ThResultSetModel.getJobMap(classification.branch);
                    var map_key = "key"+job.id;
                    if(jobMap.hasOwnProperty(map_key)){
                        // update the old job with the new info
                        _.extend(jobMap[map_key].job_obj,job);
                        var params = { jobs: {}};
                        params.jobs[job.id] = jobMap[map_key].job_obj;
                        // broadcast the job classification event
                        $rootScope.$broadcast(thEvents.jobsClassified, params);
                    }

                });

            }

        };

        thSocket.on("job_classification", updateClassification);


    }
]);


treeherder.controller('ResultSetCtrl', [
    '$scope', '$rootScope', '$http', 'ThLog', '$location',
    'thUrl', 'thServiceDomain', 'thResultStatusInfo',
    'ThResultSetModel', 'thEvents', 'thJobFilters', 'thNotify',
    'thBuildApi', 'thPinboard', 'thResultSets',
    function ResultSetCtrl(
        $scope, $rootScope, $http, ThLog, $location,
        thUrl, thServiceDomain, thResultStatusInfo,
        ThResultSetModel, thEvents, thJobFilters, thNotify,
        thBuildApi, thPinboard, thResultSets) {

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

            ThResultSetModel.loadRevisions(
                $rootScope.repoName, $scope.resultset.id
                );

            $rootScope.$broadcast(
                thEvents.toggleRevisions, $scope.resultset
                );

        };
        $scope.toggleJobs = function() {

            $rootScope.$broadcast(
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
            var shownJobs = ThResultSetModel.getAllShownJobs(
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

            $rootScope.$broadcast(
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

        $scope.totalExcluded = function() {
            return thJobFilters.getCountExcluded($scope.resultset.id, "total");
        };


        $scope.cancelAllJobs = function(revision) {
            thBuildApi.cancelAll($scope.repoName, revision).then(function() {
                thResultSets.cancelAll($scope.resultset.id, $scope.repoName);
            });
        };

        $scope.revisionResultsetFilterUrl = $scope.urlBasePath + "?repo=" + $scope.repoName + "&revision=" + $scope.resultset.revision;
        $scope.authorResultsetFilterUrl = $scope.urlBasePath + "?repo=" + $scope.repoName + "&author=" + encodeURIComponent($scope.resultset.author);

        $scope.resultStatusFilters = thJobFilters.copyResultStatusFilters();

        $rootScope.$on(thEvents.jobContextMenu, function(event, job){
            $log.debug("caught", thEvents.jobContextMenu);
            //$scope.viewLog(job.resource_uri);
        });
    }
]);

