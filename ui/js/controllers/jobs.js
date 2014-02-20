"use strict";

treeherder.controller('JobsCtrl',
    function JobsCtrl($scope, $http, $rootScope, $routeParams, $log, $cookies,
                      localStorageService, thUrl, thReposModel, thSocket,
                      thResultSetModel, thResultStatusList, thEvents) {

        // load our initial set of resultsets
        // scope needs this function so it can be called directly by the user, too.
        $scope.fetchResultSets = function(count) {
            thResultSetModel.fetchResultSets(count);
        };

        // set the default repo to mozilla-inbound if not specified
        if ($routeParams.hasOwnProperty("repo") &&
            $routeParams.repo !== "") {
            $rootScope.repoName = $routeParams.repo;
        } else {
            $rootScope.repoName = "mozilla-inbound";
        }

        // the primary data model
        thResultSetModel.init(60000, $scope.repoName);

        $scope.isLoadingRsBatch = thResultSetModel.loadingStatus;
        $scope.result_sets = thResultSetModel.getResultSetsArray();
        $scope.job_map = thResultSetModel.getJobMap();
        $scope.statusList = thResultStatusList;

        // load the list of repos into $rootScope, and set the current repo.
        thReposModel.load($scope.repoName);

        // get our first set of resultsets
        $scope.fetchResultSets(10);

    }
);

treeherder.controller('ResultSetCtrl',
    function ResultSetCtrl($scope, $rootScope, $http, $log,
                           thUrl, thServiceDomain, thResultStatusInfo,
                           thResultSetModel, thEvents) {

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
            $scope.isCollapsedRevisions = !$scope.isCollapsedRevisions;
            if (!$scope.isCollapsedRevisions) {
                // we are expanding the revisions list.  It may be the first
                // time, so attempt to populate this resultset's revisions
                // list, if it isn't already
                thResultSetModel.loadRevisions($scope.resultset.id);
            }

        };
        $scope.isCollapsedResults = false;

        // whether or not revision list for a resultset is collapsed
        $scope.isCollapsedRevisions = true;

        $rootScope.$on(thEvents.jobContextMenu, function(event, job){
            console.log(thEvents.jobContextMenu + ' caught');
            //$scope.viewLog(job.resource_uri);
        });

    }
);
