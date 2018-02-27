import treeherderApp from '../treeherder_app';

treeherderApp.controller('RepositoryMenuCtrl', [
    '$scope', 'ThRepositoryModel',
    function RepositoryMenuCtrl(
        $scope, ThRepositoryModel) {

        $scope.groupedRepos = ThRepositoryModel.getOrderedRepoGroups;

        $scope.closeable = true;

    }
]);
