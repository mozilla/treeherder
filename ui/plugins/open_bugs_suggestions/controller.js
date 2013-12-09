"use strict";

treeherder.controller('OpenBugsPluginCtrl',
    function OpenBugsPluginCtrl($scope, $log) {
        $log.log("open bugs plugin initialized");

        // camd: I don't see ``$scope.jobArtifacts`` being set anywhere, so this
        // watch may never get triggered.
        $scope.$watch('artifacts', function(newValue, oldValue){
            $scope.open_bugs = [];

            if (newValue && newValue.hasOwnProperty('Open bugs') && newValue['Open bugs'].blob){
                $scope.open_bugs =  newValue['Open bugs'].blob;
                // set the item count on the tab header
            }

            for(var tab=0; tab<$scope.tabs.length; tab++){
                if ($scope.tabs[tab].id == 'open-bugs'){
                    $scope.tabs[tab].num_items = $scope.open_bugs.length;
                }
            }

        }, true);
    }
);
