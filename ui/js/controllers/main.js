"use strict";

treeherder.controller('MainCtrl',
    function MainController($scope, $rootScope, $routeParams, $location, $log,
                            localStorageService, thRepos, thSocket) {
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
        $scope.isFilterPanelHidden = true;

        $scope.mru_repos = localStorageService.get("mru_repos") || [];

        // @@@ a dummy value for now, used when creating notes.
        // update this value when we have authenticated login.
        $scope.username = "Hiro Protagonist";

        for(var repo in $scope.mru_repos){
            thSocket.emit('subscribe', $scope.mru_repos[repo]+'.job_failure');
            $log.debug("subscribing to "+$scope.mru_repos[repo]+'.job_failure');
        }

        $rootScope.new_failures = new Object();

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



    }
);
