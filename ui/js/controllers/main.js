"use strict";

treeherder.controller('MainCtrl',
    function MainController($scope, $http, $route, $routeParams, $location){
        $scope.query="";
        $scope.status = "condition green";
    }
);


treeherder.controller('DropDownMenuCtrl',
    function DropDownMenuCtrl($scope, $http, $route){
        // get the menu items
        $http.get('resources/menu.json').success(function(data) {
            $scope.menu = data.menu;
        });
    }
);
