"use strict";

treeherder.controller('ClosedBugsPluginCtrl',
    function ClosedBugsPluginCtrl($scope, $rootScope, $log) {
        $log.log("closed bugs plugin initialized");

        // camd: I don't see ``$scope.jobArtifacts`` being set anywhere, so this
        // watch may never get triggered.
        $scope.$watch('artifacts', function(newValue, oldValue){
            $scope.closed_bugs = [];
            $scope.bugs_count= 0;

            if (newValue && newValue.hasOwnProperty('Closed bugs') && newValue['Closed bugs'].blob){
                $scope.closed_bugs =  newValue['Closed bugs'].blob;
                // set the item count on the tab header
                angular.forEach($scope.closed_bugs, function(value, key){
                    this.bugs_count +=value.length;
                }, $scope);
            }

            for(var tab=0; tab<$scope.tabs.length; tab++){
                if ($scope.tabs[tab].id == 'closed-bugs'){
                    $scope.tabs[tab].num_items = $scope.bugs_count;
                }
            }

        }, true);
    }
);
