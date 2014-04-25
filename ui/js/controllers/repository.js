"use strict";

treeherder.controller('RepositoryPanelCtrl', [
    '$scope', '$rootScope', '$routeParams', '$location', 'ThLog',
    'localStorageService', 'ThRepositoryModel', 'thSocket',
    function RepositoryPanelCtrl(
        $scope, $rootScope, $routeParams, $location, ThLog,
        localStorageService, ThRepositoryModel, thSocket) {

        var $log = new ThLog(this.constructor.name);

        for (var repo in $scope.watchedRepos) {
            if($scope.watchedRepos[repo]){
                thSocket.emit('subscribe', repo+".job_failure");
                $log.debug("subscribing to "+repo+".job_failure");
            }
        }
        $scope.toggleRepo = function(repoName) {
            $scope.watchedRepos[repoName].isWatched = !$scope.watchedRepos[repoName].isWatched;
            ThRepositoryModel.watchedReposUpdated(repoName);
        };
    }
]);
