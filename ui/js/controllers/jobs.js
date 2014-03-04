"use strict";

treeherder.controller('JobsCtrl',
    function JobsCtrl($scope, $http, $rootScope, $routeParams, $log, $cookies,
                      localStorageService, thUrl, ThRepositoryModel, thSocket,
                      ThResultSetModel, thResultStatusList) {

        // load our initial set of resultsets
        // scope needs this function so it can be called directly by the user, too.
        $scope.fetchResultSets = function(count) {
            ThResultSetModel.fetchResultSets(count);
        };

        // set the default repo to mozilla-inbound if not specified
        if ($routeParams.hasOwnProperty("repo") &&
            $routeParams.repo !== "") {
            $rootScope.repoName = $routeParams.repo;
        } else {
            $rootScope.repoName = "mozilla-inbound";
        }

        // the primary data model
        //ThResultSetModel.init(60000, $scope.repoName);
        ThResultSetModel.init(5000, $scope.repoName);

        $scope.isLoadingRsBatch = ThResultSetModel.loadingStatus;
        $scope.result_sets = ThResultSetModel.getResultSetsArray();
        $scope.job_map = ThResultSetModel.getJobMap();
        $scope.statusList = thResultStatusList;

        // load the list of repos into $rootScope, and set the current repo.
        ThRepositoryModel.load($scope.repoName);

        // get our first set of resultsets
        $scope.fetchResultSets(10);

    }
);


treeherder.controller('ResultSetCtrl',
    function ResultSetCtrl($scope, $rootScope, $http, $log,
                           thUrl, thServiceDomain, thResultStatusInfo,
                           ThResultSetModel, thEvents, thJobFilters) {

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

            ThResultSetModel.loadRevisions($scope.resultset.id);
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

            $log.debug("toggled: " + resultStatus);
            $log.debug($scope.resultStatusFilters);
        };

        /**
         * Whether or not a job should be shown based on the global and local
         * filters.
         * @param job
         */
        $scope.showJob = function(job) {
            return thJobFilters.showJob(job, $scope.resultStatusFilters);
        };

        $scope.resultStatusFilters = thJobFilters.copyResultStatusFilters();

        $scope.isCollapsedResults = false;

        // whether or not revision list for a resultset is collapsed
        $scope.isCollapsedRevisions = true;

        $rootScope.$on(thEvents.jobContextMenu, function(event, job){
            $log.debug(thEvents.jobContextMenu + ' caught');
            //$scope.viewLog(job.resource_uri);
        });
    }
);
