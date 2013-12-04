"use strict";

treeherder.controller('ClosedBugsPluginCtrl',
    function ClosedBugsPluginCtrl($scope, $rootScope, $log) {
        $log.log("closed bugs plugin initialized");

        // camd: I don't see ``$scope.jobArtifacts`` being set anywhere, so this
        // watch may never get triggered.
        $scope.$watch('artifacts', function(newValue, oldValue){
            $scope.closed_bugs = [];
            if (newValue && newValue.hasOwnProperty('Closed bugs')){
                $scope.closed_bugs =  newValue['Closed bugs'].blob;
            }

        }, true);
    }
);
