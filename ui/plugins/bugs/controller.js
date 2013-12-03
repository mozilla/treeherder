"use strict";

treeherder.controller('BugsPluginCtrl',
    function BugsPluginCtrl($scope, $rootScope, $log) {
        $log.log("bugs plugin initialized");
        $scope.$watch('jobArtifacts', function(newValue, oldValue){
            $scope.open_bugs = []
            $scope.closed_bugs = []
            $log.log(newValue)
            if (newValue && newValue.hasOwnProperty('Open bugs')){
                $scope.open_bugs =  newValue['Open bugs'].blob;
            }
            if (newValue && newValue.hasOwnProperty('Closed bugs')){
                $scope.closed_bugs =  newValue['Closed bugs'].blob;
            }

        });
    }
);
