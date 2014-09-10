"use strict";

treeherder.controller('MainCtrl', [
    '$scope', '$rootScope', '$routeParams', '$location', 'ThLog',
    'localStorageService', 'ThRepositoryModel', 'thPinboard',
    'thClassificationTypes', 'thEvents', '$interval', '$window',
    'ThExclusionProfileModel', 'thJobFilters', 'ThResultSetModel',
    function MainController(
        $scope, $rootScope, $routeParams, $location, ThLog,
        localStorageService, ThRepositoryModel, thPinboard,
        thClassificationTypes, thEvents, $interval, $window,
        ThExclusionProfileModel, thJobFilters, ThResultSetModel) {

        var $log = new ThLog("MainCtrl");

        thClassificationTypes.load();

        $rootScope.getWindowTitle = function() {
            var ufc = $scope.getUnclassifiedFailureCount($rootScope.repoName);
            var title = $rootScope.repoName;
            if (ufc > 0) {
                title = "[" + ufc + "] " + title;
            }
            return title;
        };

        $scope.clearJob = function() {
            // setting the selectedJob to null hides the bottom panel
            $rootScope.selectedJob = null;
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

            if (!ev.metaKey) {
                if ((ev.keyCode === 73)) {
                    // toggle display in-progress jobs(pending/running), key:i
                    $scope.toggleInProgress();

                } else if ((ev.keyCode === 74) || (ev.keyCode === 78)) {
                    //Highlight next unclassified failure keys:j/n
                    $rootScope.$broadcast(
                        thEvents.selectNextUnclassifiedFailure
                    );

                } else if ((ev.keyCode === 75) || (ev.keyCode === 80)) {
                    //Highlight previous unclassified failure keys:k/p
                    $rootScope.$broadcast(
                        thEvents.selectPreviousUnclassifiedFailure
                    );

                } else if (ev.keyCode === 32) {
                    // If a job is selected add it otherwise
                    // let the browser handle the spacebar
                    if ($scope.selectedJob) {
                        // Pin selected job to pinboard, key:[spacebar]
                        // and prevent page down propagating to the jobs panel
                        ev.preventDefault();
                        $rootScope.$broadcast(thEvents.jobPin, $rootScope.selectedJob);
                    }

                } else if (ev.keyCode === 85) {
                    //display only unclassified failures, keys:u
                    $scope.toggleUnclassifiedFailures();
                } else if (ev.keyCode === 27) {
                    // escape key closes any open top-panel and clears selected job
                    $scope.setFilterPanelShowing(false);
                    $scope.setSettingsPanelShowing(false);
                    $scope.setSheriffPanelShowing(false);
                    $scope.clearJob();
                }
            }
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
            if(!$scope.$$phase){
                $scope.$apply();
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
            if (element.offsetLeft > $scope.getWidth() / 2) {
                $(element).find(".dropdown-menu").addClass("pull-right");
            } else {
                $(element).find(".dropdown-menu").removeClass("pull-right");
            }

        };

        $scope.isSkippingExclusionProfiles = function() {
            return thJobFilters.isSkippingExclusionProfiles();
        };

        $scope.getUnclassifiedFailureCount = function(repoName) {
            // TODO  Not yet honoring excluded jobs
            return ThResultSetModel.getUnclassifiedFailureCount(repoName);
        };

        $scope.getTimeWindowUnclassifiedFailureCount = function(repoName) {
            return thJobFilters.getCountExcludedForRepo(repoName);
        };

        $scope.toggleExcludedJobs = function() {
            thJobFilters.toggleSkipExclusionProfiles();
        };

        $scope.toggleUnclassifiedFailures = function() {
            $log.debug("toggleUnclassifiedFailures");
            if (thJobFilters.isUnclassifiedFailures()) {
                thJobFilters.resetNonFieldFilters();
            } else {
                thJobFilters.showUnclassifiedFailures();
            }
        };

        $scope.toggleInProgress = function() {
            thJobFilters.toggleInProgress();
        };

        thJobFilters.buildFiltersFromQueryString();

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
            $rootScope.$broadcast(
                thEvents.toggleAllJobs, collapse
            );
            $rootScope.$broadcast(
                thEvents.toggleAllRevisions, collapse
            );
        };

        $scope.toggleAllJobs = function(collapse) {
            collapse = collapse || $scope.allCollapsed("job-list");
            $rootScope.$broadcast(
                thEvents.toggleAllJobs, collapse
            );

        };

        $scope.toggleAllRevisions = function(collapse) {
            collapse = collapse || $scope.allCollapsed("revision-list");
            $rootScope.$broadcast(
                thEvents.toggleAllRevisions, collapse
            );

        };

        var getRepoParam = function(urlStr) {
            var tokens = urlStr.split("?");

            if (tokens.length > 1) {
                var params = tokens[1];
                var paramArr = params.split("&");
                var i;
                for (i = 0; i < paramArr.length; i++) {
                    var thisParam = paramArr[i].split("=");
                    if (thisParam[0] === "repo") {
                        return thisParam[1];
                    }
                }
            }

            return "";
        };

        $rootScope.locationPath = $location.path().replace('/', '');

        // this is to avoid bad urls showing up
        // when the app redirects internally
        $rootScope.urlBasePath = $location.absUrl().split('?')[0];

        // give the page a way to determine which nav toolbar to show
        $rootScope.$on('$locationChangeSuccess', function(ev,newUrl, oldUrl) {
            $log.debug("newUrl=", newUrl, "oldUrl=", oldUrl);

            $log.debug("check for repo change", "old=", getRepoParam(oldUrl), "new=", getRepoParam(newUrl));
            var newRepo = getRepoParam(newUrl);
            if (getRepoParam(oldUrl) !== newRepo) {
                $location.search({"repo": newRepo});
                $window.location.reload();
            } else {
                thJobFilters.buildFiltersFromQueryString();
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
