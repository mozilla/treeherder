"use strict";

treeherder.controller('MainCtrl',
    function MainController($scope, $rootScope, $routeParams, $location, $log,
                            localStorageService, ThRepositoryModel, thPinboard,
                            thClassificationTypes, thEvents, $window) {

        thClassificationTypes.load();
        ThRepositoryModel.load();

        $scope.clearJob = function() {
            // setting the selectedJob to null hides the bottom panel
            $rootScope.selectedJob = null;
        };
        $scope.processKeyboardInput = function(ev){

            //Only listen to key commands when the body has focus. Otherwise
            //html input elements won't work correctly.
            if( (document.activeElement.nodeName != 'BODY') ||
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

        $scope.getTopNavBarHeight = function() {
            return $("th-global-top-nav-panel").find("#top-nav-main-panel").height();
        };

        // adjust the body padding so we can see all the job/resultset data
        // if the top navbar height has changed due to window width changes
        // or adding enough watched repos to wrap.
        $rootScope.$watch($scope.getTopNavBarHeight, function(newValue) {
            $("body").css("padding-top", newValue);
        });

        // give the page a way to determine which nav toolbar to show
        $rootScope.$on('$locationChangeSuccess', function(ev,newUrl) {
            $rootScope.locationPath = $location.path().replace('/', '');
        });

        $rootScope.urlBasePath = $location.absUrl().split('?')[0];

        $scope.changeRepo = function(repo_name) {
            // hide the repo panel if they chose to load one.
            $scope.isRepoPanelShowing = false;

            ThRepositoryModel.setCurrent(repo_name);
            $location.search({repo: repo_name});

        };

        $scope.pinboardCount = thPinboard.count;
        $scope.pinnedJobs = thPinboard.pinnedJobs;

        $scope.user = {};
        $scope.user.email = localStorageService.get("user.email");
        $scope.user.loggedin = $scope.user.email !== null;
    }
);
