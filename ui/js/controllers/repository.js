"use strict";

treeherder.controller('RepositoryPanelCtrl',
    function RepositoryPanelCtrl($scope, $rootScope, $routeParams, $location, $log,
                            localStorageService, ThRepositoryModel, thSocket) {
        var logId = this.constructor.name;

        for (var repo in $scope.watchedRepos) {
            if($scope.watchedRepos[repo]){
                thSocket.emit('subscribe', repo+".job_failure");
                $log.debug(logId, "subscribing to "+repo+".job_failure");
            }
        }
        $scope.toggleRepo = function(repoName) {
            $scope.watchedRepos[repoName].isWatched = !$scope.watchedRepos[repoName].isWatched;
            ThRepositoryModel.watchedReposUpdated();
        };
    }
);
