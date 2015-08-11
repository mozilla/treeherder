/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

treeherder.controller('PinboardCtrl', [
    '$scope', '$rootScope', '$document', '$timeout','thEvents', 'thPinboard', 'thNotify', 'ThLog',
    function PinboardCtrl(
        $scope, $rootScope, $document, $timeout, thEvents, thPinboard, thNotify, ThLog) {

        var $log = new ThLog(this.constructor.name);

        $rootScope.$on(thEvents.jobPin, function(event, job) {
            $scope.pinJob(job);
            if(!$scope.$$phase){
                $scope.$digest();
            }
        });

        $rootScope.$on(thEvents.addRelatedBug, function(event, job) {
            $scope.pinJob(job);
            $scope.toggleEnterBugNumber(true);
        });

        $rootScope.$on(thEvents.saveClassification, function(event) {
            if ($scope.isPinboardVisible) {
                $scope.save();
            }
        });

        $rootScope.$on(thEvents.clearPinboard, function(event) {
            if ($scope.isPinboardVisible) {
                $scope.unPinAll();
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
            $scope.classification = thPinboard.createNewClassification();
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
                $scope.completeClassification();
                $scope.classification = thPinboard.createNewClassification();

            } else {
                thNotify.send("Must be logged in to save job classifications", "danger");
            }
        };

        $scope.saveClassificationOnly = function() {
            if ($scope.user.loggedin) {
                $scope.classification.who = $scope.user.email;
                thPinboard.saveClassificationOnly($scope.classification);
            } else {
                thNotify.send("Must be logged in to save job classifications", "danger");
            }
        };

        $scope.saveBugsOnly = function() {
            if ($scope.user.loggedin) {
                thPinboard.saveBugsOnly();
            } else {
                thNotify.send("Must be logged in to save job classifications", "danger");
            }
        };

        $scope.retriggerAllPinnedJobs = function() {
            // pushing pinned jobs to a list.
            $scope.retriggerJob(_.values($scope.pinnedJobs));
        };

        $scope.hasPinnedJobs = function() {
            return thPinboard.hasPinnedJobs();
        };

        $scope.hasRelatedBugs = function() {
            return thPinboard.hasRelatedBugs();
        };

        function handleRelatedBugDocumentClick(event) {
            if (!$(event.target).hasClass("add-related-bugs-input")) {
                $scope.$apply(function() {
                    $scope.toggleEnterBugNumber(false);
                });
            }
        }

        $scope.toggleEnterBugNumber = function(tf) {
            $scope.enteringBugNumber = tf;
            $scope.focusInput = tf;

            $document.off('click', handleRelatedBugDocumentClick);
            if (tf) {
                // Rebind escape to canceling the bug entry, pressing escape
                // again will close the pinboard as usual.
                Mousetrap.bind('escape', function() {
                  var cancel = _.bind($scope.toggleEnterBugNumber, $scope, false);
                  $scope.$evalAsync(cancel);
                });

                // Install a click handler on the document so that clicking
                // outside of the input field will close it. A blur handler
                // can't be used because it would have timing issues with the
                // click handler on the + icon.
                $timeout(function() {
                    $document.on('click', handleRelatedBugDocumentClick);
                }, 0);
            } else {
                $scope.newEnteredBugNumber = '';
            }
        };

        $scope.completeClassification = function() {
            $rootScope.$broadcast('blur-this', "classification-comment");
        };

        $scope.saveEnteredBugNumber = function() {
            if ($scope.enteringBugNumber) {
                if (!$scope.newEnteredBugNumber) {
                    $scope.toggleEnterBugNumber(false);
                } else {
                    $log.debug("new bug number to be saved: ",
                               $scope.newEnteredBugNumber);
                    thPinboard.addBug({id:$scope.newEnteredBugNumber});
                    $scope.toggleEnterBugNumber(false);
                }
            }
        };

        $scope.viewJob = function(job) {
            $rootScope.selectedJob = job;
            $rootScope.$emit(thEvents.jobClick, job);
            $rootScope.$emit(thEvents.selectJob, job);
        };

        $scope.classification = thPinboard.createNewClassification();
        $scope.pinnedJobs = thPinboard.pinnedJobs;
        $scope.relatedBugs = thPinboard.relatedBugs;

    }
]);
