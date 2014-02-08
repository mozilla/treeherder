"use strict";

treeherder.controller('MainCtrl',
    function MainController($scope, $rootScope, $routeParams, $location, $log,
                            localStorageService, thRepos, thSocket,
                            thResultStatusList) {
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

        $scope.mru_repos = localStorageService.get("mru_repos") || [];

        // @@@ a dummy value for now, used when creating notes.
        // update this value when we have authenticated login.
        $scope.username = "Hiro Protagonist";

        for (var repo in $scope.mru_repos){
            thSocket.emit('subscribe', $scope.mru_repos[repo]+'.job_failure');
            $log.debug("subscribing to "+$scope.mru_repos[repo]+'.job_failure');
        }

        $rootScope.new_failures = {};

        thSocket.on('job_failure', function(msg){
            if (! $rootScope.new_failures.hasOwnProperty(msg.branch)){
                $rootScope.new_failures[msg.branch] = [];
            }
            $rootScope.new_failures[msg.branch].push(msg.id);
            $log.debug("new failure on branch "+msg.branch);
        });

        $scope.changeRepo = function(repo_name) {
            thRepos.setCurrent(repo_name);
            $location.search({repo: repo_name});
        };

        /* TOP DROP-DOWN PANEL */
        $scope.isTopAccordionPanelHidden = true;

        $scope.filterOptions = thResultStatusList;

        $scope.filterGroups = {
            failures: {
                value: "failures",
                name: "failures",
                resultStatuses: ["testfailed", "busted", "exception"]
            },
            nonfailures: {
                value: "nonfailures",
                name: "non-failures",
                resultStatuses: ["success", "retry"]
            },
            inProgress: {
                value: "inProgress",
                name: "in progress",
                resultStatuses: ["pending", "running"]
            }
        };

        /**
         * If all members of the group are unchecked, then check them all.
         * otherwise, uncheck them all.
         * @param resultStatuses
         */
        $scope.toggleGroup = function(resultStatuses) {
            var isNotChecked = function(rs) {return !$scope.resultStatusFilters[rs];};
            var check = function(rs) {$scope.resultStatusFilters[rs] = tf;};

            var tf = _.every(resultStatuses, isNotChecked);
            _.each(resultStatuses, check);

        };

        // which result statuses that should be shown
        $scope.resultStatusFilters = {};
        for (var i = 0; i < $scope.filterOptions.length; i++) {
            $scope.resultStatusFilters[$scope.filterOptions[i]] = true;
        }
        // whether or not to show classified jobs
        $scope.classifiedFilter = true;

        $scope.resultStatusFilterJobs = function(job) {
            return function(job) {
                return $scope.resultStatusFilters[job.result] ||
                    $scope.resultStatusFilters[job.state];
            };
        };
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
    }
);
