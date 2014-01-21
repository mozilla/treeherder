"use strict";

treeherder.controller('JobsCtrl',
    function JobsCtrl($scope, $http, $rootScope, $routeParams, $log, $cookies,
                      localStorageService, thUrl, thRepos, thSocket,
                      thResultSetModelManager) {

        // set the default repo to mozilla-inbound if not specified
        if ($routeParams.hasOwnProperty("repo") &&
            $routeParams.repo !== "") {
            $rootScope.repoName = $routeParams.repo;
        } else {
            $rootScope.repoName = "mozilla-inbound";
        }

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

        // the primary data model
        thResultSetModelManager.init(60000, $scope.repoName);
        $scope.result_sets = thResultSetModelManager.getResultSetsArray();

        $rootScope.update_mru_repos($rootScope.repoName);

        // stop receiving new failures for the current branch
        if($rootScope.new_failures.hasOwnProperty($rootScope.repoName)){
            delete $rootScope.new_failures[$rootScope.repoName];
        }

        thRepos.load($scope.repoName);

        $scope.isLoadingRsBatch = thResultSetModelManager.loadingStatus;

        // load our initial set of resultsets
        // scope needs this function so it can be called directly by the user, too.
        $scope.fetchResultSets = function(count) {
            thResultSetModelManager.fetchResultSets(count);
        };
        $scope.fetchResultSets(2);

        $scope.repo_has_failures = function(repo_name){
            if($rootScope.new_failures.hasOwnProperty(repo_name) &&
               $rootScope.new_failures[repo_name].length > 0){
                return true;
            }else{
                return false;
            }
        };


    }
);

treeherder.controller('ResultSetCtrl',
    function ResultSetCtrl($scope, $rootScope, $http, $log,
                           thUrl, thServiceDomain, thResultStatusInfo) {

        // determine the greatest severity this resultset contains
        // so that the UI can depict that
        var getMostSevereResultStatus = function(result_types) {

            var status = "pending",
                rsInfo = thResultStatusInfo(status);

            for (var i = 0; i < result_types.length; i++) {
                var res = thResultStatusInfo(result_types[i]);
                if (res.severity < rsInfo.severity) {
                    status = result_types[i];
                    rsInfo = res;
                }
            }
            return {status: status, isCollapsedResults: rsInfo.isCollapsedResults};
        };

        var severeResultStatus = getMostSevereResultStatus($scope.resultset.result_types);
        $scope.$watch('resultset.result_types', function(newVal) {
            severeResultStatus = getMostSevereResultStatus($scope.resultset.result_types);

            if ($scope.resultSeverity !== severeResultStatus.status) {
                $log.debug("updating resultSeverity from " + $scope.resultSeverity + " to " + severeResultStatus.status);
            }

            $scope.resultSeverity = severeResultStatus.status;
        }, true);
        $scope.resultSeverity = severeResultStatus.status;
        $scope.isCollapsedResults = severeResultStatus.isCollapsedResults;

        // whether or not revision list for a resultset is collapsed
        $scope.isCollapsedRevisions = true;

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
    }
);
