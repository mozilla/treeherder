"use strict";

treeherder.controller('RepositoryPanelCtrl',
    function RepositoryPanelCtrl($scope, $rootScope, $routeParams, $location, $log,
                            localStorageService, ThRepositoryModel, thSocket) {

        $scope.saveWatchedRepos = function() {
            ThRepositoryModel.saveWatchedRepos();
        };

        for (var repo in $scope.watchedRepos) {
            if($scope.watchedRepos[repo]){
                thSocket.emit('subscribe', repo);
                $log.debug("subscribing to "+$scope.watchedRepos[repo]);
            }
        }

    }
);
