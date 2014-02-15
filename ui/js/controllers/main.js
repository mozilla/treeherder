"use strict";

treeherder.controller('MainCtrl',
    function MainController($scope, $rootScope, $routeParams, $location, $log,
                            localStorageService, thReposModel, thSocket,
                            thResultStatusList, thServiceDomain) {
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

        // @@@ a dummy value for now, used when creating classifications.
        // update this value when we have authenticated login.
        $scope.username = "Hiro Protagonist";


        // the repos the user has chosen to watch
        $scope.watchedRepos = thReposModel.watchedRepos;

        $scope.changeRepo = function(repo_name) {
            thReposModel.setCurrent(repo_name);
            $location.search({repo: repo_name});
        };

        /**
         * Handle display/hide of a job based on the result status filters
         */
        $scope.resultStatusFilterJobs = function() {
            return function(job) {
                return $scope.resultStatusFilters[job.result] ||
                    $scope.resultStatusFilters[job.state];
            };
        };
        /**
         * Handle display/hide of a platform based on the result status filters
         */
        $scope.resultStatusFilterPlatform = function() {
            return function(platform) {
                for (var key in $scope.resultStatusFilters) {
                    if (platform.job_counts[key] && $scope.resultStatusFilters[key]) {
                        return true;
                    }
                }
                return false;
            };
        };

        $scope.user = {};
    }
);
