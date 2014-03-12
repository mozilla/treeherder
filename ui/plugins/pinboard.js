"use strict";

treeherder.controller('PinboardCtrl',
    function PinboardCtrl($scope, $rootScope, thEvents, thPinboard, thNotify) {

        $rootScope.$on(thEvents.jobPin, function(event, job) {
            $scope.pinJob(job);
        });

        $scope.pinJob = function(job) {
            thPinboard.pinJob(job);
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
                $scope.classification.who = $scope.user.email;
                thPinboard.save($scope.classification);
            } else {
                thNotify.send("must be logged in to classify jobs");
            }
        };

        $scope.saveClassificationOnly = function() {
            if ($scope.user.loggedin) {
                $scope.classification.who = $scope.user.email;
                thPinboard.saveClassificationOnly($scope.classification);
            } else {
                thNotify.send("must be logged in to classify jobs");
            }
        };

        $scope.saveBugsOnly = function() {
            if ($scope.user.loggedin) {
                thPinboard.saveBugsOnly();
            } else {
                thNotify.send("must be logged in to classify jobs");
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
            thPinboard.addBug({id:$scope.newEnteredBugNumber});
            $scope.newEnteredBugNumber = null;
            $scope.toggleEnterBugNumber();
        };

        $scope.viewJob = function(job) {
            $rootScope.selectedJob = job;
            $rootScope.$broadcast(thEvents.jobClick, job);
        };

        $scope.classification = thPinboard.createNewClassification();
        $scope.pinnedJobs = thPinboard.pinnedJobs;
        $scope.relatedBugs = thPinboard.relatedBugs;

    }
);
