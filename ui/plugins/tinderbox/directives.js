"use strict";
treeherder.directive('thPrintLine', function() {

    return {
        controller:function($scope, $log){
            $log.log("thPrintline initialized");

        },
        scope: {
            line: '=line'
        },
        template: 'printline.html'
    };
});