"use strict";

treeherder.controller('MainCtrl',
    function MainController($scope, $rootScope) {
        $scope.query="";
        $scope.statusError = function(msg) {
            $rootScope.statusMsg = msg;
            $rootScope.statusColor = "red";
        };
        $scope.statusSuccess = function(msg) {
            $rootScope.statusMsg = msg;
            $rootScope.statusColor = "green";
        };
        $scope.clearJob = function() {
            // setting the selectedJob to null hides the bottom panel
            $rootScope.selectedJob = null;
        }
    }
);


treeherder.controller('RepoDropDownCtrl',
    function RepoDropDownCtrl($scope, $http, $location, thRepos) {
        $scope.changeRepo = function(repo) {
            $location.search({repo: repo});
        };
        thRepos.getRepos($scope);
    }
);
