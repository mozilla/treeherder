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
                console.log("repo menu", "button", "shown.bs.dropdown", $scope.closeable, ev.target);
            },
            "click":             function(ev) {
                $scope.closeable = true;
                console.log("repo menu", "button", "click", $scope.closeable, ev.target);
            },
            "mouseup":             function(ev) {
//                $scope.closeable = true;
                console.log("repo menu", "button", "mouseup", $scope.closeable, ev.target);
            },
            "hide.bs.dropdown":  function(ev) {
                console.log("repo menu", "button", "hide.bs.dropdown", $scope.closeable, ev.target);
                var closeable = $scope.closeable;
                $scope.closeable = true;
                return closeable;
            }
        });

        $('.repo-dropdown-menu').on({
            "shown.bs.dropdown": function(ev) {
                $scope.closeable = false;
                console.log("repo menu", "dropdown", "shown.bs.dropdown", $scope.closeable, ev.target);
            },
            "click":             function(ev) {
                $scope.closeable = true;
                console.log("repo menu", "dropdown", "click", $scope.closeable, ev.target);
            },
            "mouseup":             function(ev) {
                $scope.closeable = false;
                console.log("repo menu", "dropdown", "mouseup", $scope.closeable, ev.target);
            },
            "hide.bs.dropdown":  function(ev) {
                console.log("repo menu", "dropdown", "hide.bs.dropdown", $scope.closeable, ev.target);
                return $scope.closeable;
            }
        });

    }
]);
