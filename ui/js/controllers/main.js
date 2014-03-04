"use strict";

treeherder.controller('MainCtrl',
    function MainController($scope, $rootScope, $routeParams, $location, $log,
                            localStorageService, ThRepositoryModel) {
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

        // detect window width and put it in scope so items can react to
        // a narrow/wide window
        $scope.getWidth = function() {
            return $(window).width();
        };
        $scope.$watch($scope.getWidth, function(newValue, oldValue) {
            $scope.windowWidth = newValue;
        });
        window.onresize = function(){
            $scope.$apply();
        };

        // give the page a way to determine which nav toolbar to show
        $rootScope.$on('$locationChangeSuccess', function(ev,newUrl) {
            $rootScope.locationPath = $location.path().replace('/', '');
        });

        $rootScope.urlBasePath = $location.absUrl().split('?')[0];
        $rootScope.testRepoUrl = "ferp";

        // the repos the user has chosen to watch
        $scope.watchedRepos = ThRepositoryModel.watchedRepos;

        $scope.changeRepo = function(repo_name) {
            // hide the repo panel if they chose to load one.
            $scope.isRepoPanelShowing = false;

            ThRepositoryModel.setCurrent(repo_name);
            $location.search({repo: repo_name});

        };

        $scope.user = {};
        $scope.user.email = localStorageService.get("user.email");
        $scope.user.loggedin = $scope.user.email !== null;
    }
);
