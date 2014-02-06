"use strict";

treeherder.controller('JobsCtrl',
    function JobsCtrl($scope, $http, $rootScope, $routeParams, $log, $cookies,
                      localStorageService, thUrl, thRepos, thSocket,
                      thResultSetModel, thResultStatusList) {

        // handle the most recent used repos
        $rootScope.update_mru_repos = function(repo){
            var max_mru_repos_length = 6;
            var curr_repo_index = $scope.mru_repos.indexOf($rootScope.repoName);
            if( curr_repo_index !== -1){
                $scope.mru_repos.splice(curr_repo_index, 1);
            }
            $scope.mru_repos.unshift($rootScope.repoName);
            if($scope.mru_repos.length > max_mru_repos_length){
                var old_branch= $scope.mru_repos.pop();
                thSocket.emit('subscribe', old_branch+'.job_failure');
                $log.debug("subscribing to "+old_branch+'.job_failure');
            }
            localStorageService.set("mru_repos", $scope.mru_repos);
        };
        $scope.repo_has_failures = function(repo_name){
            return ($rootScope.new_failures.hasOwnProperty(repo_name) &&
                $rootScope.new_failures[repo_name].length > 0);
        };
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
        $scope.statusList = thResultStatusList;

        $rootScope.update_mru_repos($scope.repoName);

        // load the list of repos into $rootScope, and set the current repo.
        thRepos.load($scope.repoName);

        // stop receiving new failures for the current branch
        if($rootScope.new_failures.hasOwnProperty($scope.repoName)){
            delete $rootScope.new_failures[$scope.repoName];
        }

        // get our first set of resultsets
        $scope.fetchResultSets(10);

    }
);

treeherder.controller('ResultSetCtrl',
    function ResultSetCtrl($scope, $rootScope, $http, $log,
                           thUrl, thServiceDomain, thResultStatusInfo,
                           thResultSetModel) {

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

    }
);
