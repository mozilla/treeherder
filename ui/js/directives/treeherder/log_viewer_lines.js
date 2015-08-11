/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

treeherder.directive('lvLogLines', ['$timeout', '$parse', function ($timeout) {
    function getOffsetOfStep (order) {
        var el = $('.lv-step[order="' + order + '"]');
        var parentOffset = el.parent().offset();

        return el.offset().top -
               parentOffset.top + el.parent().scrollTop() -
               parseInt($('.steps-data').first().css('padding-bottom'));
    }

    function onScroll ($scope) {
        var lines = $('.lv-log-line');
        var scrollTop = $('.lv-log-container').scrollTop();

        for (var i = 0, l = lines.length; i < l; i++) {
            if (lines[i].offsetTop > scrollTop) {
                var steps = $scope.artifact.step_data.steps;
                var lineNumber = +$(lines[i]).attr('line');

                for (var j = 0, ll = steps.length; j < ll; j++) {
                    if (lineNumber > (steps[j].started_linenumber - 1) &&
                        lineNumber < (steps[j].finished_linenumber + 1)) {
                        // make sure we aren't updating when its already correct
                        if ($scope.displayedStep.order === steps[j].order) return;

                        $scope.displayedStep = steps[j];

                        // scroll to the step
                        var scrollTop = getOffsetOfStep(steps[j].order);
                        $('.steps-data').scrollTop(scrollTop);

                        if(!$scope.$$phase) {$scope.$apply();}

                        return;
                    }
                }
            }
        }
    }

    /* -------------------------------------------------------------------- */

    return {
        restrict: 'A',
        templateUrl: 'partials/logviewer/lvLogLines.html',
        link: function (scope, element, attr) {
            $(element).scroll(onScroll.bind(this, scope));
        }
    };
}]);
