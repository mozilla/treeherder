"use strict";

treeherder.controller('OpenBugsPluginCtrl',
    function OpenBugsPluginCtrl($scope, $log) {
        $log.debug("open bugs plugin initialized");

        $scope.$watch('artifacts', function(newValue, oldValue){
            $scope.open_bugs = [];
            $scope.bugs_count= 0;

            if (newValue && newValue.hasOwnProperty('Open bugs') && newValue['Open bugs'].blob){
                $scope.open_bugs =  newValue['Open bugs'].blob;
                // set the item count on the tab header
                angular.forEach($scope.open_bugs, function(value, key){
                    this.bugs_count +=value.length;
                }, $scope);
            }

            for(var tab=0; tab<$scope.tabs.length; tab++){
                if ($scope.tabs[tab].id == 'open-bugs'){
                    $scope.tabs[tab].num_items = $scope.bugs_count;
                }
            }

        }, true);
    }
);
