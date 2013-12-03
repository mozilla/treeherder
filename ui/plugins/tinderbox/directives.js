"use strict";

treeherder.directive('thPrintLine', function() {
    console.log("thPrintline initialized")
    return {
        restrict: 'E',
        scope: {
            line: '=line'
        },
        template: '<span>{{line}}</span>'
    };
});