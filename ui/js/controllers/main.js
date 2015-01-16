/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

treeherder.controller('MainCtrl', [
    '$scope', '$rootScope', '$routeParams', '$location', 'ThLog',
    'ThRepositoryModel', 'thPinboard',
    'thClassificationTypes', 'thEvents', '$interval', '$window',
    'ThExclusionProfileModel', 'thJobFilters', 'ThResultSetModel',
    'thDefaultRepo',
    function MainController(
        $scope, $rootScope, $routeParams, $location, ThLog,
        ThRepositoryModel, thPinboard,
        thClassificationTypes, thEvents, $interval, $window,
        ThExclusionProfileModel, thJobFilters, ThResultSetModel,
        thDefaultRepo) {

        var $log = new ThLog("MainCtrl");

        thClassificationTypes.load();

        $rootScope.getWindowTitle = function() {
            var ufc = $scope.getUnclassifiedFailureCount($rootScope.repoName);
            return "[" + ufc + "] " + $rootScope.repoName;
        };

        $scope.closeJob = function() {
            // Setting the selectedJob to null closes the bottom panel
            $rootScope.selectedJob = null;

            // Clear the selected job display style
            $rootScope.$emit(thEvents.clearJobStyles, $rootScope.selectedJob);

            // Reset selected job to null to initialize nav position
            ThResultSetModel.setSelectedJob($rootScope.repoName);
        };

        // Disable single key shortcuts in specified shortcut events
        $scope.allowKeys = function() {
            Mousetrap.unbind(['i', 'j', 'n', 'k', 'p', 'space', 'u', 'r', 'c']);
        };

        // Process shortcut events
        $scope.processKeyboardInput = function(ev) {

            /* If the user is in an editable element or pressing shift
             * then disable keyboard events, unless otherwise enabled
             * in inputs by the 'mousetrap' class in markup */
            var activeElement = document.activeElement;
            if (activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'SELECT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable || ev.keyCode === 16) {
                return;
            }

            // Shortcut: toggle display in-progress jobs (pending/running)
            Mousetrap.bind('i', function() {
                $scope.toggleInProgress();
                if (!$scope.$$phase) {
                    $scope.$digest();
                }
            });

            // Shortcut: highlight next unclassified failure
            Mousetrap.bind(['j', 'n'], function() {
                $rootScope.$emit(thEvents.selectNextUnclassifiedFailure);
            });

            // Shortcut: highlight previous unclassified failure
            Mousetrap.bind(['k', 'p'], function() {
                $rootScope.$emit(thEvents.selectPreviousUnclassifiedFailure);
            });

            // Shortcut: pin selected job to pinboard
            Mousetrap.bind('space', function(ev) {
                // If a job is selected add it otherwise
                // let the browser handle the spacebar
                if ($scope.selectedJob) {
                    // Prevent page down propagating to the jobs panel
                    ev.preventDefault();
                    $rootScope.$emit(thEvents.jobPin, $rootScope.selectedJob);
                    if (!$scope.$$phase) {
                        $scope.$digest();
                    }
                }
            });

            // Shortcut: display only unclassified failures
            Mousetrap.bind('u', function() {
                $scope.toggleUnclassifiedFailures();
                if (!$scope.$$phase) {
                    $scope.$digest();
                }
            });

            // Shortcut: pin selected job to pinboard and add a related bug
            Mousetrap.bind('r', function(ev) {
                if ($scope.selectedJob) {
                    $rootScope.$emit(thEvents.addRelatedBug,
                                     $rootScope.selectedJob);

                    // Prevent shortcut key overflow during focus
                    ev.preventDefault();
                    $rootScope.$broadcast('focus-this', "related-bug-input");
                    $scope.allowKeys();
                    if (!$scope.$$phase) {
                        $scope.$digest();
                    }
                }
            });

            // Shortcut: pin selected job to pinboard and enter classification
            Mousetrap.bind('c', function(ev) {
                if ($scope.selectedJob) {
                    $rootScope.$emit(thEvents.jobPin, $rootScope.selectedJob);

                    // Prevent shortcut key overflow during focus
                    ev.preventDefault();
                    $rootScope.$broadcast('focus-this', "classification-comment");
                    $scope.allowKeys();
                    if (!$scope.$$phase) {
                        $scope.$digest();
                    }
                }
            });

            // Shortcut: escape closes any open panels and clears selected job
            Mousetrap.bind('escape', function() {
                $scope.setFilterPanelShowing(false);
                $scope.setSettingsPanelShowing(false);
                $scope.setSheriffPanelShowing(false);
                $scope.closeJob();
                if (!$scope.$$phase) {
                    $scope.$digest();
                }
            });

            // Shortcut: clear the pinboard
            Mousetrap.bind('ctrl+shift+u', function() {
                $rootScope.$emit(thEvents.clearPinboard);
                if (!$scope.$$phase) {
                    $scope.$digest();
                }
            });

            // Shortcut: save pinboard classification and related bugs
            Mousetrap.bind('ctrl+enter', function() {
                $rootScope.$emit(thEvents.saveClassification);
            });

        };

        $scope.repoModel = ThRepositoryModel;

        $scope.getTopNavBarHeight = function() {
            return $("#th-global-top-nav-panel").find("#top-nav-main-panel").height();
        };

        // adjust the body padding so we can see all the job/resultset data
        // if the top navbar height has changed due to window width changes
        // or adding enough watched repos to wrap.
        $rootScope.$watch($scope.getTopNavBarHeight, function(newValue) {
            $("body").css("padding-top", newValue);
        });

        /**
         * The watched repos in the nav bar can be either on the left or the
         * right side of the screen and the drop-down menu may get cut off
         * if it pulls right while on the left side of the screen.
         * And it can change any time the user re-sizes the window, so we must
         * check this each time a drop-down is invoked.
         */
        $scope.setDropDownPull = function(event) {
            $log.debug("dropDown", event.target);
            var element = event.target.offsetParent;
            if (element.offsetLeft > $(window).width() / 2) {
                $(element).find(".dropdown-menu").addClass("pull-right");
            } else {
                $(element).find(".dropdown-menu").removeClass("pull-right");
            }

        };

        $scope.getUnclassifiedFailureCount = function(repoName) {
            return ThResultSetModel.getUnclassifiedFailureCount(repoName);
        };

        $scope.isSkippingExclusionProfiles = $location.search().exclusion_state === 'all';

        $scope.toggleExcludedJobs = function() {
            var newState = 'all';
            if ($scope.isSkippingExclusionProfiles) {
                newState = null;
            }
            $location.search('exclusion_state', newState);
        };

        $scope.toggleUnclassifiedFailures = thJobFilters.toggleUnclassifiedFailures;

        $scope.toggleInProgress = function() {
            thJobFilters.toggleInProgress();
        };

        $scope.allExpanded = function(cls) {
            var fullList = $("." + cls);
            var visibleList = $("." + cls + ":visible");
            return fullList.length === visibleList.length;
        };

        $scope.allCollapsed = function(cls) {
            var visibleList = $("." + cls + ":visible");
            return visibleList.length === 0;
        };

        $scope.toggleAllJobsAndRevisions = function() {
            var collapse = ($scope.allCollapsed("job-list") &&
                            $scope.allCollapsed("revision-list"));
            $rootScope.$emit(
                thEvents.toggleAllJobs, collapse
            );
            $rootScope.$emit(
                thEvents.toggleAllRevisions, collapse
            );
        };

        $scope.toggleAllJobs = function(collapse) {
            collapse = collapse || $scope.allCollapsed("job-list");
            $rootScope.$emit(
                thEvents.toggleAllJobs, collapse
            );

        };

        $scope.toggleAllRevisions = function(collapse) {
            collapse = collapse || $scope.allCollapsed("revision-list");
            $rootScope.$emit(
                thEvents.toggleAllRevisions, collapse
            );

        };

        var getNewReloadTriggerParams = function() {
            return _.pick(
                $location.search(),
                ThResultSetModel.reloadOnChangeParameters
            );
        };

        $scope.cachedReloadTriggerParams = getNewReloadTriggerParams();

        // reload the page if certain params were changed in the URL.  For
        // others, such as filtering, just re-filter without reload.
        $rootScope.$on('$locationChangeSuccess', function() {

            // used to test for display of watched-repo-navbar
            $rootScope.locationPath = $location.path().replace('/', '');

            // used to avoid bad urls when the app redirects internally
            $rootScope.urlBasePath = $location.absUrl().split('?')[0];

            var newReloadTriggerParams = getNewReloadTriggerParams();
            // if we are just setting the repo to the default because none was
            // set initially, then don't reload the page.
            var defaulting = newReloadTriggerParams.repo === thDefaultRepo &&
                             !$scope.cachedReloadTriggerParams.repo;

            if (!defaulting && $scope.cachedReloadTriggerParams &&
                !_.isEqual(newReloadTriggerParams, $scope.cachedReloadTriggerParams)) {

                $window.location.reload();
            } else {
                $scope.cachedReloadTriggerParams = newReloadTriggerParams;
            }
        });

        $scope.changeRepo = function(repo_name) {
            //clear all filter params and revisions...
            $location.search({"repo": repo_name});
        };


        $scope.isFilterPanelShowing = false;
        $scope.setFilterPanelShowing = function(tf) {
            $scope.isFilterPanelShowing = tf;
        };

        $scope.isSettingsPanelShowing = false;
        $scope.setSettingsPanelShowing = function(tf) {
            $scope.isSettingsPanelShowing = tf;
        };

        $scope.isSheriffPanelShowing = false;
        $scope.setSheriffPanelShowing = function(tf) {
            if (tf) {
                // lazy fetching of exclusion profiles, because we don't
                // need them unless you're editing them on this page
                $rootScope.$emit(thEvents.initSheriffPanel);
            }
            $scope.isSheriffPanelShowing = tf;
        };

        $scope.pinboardCount = thPinboard.count;
        $scope.pinnedJobs = thPinboard.pinnedJobs;

    }
]);
