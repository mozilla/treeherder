"use strict";

treeherder.controller('AnnotationsPluginCtrl',
    function AnnotationsPluginCtrl($scope, $log) {
        $log.debug("annotations plugin initialized");

        $scope.$watch('classifications', function(newValue, oldValue){

            $scope.tabs.annotations.num_items = newValue ? $scope.classifications.length : 0;
        }, true);
    }
);
