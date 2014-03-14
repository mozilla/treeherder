"use strict";

treeherder.controller('AnnotationsPluginCtrl',
    function AnnotationsPluginCtrl($scope, $log, ThJobClassificationModel, thNotify) {
        $log.debug("annotations plugin initialized");

        $scope.$watch('classifications', function(newValue, oldValue){

            $scope.tabs.annotations.num_items = newValue ? $scope.classifications.length : 0;
        }, true);

        $scope.deleteClassification = function(classification) {
            var jcModel = new ThJobClassificationModel(classification);
            jcModel.delete()
                .then(
                    function(){
                        thNotify.send({
                            message: "Classification successfully deleted",
                            severity: "success",
                            sticky: false
                        });
                    },
                    function(){
                        thNotify.send({
                            message: "Classification deletion failed",
                            severity: "danger",
                            sticky: true
                        });
                    }
                );
        };
    }
);
