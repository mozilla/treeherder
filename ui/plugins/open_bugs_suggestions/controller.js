"use strict";

treeherder.controller('OpenBugsPluginCtrl',
    function OpenBugsPluginCtrl($scope, $log) {
        $log.log("open bugs plugin initialized");

        // camd: I don't see ``$scope.jobArtifacts`` being set anywhere, so this
        // watch may never get triggered.
        $scope.$watch('artifacts', function(newValue, oldValue){
            $scope.open_bugs = [];
            if (newValue && newValue.hasOwnProperty('Open bugs')){
                $scope.open_bugs =  newValue['Open bugs'].blob;
            }
        }, true);
    }
);
