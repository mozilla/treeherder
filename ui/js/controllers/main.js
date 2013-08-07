"use strict";

treeherder.controller('MainCtrl',
    function MainController($scope) {
        $scope.query="";
        $scope.status = "condition green";
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
