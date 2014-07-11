"use strict";

treeherder.controller('JobsCtrl', [
    '$scope', '$http', '$rootScope', '$routeParams', 'ThLog', '$cookies',
    'localStorageService', 'thUrl', 'ThRepositoryModel', 'thSocket',
    'ThResultSetModel', 'thResultStatusList', '$location', 'thEvents',
    function JobsCtrl(
        $scope, $http, $rootScope, $routeParams, ThLog, $cookies,
        localStorageService, thUrl, ThRepositoryModel, thSocket,
        ThResultSetModel, thResultStatusList, $location, thEvents) {

        var $log = new ThLog(this.constructor.name);

        // load our initial set of resultsets
        // scope needs this function so it can be called directly by the user, too.
        $scope.fetchResultSets = function(count) {
            ThResultSetModel.fetchResultSets($scope.repoName, count);
        };

        // set the default repo to mozilla-inbound if not specified
        if ($routeParams.hasOwnProperty("repo") &&
            $routeParams.repo !== "") {
            $rootScope.repoName = $routeParams.repo;
        } else {
            $rootScope.repoName = "mozilla-central";
        }

        // load the list of repos into $rootScope, and set the current repo.
        ThRepositoryModel.load($scope.repoName);
        $scope.setRepoPanelShowing(false);

        ThResultSetModel.addRepository($scope.repoName);

        $scope.isLoadingRsBatch = ThResultSetModel.getLoadingStatus($scope.repoName);
        $scope.result_sets = ThResultSetModel.getResultSetsArray($scope.repoName);
        $scope.job_map = ThResultSetModel.getJobMap($scope.repoName);
        $scope.statusList = thResultStatusList.counts();

        // determine how many resultsets to fetch.  default to 10.
        var count = 10;
        var searchParams = $location.search();
        if ((_.has(searchParams, "startdate") || _.has(searchParams, "fromchange") &&
            (_.has(searchParams, "enddate")) || _.has(searchParams, "tochange"))) {
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


    }
]);


treeherder.controller('ResultSetCtrl', [
    '$scope', '$rootScope', '$http', 'ThLog', '$location',
    'thUrl', 'thServiceDomain', 'thResultStatusInfo',
    'ThResultSetModel', 'thEvents', 'thJobFilters', 'thNotify',
    'thBuildApi',
    function ResultSetCtrl(
        $scope, $rootScope, $http, ThLog, $location,
        thUrl, thServiceDomain, thResultStatusInfo,
        ThResultSetModel, thEvents, thJobFilters, thNotify,
        thBuildApi) {

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

        $scope.pinAllShownJobs = function() {
            thJobFilters.pinAllShownJobs($scope.resultset.id, $scope.resultStatusFilters);
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
            thBuildApi.cancelAll($scope.repoName, revision);
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

