'use strict';

treeherder.directive('lvLogLines', ['$parse', function () {
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

        for (var i = 0, ll = lines.length; i < ll; i++) {
            if (lines[i].offsetTop > scrollTop) {
                var steps = $scope.steps;
                var lineNumber = +$(lines[i]).attr('line');

                for (var j = 0, sl = steps.length; j < sl; j++) {
                    if (lineNumber > (steps[j].started_line_number - 1) &&
                        lineNumber < (steps[j].finished_line_number + 1)) {
                        // make sure we aren't updating when its already correct
                        if ($scope.displayedStep &&
                            $scope.displayedStep.order === steps[j].order) {
                            return;
                        }

                        $scope.displayedStep = steps[j];

                        // scroll to the step
                        scrollTop = getOffsetOfStep(steps[j].order);
                        $('.steps-data').scrollTop(scrollTop);

                        if (!$scope.$$phase) {
                            $scope.$apply();
                        }

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
        link: function (scope, element) {
            $(element).scroll(onScroll.bind(this, scope));
        }
    };
}]);
