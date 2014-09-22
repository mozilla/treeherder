"use strict";

treeherder.controller('PinboardCtrl', [
    '$scope', '$rootScope', 'thEvents', 'thPinboard', 'thNotify', 'ThLog',
    function PinboardCtrl(
        $scope, $rootScope, thEvents, thPinboard, thNotify, ThLog) {

        var $log = new ThLog(this.constructor.name);

        $rootScope.$on(thEvents.jobPin, function(event, job) {
            $scope.pinJob(job);
            if(!$scope.$$phase){
                $scope.$digest();
            }
        });

        $scope.pinJob = function(job) {
            thPinboard.pinJob(job);
            if (!$scope.selectedJob) {
                $scope.viewJob(job);
            }
        };

        $scope.pinSelectedJob = function() {
            thPinboard.pinJob($scope.selectedJob);
        };

        $scope.unPinJob = function(id) {
            thPinboard.unPinJob(id);
        };

        $scope.addBug = function(bug) {
            thPinboard.addBug(bug);
        };

        $scope.removeBug = function(id) {
            thPinboard.removeBug(id);
        };

        $scope.unPinAll = function() {
            thPinboard.unPinAll();
        };

        $scope.save = function() {
            if ($scope.user.loggedin) {
                if ($scope.enteringBugNumber) {
                    // we should save this for the user, as they likely
                    // just forgot to hit enter.
                    $scope.saveEnteredBugNumber();
                }
                $scope.classification.who = $scope.user.email;
                var classification = $scope.classification;
                thPinboard.save(classification);
                $scope.classification = thPinboard.createNewClassification();
                $rootScope.selectedJob = null;
            } else {
                thNotify.send("must be logged in to classify jobs", "danger");
            }
        };

        $scope.saveClassificationOnly = function() {
            if ($scope.user.loggedin) {
                $scope.classification.who = $scope.user.email;
                thPinboard.saveClassificationOnly($scope.classification);
            } else {
                thNotify.send("must be logged in to classify jobs", "danger");
            }
        };

        $scope.saveBugsOnly = function() {
            if ($scope.user.loggedin) {
                thPinboard.saveBugsOnly();
            } else {
                thNotify.send("must be logged in to classify jobs", "danger");
            }
        };

        $scope.hasPinnedJobs = function() {
            return thPinboard.hasPinnedJobs();
        };

        $scope.toggleEnterBugNumber = function() {
            $scope.enteringBugNumber = !$scope.enteringBugNumber;
            $scope.focusInput = $scope.enteringBugNumber;
        };

        $scope.saveEnteredBugNumber = function() {
            $log.debug("new bug number to be saved: ", $scope.newEnteredBugNumber);
            thPinboard.addBug({id:$scope.newEnteredBugNumber});
            $scope.toggleEnterBugNumber();
        };

        $scope.viewJob = function(job) {
            $rootScope.selectedJob = job;
            $rootScope.$broadcast(thEvents.jobClick, job);
            $rootScope.$broadcast(thEvents.selectJob, job);
        };

        $scope.classification = thPinboard.createNewClassification();
        $scope.pinnedJobs = thPinboard.pinnedJobs;
        $scope.relatedBugs = thPinboard.relatedBugs;

    }
]);
