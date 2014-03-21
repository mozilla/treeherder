"use strict";

treeherder.controller('JobsCtrl',
    function JobsCtrl($scope, $http, $rootScope, $routeParams, $log, $cookies,
                      localStorageService, thUrl, ThRepositoryModel, thSocket,
                      ThResultSetModel, thResultStatusList) {
        var logId = this.constructor.name;

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
            $rootScope.repoName = "mozilla-inbound";
        }
        ThRepositoryModel.setCurrent($rootScope.repoName);


        ThResultSetModel.addRepository($scope.repoName);

        $scope.isLoadingRsBatch = ThResultSetModel.getLoadingStatus($scope.repoName);
        $scope.result_sets = ThResultSetModel.getResultSetsArray($scope.repoName);
        $scope.job_map = ThResultSetModel.getJobMap($scope.repoName);
        $scope.statusList = thResultStatusList;

        // load the list of repos into $rootScope, and set the current repo.
        ThRepositoryModel.load($scope.repoName);

        if(ThResultSetModel.isNotLoaded($scope.repoName)){
            // get our first set of resultsets
            $scope.fetchResultSets(10);
        }

    }
);


treeherder.controller('ResultSetCtrl',
    function ResultSetCtrl($scope, $rootScope, $http, $log, $location,
                           thUrl, thServiceDomain, thResultStatusInfo,
                           ThResultSetModel, thEvents, thJobFilters, $route) {

        var logId = this.constructor.name;

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

            $log.debug(logId, "toggled: ", resultStatus);
            $log.debug(logId, "resultStatusFilters", $scope.resultStatusFilters);
        };

        /**
         * Whether or not a job should be shown based on the global and local
         * filters.
         * @param job
         */
        $scope.showJob = function(job) {
            return thJobFilters.showJob(job, $scope.resultStatusFilters);
        };

        $scope.revisionResultsetFilterUrl = $scope.urlBasePath + "?repo=" + $scope.repoName + "&revision=" + $scope.resultset.revision;
        $scope.authorResultsetFilterUrl = $scope.urlBasePath + "?repo=" + $scope.repoName + "&author=" + encodeURIComponent($scope.resultset.author);

        $scope.resultStatusFilters = thJobFilters.copyResultStatusFilters();

        $scope.isCollapsedResults = false;

        // whether or not revision list for a resultset is collapsed
        $scope.isCollapsedRevisions = true;

        $rootScope.$on(thEvents.jobContextMenu, function(event, job){
            $log.debug(logId, "caught", thEvents.jobContextMenu);
            //$scope.viewLog(job.resource_uri);
        });
    }
);

