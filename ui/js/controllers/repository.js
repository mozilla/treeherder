"use strict";

treeherder.controller('RepositoryMenuCtrl', [
    '$scope', 'ThRepositoryModel',
    function RepositoryMenuCtrl(
        $scope, ThRepositoryModel) {

        $scope.groupedRepos = ThRepositoryModel.getOrderedRepoGroups;

        $scope.closeable = true;

        $('.dropdown.keep-open').on({
            "shown.bs.dropdown": function() { $scope.closable = false; },
            "click":             function() { $scope.closable = true; },
            "hide.bs.dropdown":  function() { return $scope.closable; }
        });

    }
]);
