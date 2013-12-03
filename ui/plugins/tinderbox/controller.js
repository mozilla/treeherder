"use strict";

treeherder.controller('TinderboxPluginCtrl',
    function TinderboxPluginCtrl($scope, $rootScope, $log) {
        $log.log("Tinderbox plugin initialized");
        $scope.$watch('artifacts', function(newValue, oldValue){
            $scope.tinderbox_lines = []
            $log.log(newValue)
            if (newValue && newValue.hasOwnProperty('Job Info')){
                $scope.tinderbox_lines =  newValue['Job Info'].blob.tinderbox_printlines;
            }
        });

    }
);
