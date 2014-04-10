"use strict";

treeherder.controller('MainCtrl',
    function MainController($scope, $rootScope, $routeParams, $location, $log,
                            localStorageService, ThRepositoryModel, thPinboard,
                            ThExclusionProfileModel, thEvents) {
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

        // the repos the user has chosen to watch
        $scope.watchedRepos = ThRepositoryModel.watchedRepos;

        $scope.changeRepo = function(repo_name) {
            // hide the repo panel if they chose to load one.
            $scope.isRepoPanelShowing = false;

            ThRepositoryModel.setCurrent(repo_name);
            $location.search({repo: repo_name});

        };

        $scope.pinboardCount = thPinboard.count;
        $scope.pinnedJobs = thPinboard.pinnedJobs;

        $scope.user = angular.fromJson(localStorageService.get("user")) || {};
        $scope.user.loggedin = angular.isDefined($scope.user.email) && $scope.user.email !== null;

        // get a cached version of the exclusion profiles
        ThExclusionProfileModel.get_list({}, true).then(function(profiles){
            $scope.exclusion_profiles = profiles;
            $rootScope.active_exclusion_profile = _.find(
                $scope.exclusion_profiles,
                function(elem){
                    return elem.is_default;
                }
            );
            if($rootScope.active_exclusion_profile){
                $scope.$broadcast(thEvents.globalFilterChanged, null);
            }
        }, null);
    }
);
