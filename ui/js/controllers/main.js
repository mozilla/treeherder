"use strict";

treeherder.controller('MainCtrl',
    function MainController($scope, $rootScope, $routeParams, $location, ThLog,
                            localStorageService, ThRepositoryModel, thPinboard,
                            thClassificationTypes, thEvents, $interval, ThExclusionProfileModel) {

        var $log = new ThLog("MainCtrl");

        thClassificationTypes.load();
        ThRepositoryModel.load();

        $scope.clearJob = function() {
            // setting the selectedJob to null hides the bottom panel
            $rootScope.selectedJob = null;
        };
        $scope.processKeyboardInput = function(ev){

            //Only listen to key commands when the body has focus. Otherwise
            //html input elements won't work correctly.
            if( (document.activeElement.nodeName !== 'BODY') ||
                (ev.keyCode === 16) ){
                return;
            }

            if( (ev.keyCode === 74) || (ev.keyCode === 78) ){
                //Highlight next unclassified failure keys:j/n
                $rootScope.$broadcast(
                    thEvents.selectNextUnclassifiedFailure
                    );

            }else if( (ev.keyCode === 75) || (ev.keyCode === 80) ){
                //Highlight previous unclassified failure keys:k/p
                $rootScope.$broadcast(
                    thEvents.selectPreviousUnclassifiedFailure
                    );

            }else if(ev.keyCode === 83){
                //Select/deselect active build or changeset, keys:s
                $rootScope.$broadcast(thEvents.jobPin, $rootScope.selectedJob);

            }else if(ev.keyCode === 85){
                //display only unclassified failures, keys:u
                $rootScope.$broadcast(thEvents.showUnclassifiedFailures);
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
            $scope.$apply();
        };

        // the repos the user has chosen to watch
        $scope.watchedRepos = ThRepositoryModel.watchedRepos;

        $scope.unwatchRepo = function(name) {
            ThRepositoryModel.unwatch(name);
        };

        // update the repo status (treestatus) in an interval of every 2 minutes
        $interval(ThRepositoryModel.updateAllWatchedRepoTreeStatus, 2 * 60 * 1000);

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

        $scope.allJobsExpanded = true;

        $scope.toggleAllJobs = function() {
            $scope.allJobsExpanded = !$scope.allJobsExpanded;
            $rootScope.$broadcast(
                thEvents.toggleAllJobs, $scope.allJobsExpanded
            );

        };

        $scope.allRevisionsExpanded = false;

        $scope.toggleAllRevisions = function() {
            $scope.allRevisionsExpanded = !$scope.allRevisionsExpanded;
            $rootScope.$broadcast(
                thEvents.toggleAllRevisions, $scope.allRevisionsExpanded
            );

        };

        // give the page a way to determine which nav toolbar to show
        $rootScope.$on('$locationChangeSuccess', function(ev,newUrl) {
            $rootScope.locationPath = $location.path().replace('/', '');
        });

        $rootScope.urlBasePath = $location.absUrl().split('?')[0];

        $scope.isRepoPanelShowing = false;
        $scope.changeRepo = function(repo_name) {
            // hide the repo panel if they chose to load one.
            $scope.isRepoPanelShowing = false;

            ThRepositoryModel.setCurrent(repo_name);
            $location.search({repo: repo_name});

        };

        $scope.pinboardCount = thPinboard.count;
        $scope.pinnedJobs = thPinboard.pinnedJobs;

        $scope.user = angular.fromJson(localStorageService.get("user")) || {};
        $scope.user.loggedin = angular.isDefined($scope.user.email) && $scope.user.email !== null;

        // get a cached version of the exclusion profiles
        ThExclusionProfileModel.get_list({}, true).then(function(profiles){
            $scope.exclusion_profiles = profiles;
            $rootScope.active_exclusion_profile = _.find(
                $scope.exclusion_profiles,
                function(elem){
                    return elem.is_default;
                }
            );
            if($rootScope.active_exclusion_profile){
                $scope.$broadcast(thEvents.globalFilterChanged, null);
            }
        }, null);
    }
);
