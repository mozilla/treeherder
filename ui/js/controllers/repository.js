"use strict";

treeherder.controller('RepositoryMenuCtrl', [
    '$scope', 'ThRepositoryModel',
    function RepositoryMenuCtrl(
        $scope, ThRepositoryModel) {

        $scope.groupedRepos = ThRepositoryModel.getOrderedRepoGroups;

        $scope.closeable = true;

        $('.dropdown.keep-open').on({
            "shown.bs.dropdown": function(ev) {
                $scope.closeable = false;
            },
            "click":             function(ev) {
                $scope.closeable = true;
            },
            "hide.bs.dropdown":  function(ev) {
                var closeable = $scope.closeable;
                $scope.closeable = true;
                return closeable;
            }
        });

        $('.repo-dropdown-menu').on({
            "shown.bs.dropdown": function(ev) {
                $scope.closeable = false;
            },
            "click":             function(ev) {
                $scope.closeable = true;
            },
            "mouseup":             function(ev) {
                $scope.closeable = false;
            },
            "hide.bs.dropdown":  function(ev) {
                return $scope.closeable;
            }
        });

    }
]);
