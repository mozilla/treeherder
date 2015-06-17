/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */
 
'use strict';

perf.directive("testDataChooser", function() {
    return {
        restrict: "E",
        templateUrl: "partials/perf/testdatachooser.html",
        scope: {
            leftList: "=",
            rightList: "=",
        },
        link: function (scope, element, attrs) {
            
            scope.leftSelected = [];
            scope.rightSelected = [];
            var move_options = function(what, from, to) {
                var selected;
                for(var i=0; i<what.length; i++) {
                    selected = from.indexOf(what[i]);
                    if(selected !== -1) {
                        to.push(from.splice(selected, 1)[0]);                    
                    }
                }
            }
            scope.move_left = function() {
                move_options(scope.rightSelected, scope.rightList, scope.leftList);
            };
            scope.move_right = function() {
                move_options(scope.leftSelected, scope.leftList, scope.rightList);
            };
        }
    }
});