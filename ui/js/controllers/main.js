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

        $scope.processKeyboardInput = function(ev){

            // If the user is in an editable element or the user is pressing
            // shift, then disable keyboard events
            var activeElement = document.activeElement;
            if (activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'SELECT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable || ev.keyCode === 16) {
                return;
            }

            // test for key modifiers to allow browser shortcuts eg.
            // console, new/private browsing window, history, print
            if (!ev.metaKey && !ev.shiftKey && !ev.ctrlKey) {
                if ((ev.keyCode === 73)) {
                    // toggle display in-progress jobs(pending/running), key:i
                    $scope.toggleInProgress();

                } else if ((ev.keyCode === 74) || (ev.keyCode === 78)) {
                    //Highlight next unclassified failure keys:j/n
                    $rootScope.$emit(
                        thEvents.selectNextUnclassifiedFailure
                    );

                } else if ((ev.keyCode === 75) || (ev.keyCode === 80)) {
                    //Highlight previous unclassified failure keys:k/p
                    $rootScope.$emit(
                        thEvents.selectPreviousUnclassifiedFailure
                    );

                } else if (ev.keyCode === 32) {
                    // If a job is selected add it otherwise
                    // let the browser handle the spacebar
                    if ($scope.selectedJob) {
                        // Pin selected job to pinboard, key:[spacebar]
                        // and prevent page down propagating to the jobs panel
                        ev.preventDefault();
                        $rootScope.$emit(thEvents.jobPin, $rootScope.selectedJob);
                    }

                } else if (ev.keyCode === 85) {
                    // Display only unclassified failures, keys:u
                    $scope.toggleUnclassifiedFailures();

                } else if (ev.keyCode === 82) {
                    // Pin selected job to pinboard and add a related bug, key:r
                    if ($scope.selectedJob) {
                        $rootScope.$emit(thEvents.addRelatedBug, $rootScope.selectedJob);
                    }

                } else if (ev.keyCode === 27) {
                    // Escape closes any open panels and clears the selected job
                    $scope.setFilterPanelShowing(false);
                    $scope.setSettingsPanelShowing(false);
                    $scope.setSheriffPanelShowing(false);
                    $scope.closeJob();
                }
            }
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

        $scope.isSkippingExclusionProfiles = function() {
            return thJobFilters.isSkippingExclusionProfiles();
        };

        $scope.getUnclassifiedFailureCount = function(repoName) {
            return ThResultSetModel.getUnclassifiedFailureCount(repoName);
        };

        $scope.getTimeWindowUnclassifiedFailureCount = function(repoName) {
            return thJobFilters.getCountExcludedForRepo(repoName);
        };

        $scope.toggleExcludedJobs = function() {
            thJobFilters.toggleSkipExclusionProfiles();
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

        /**
         * Extract the params from the querystring of this url that should
         * trigger a reload of the page, because it requires new data from
         * the repo
         * @param urlStr a full Url as a string
         * @returns Object containing only the params in ``reloadFields``
         */
        var getTriggerParams = function(urlStr) {
            var tokens = urlStr.split("?");
            var triggerParams = {};

            if (tokens.length > 1) {
                triggerParams = _.pick(
                    $.deparam(tokens[1]),
                    ThResultSetModel.reloadOnChangeParameters
                );
            }

            return triggerParams;
        };

        // reload the page if certain params were changed in the URL.  For
        // others, such as filtering, just re-filter without reload.
        $rootScope.$on('$locationChangeSuccess', function(ev, newUrl, oldUrl) {

            // used to test for display of watched-repo-navbar
            $rootScope.locationPath = $location.path().replace('/', '');

            // used to avoid bad urls when the app redirects internally
            $rootScope.urlBasePath = $location.absUrl().split('?')[0];

            $log.debug("check for reload", "newUrl=", newUrl, "oldUrl=", oldUrl);

            var oldParams = getTriggerParams(oldUrl);
            var newParams = getTriggerParams(newUrl);
            // if we are just setting the repo to the default because none was
            // set initially, then don't reload the page.
            var defaulting = newParams.repo === thDefaultRepo && !oldParams.repo;
            if (!_.isEqual(oldParams, newParams) && !defaulting) {
                $window.location.reload();
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
            $scope.isSheriffPanelShowing = tf;
        };

        $scope.pinboardCount = thPinboard.count;
        $scope.pinnedJobs = thPinboard.pinnedJobs;

        // get a cached version of the exclusion profiles
        ThExclusionProfileModel.get_list({}, true).then(function(profiles){
            $scope.exclusion_profiles = profiles;
            thJobFilters.setActiveExclusionProfile(_.find(
                $scope.exclusion_profiles,
                function(elem){
                    return elem.is_default;
                }
            ));
        }, null);
    }
]);
