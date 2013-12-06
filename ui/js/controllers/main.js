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
        };
        $scope.username = "User Foo";
    }
);


treeherder.controller('RepoDropDownCtrl',
    function RepoDropDownCtrl($scope, $rootScope, $http, $location, thRepos) {
        $scope.changeRepo = function(repo) {
            thRepos.setCurrent(repo.name);
            $location.search({repo: repo.name});
        };
    }
);
