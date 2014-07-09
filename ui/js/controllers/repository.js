"use strict";

treeherder.controller('RepositoryPanelCtrl', [
    '$scope', '$rootScope', '$routeParams', '$location', 'ThLog',
    'localStorageService', 'ThRepositoryModel',
    function RepositoryPanelCtrl(
        $scope, $rootScope, $routeParams, $location, ThLog,
        localStorageService, ThRepositoryModel) {

        var $log = new ThLog(this.constructor.name);

        $scope.toggleRepo = function(repoName) {
            $scope.watchedRepos[repoName].isWatched = !$scope.watchedRepos[repoName].isWatched;
            ThRepositoryModel.watchedReposUpdated(repoName);
        };
    }
]);
