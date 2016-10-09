"use strict";

treeherderApp.controller('RepositoryMenuCtrl', [
    '$scope', 'ThRepositoryModel',
    function RepositoryMenuCtrl(
        $scope, ThRepositoryModel) {

        $scope.groupedRepos = ThRepositoryModel.getOrderedRepoGroups;
        $scope.closeable = true;

    }
]);
