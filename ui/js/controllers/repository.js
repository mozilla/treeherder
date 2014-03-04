"use strict";

treeherder.controller('RepositoryPanelCtrl',
    function RepositoryPanelCtrl($scope, $rootScope, $routeParams, $location, $log,
                            localStorageService, ThRepositoryModel, thSocket) {

        $scope.saveWatchedRepos = function() {
            ThRepositoryModel.saveWatchedRepos();
        };

        for (var repo in $scope.watchedRepos) {
            thSocket.emit('subscribe', $scope.watchedRepos[repo]+'.job_failure');
            $log.debug("subscribing to "+$scope.watchedRepos[repo]+'.job_failure');
        }

    }
);
