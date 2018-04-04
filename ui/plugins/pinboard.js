import Mousetrap from 'mousetrap';

import treeherder from '../js/treeherder';
import { thEvents } from "../js/constants";

treeherder.controller('PinboardCtrl', [
    '$scope', '$rootScope', '$document', '$timeout', 'thPinboard', 'thNotify',
    function PinboardCtrl(
        $scope, $rootScope, $document, $timeout, thPinboard, thNotify) {

        $rootScope.$on(thEvents.toggleJobPin, function (event, job) {
            $scope.toggleJobPin(job);
            if (!$scope.$$phase) {
                $scope.$digest();
            }
        });

        $rootScope.$on(thEvents.jobPin, function (event, job) {
            $scope.pinJob(job);
            if (!$scope.$$phase) {
                $scope.$digest();
            }
        });

        $rootScope.$on(thEvents.addRelatedBug, function (event, job) {
            $scope.pinJob(job);
            $scope.toggleEnterBugNumber(true);
        });

        $rootScope.$on(thEvents.saveClassification, function () {
            if ($scope.isPinboardVisible) {
                $scope.save();
            }
        });

        $rootScope.$on(thEvents.clearPinboard, function () {
            if ($scope.isPinboardVisible) {
                $scope.unPinAll();
            }
        });

        $scope.toggleJobPin = function (job) {
            thPinboard.toggleJobPin(job);
            if (!$scope.selectedJob) {
                $scope.viewJob(job);
            }
        };

        $scope.pulsePinCount = function () {
            $(".pin-count-group").addClass("pin-count-pulse");
            $timeout(function () {
                $(".pin-count-group").removeClass("pin-count-pulse");
            }, 700);
        };

        // Triggered on pin api events eg. from the job details navbar
        $rootScope.$on(thEvents.pulsePinCount, function () {
            $scope.pulsePinCount();
        });

        $scope.pinJob = function (job) {
            thPinboard.pinJob(job);
            if (!$scope.selectedJob) {
                $scope.viewJob(job);
            }
            $scope.pulsePinCount();
        };

        $scope.unPinJob = function (id) {
            thPinboard.unPinJob(id);
        };

        $scope.addBug = function (bug) {
            thPinboard.addBug(bug);
        };

        $scope.removeBug = function (id) {
            thPinboard.removeBug(id);
        };

        $scope.unPinAll = function () {
            thPinboard.unPinAll();
            $scope.classification = thPinboard.createNewClassification();
        };

        $scope.save = function () {
            let errorFree = true;
            if ($scope.enteringBugNumber) {
                // we should save this for the user, as they likely
                // just forgot to hit enter. Returns false if invalid
                errorFree = $scope.saveEnteredBugNumber();
                if (!errorFree) {
                    thNotify.send("Please enter a valid bug number", "danger");
                }
            }
            if (!$scope.canSaveClassifications() && $scope.user.loggedin) {
                thNotify.send("Please classify this failure before saving", "danger");
                errorFree = false;
            }
            if (!$scope.user.loggedin) {
                thNotify.send("Must be logged in to save job classifications", "danger");
                errorFree = false;
            }
            if (errorFree) {
                $scope.classification.who = $scope.user.email;
                const classification = $scope.classification;
                thPinboard.save(classification);
                $scope.completeClassification();
                $scope.classification = thPinboard.createNewClassification();

                // HACK: it looks like Firefox on Linux and Windows doesn't
                // want to accept keyboard input after this change for some
                // reason which I don't understand. Chrome (any platform)
                // or Firefox on Mac works fine though.
                document.activeElement.blur();
            }
        };

        $scope.saveClassificationOnly = function () {
            if ($scope.user.loggedin) {
                $scope.classification.who = $scope.user.email;
                thPinboard.saveClassificationOnly($scope.classification);
            } else {
                thNotify.send("Must be logged in to save job classifications", "danger");
            }
        };

        $scope.saveBugsOnly = function () {
            if ($scope.user.loggedin) {
                thPinboard.saveBugsOnly();
            } else {
                thNotify.send("Must be logged in to save job classifications", "danger");
            }
        };

        $scope.isSHAorCommit = function (str) {
            return /^[a-f\d]{12,40}$/.test(str) || str.includes("hg.mozilla.org");
        };

        // If the pasted data is (or looks like) a 12 or 40 char SHA,
        // or if the pasted data is an hg.m.o url, automatically select
        // the "fixed by commit" classification type
        $scope.pasteSHA = function (evt) {
            const pastedData = evt.originalEvent.clipboardData.getData('text');
            if ($scope.isSHAorCommit(pastedData)) {
                $scope.classification.failure_classification_id = 2;
            }
        };

        $scope.retriggerAllPinnedJobs = function () {
            // pushing pinned jobs to a list.
            $scope.retriggerJob(Object.values($scope.pinnedJobs));
        };

        $scope.cancelAllPinnedJobsTitle = function () {
            if (!$scope.user.loggedin) {
                return "Not logged in";
            } else if (!$scope.canCancelAllPinnedJobs()) {
                return "No pending / running jobs in pinboard";
            }

            return "Cancel all the pinned jobs";
        };

        $scope.canCancelAllPinnedJobs = function () {
            const cancellableJobs = Object.values($scope.pinnedJobs).filter(
                job => (job.state === 'pending' || job.state === 'running'));
            return $scope.user.loggedin && cancellableJobs.length > 0;
        };

        $scope.cancelAllPinnedJobs = function () {
            if (window.confirm('This will cancel all the selected jobs. Are you sure?')) {
                $scope.cancelJobs(Object.values($scope.pinnedJobs));
            }
        };

        $scope.canSaveClassifications = function () {
            const thisClass = $scope.classification;
            return $scope.hasPinnedJobs() && $scope.user.loggedin &&
                   (thPinboard.hasRelatedBugs() ||
                   (thisClass.failure_classification_id !== 4 && thisClass.failure_classification_id !== 2) ||
                   $rootScope.currentRepo.is_try_repo ||
                   $rootScope.currentRepo.repository_group.name === "project repositories" ||
                   (thisClass.failure_classification_id === 4 && thisClass.text.length > 0) ||
                   (thisClass.failure_classification_id === 2 && thisClass.text.length > 7));
        };

        // Facilitates Clear all if no jobs pinned to reset pinboard UI
        $scope.pinboardIsDirty = function () {
            return $scope.classification.text !== '' ||
                   thPinboard.hasRelatedBugs() ||
                   $scope.classification.failure_classification_id !== 4;
        };

        // Dynamic btn/anchor title for classification save
        $scope.saveUITitle = function (category) {
            let title = "";

            if (!$scope.user.loggedin) {
                title = title.concat("not logged in / ");
            }

            if (category === "classification") {
                if (!$scope.canSaveClassifications()) {
                    title = title.concat("ineligible classification data / ");
                }
                if (!$scope.hasPinnedJobs()) {
                    title = title.concat("no pinned jobs");
                }
            // We don't check pinned jobs because the menu dropdown handles it
            } else if (category === "bug") {
                if (!$scope.hasRelatedBugs()) {
                    title = title.concat("no related bugs");
                }
            }

            if (title === "") {
                title = "Save " + category + " data";
            } else {
                // Cut off trailing "/ " if one exists, capitalize first letter
                title = title.replace(/\/ $/, "");
                title = title.replace(/^./, l => l.toUpperCase());
            }
            return title;
        };

        $scope.hasPinnedJobs = function () {
            return thPinboard.hasPinnedJobs();
        };

        $scope.hasRelatedBugs = function () {
            return thPinboard.hasRelatedBugs();
        };

        function handleRelatedBugDocumentClick(event) {
            if (!$(event.target).hasClass("add-related-bugs-input")) {
                $scope.$apply(function () {
                    if ($scope.newEnteredBugNumber) {
                        $scope.saveEnteredBugNumber();
                    } else {
                        $scope.toggleEnterBugNumber(false);
                    }
                });
            }
        }

        $scope.toggleEnterBugNumber = function (tf) {
            $scope.enteringBugNumber = tf;
            $scope.focusInput = tf;

            $document.off('click', handleRelatedBugDocumentClick);
            if (tf) {
                // Rebind escape to canceling the bug entry, pressing escape
                // again will close the pinboard as usual.
                Mousetrap.bind('escape', function () {
                    const cancel = _.bind($scope.toggleEnterBugNumber, $scope, false);
                    $scope.$evalAsync(cancel);
                });

                // Install a click handler on the document so that clicking
                // outside of the input field will close it. A blur handler
                // can't be used because it would have timing issues with the
                // click handler on the + icon.
                $timeout(function () {
                    $document.on('click', handleRelatedBugDocumentClick);
                }, 0);
            } else {
                $scope.newEnteredBugNumber = '';
            }
        };

        $scope.completeClassification = function () {
            $rootScope.$broadcast('blur-this', "classification-comment");
        };

        // The manual bug entry input eats the global ctrl+enter save() shortcut.
        // Force that event to be emitted so ctrl+enter saves the classification.
        $scope.ctrlEnterSaves = function (ev) {
            if (ev.ctrlKey && ev.keyCode === 13) {
                $scope.$evalAsync($rootScope.$emit(thEvents.saveClassification));
            }
        };

        $scope.saveEnteredBugNumber = function () {
            if ($scope.enteringBugNumber) {
                if (!$scope.newEnteredBugNumber) {
                    $scope.toggleEnterBugNumber(false);
                } else if (/^[0-9]*$/.test($scope.newEnteredBugNumber)) {
                    thPinboard.addBug({ id: $scope.newEnteredBugNumber });
                    $scope.toggleEnterBugNumber(false);
                    return true;
                }
            }
        };

        $scope.viewJob = function (job) {
            $rootScope.selectedJob = job;
            $rootScope.$emit(thEvents.jobClick, job);
            $rootScope.$emit(thEvents.selectJob, job);
        };

        $scope.classification = thPinboard.createNewClassification();
        $scope.pinnedJobs = thPinboard.pinnedJobs;
        $scope.relatedBugs = thPinboard.relatedBugs;
    }
]);
