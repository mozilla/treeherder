"use strict";

treeherder.controller('ReposPanelCtrl',
    function ReposPanelCtrl($scope, $rootScope, $routeParams, $location, $log,
                            localStorageService, thReposModel, thSocket, $modal) {


        $scope.saveWatchedRepos = function() {
            thReposModel.saveWatchedRepos();
        };

        for (var repo in $scope.watchedRepos) {
            thSocket.emit('subscribe', $scope.watchedRepos[repo]+'.job_failure');
            $log.debug("subscribing to "+$scope.watchedRepos[repo]+'.job_failure');
        }

    }
);
