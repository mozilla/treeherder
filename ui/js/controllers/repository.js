"use strict";

treeherder.controller('RepositoryPanelCtrl',
    function RepositoryPanelCtrl($scope, $rootScope, $routeParams, $location, $log,
                            localStorageService, ThRepositoryModel, thSocket, thEvents) {

//        $scope.watchedReposUpdated = function() {
//            ThRepositoryModel.watchedReposUpdated();
//        };

        for (var repo in $scope.watchedRepos) {
            if($scope.watchedRepos[repo]){
                thSocket.emit('subscribe', repo+".job_failure");
                $log.debug("subscribing to "+repo+".job_failure");
            }
        }
        $scope.toggleRepo = function(repoName) {
            $scope.watchedRepos[repoName] = !$scope.watchedRepos[repoName];
            ThRepositoryModel.watchedReposUpdated();
            $rootScope.$broadcast(thEvents.topNavBarContentChanged);
            $log.debug("watchedRepos changed.");
        };
    }
);
