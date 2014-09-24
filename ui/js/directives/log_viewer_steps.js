'use strict';

treeherder.directive('lvLogSteps', ['$timeout', '$q', function ($timeout, $q) {
    function getOffsetOfStep (order) {
        var el = $('.logviewer-step[order="' + order + '"]');
        var parentOffset = el.parent().offset();

        return el.offset().top -
               parentOffset.top + el.parent().scrollTop() -
               parseInt($('.steps-data').first().css('padding-bottom'));
    }

    /* -------------------------------------------------------------------- */

    return {
        restrict: 'A',
        templateUrl: 'partials/logviewer/lvLogSteps.html',
        link: function (scope, element, attr) {
            scope.scrollTo = function($event, step, linenumber) {
                scope.currentLineNumber = linenumber;

                scope.loadMore({}).then(function () {
                    $timeout(function () {
                        var raw = $('.lv-log-container')[0];
                        var line = $('.lv-log-line[line="' + linenumber + '"]');
                        raw.scrollTop += line.offset().top - $('.run-data').outerHeight() - 15 ;
                    });
                }, function () {
                    // there is an error so bomb out
                    return $q.reject();
                });

                if (scope.displayedStep && scope.displayedStep.order === step.order) {
                    $event.stopPropagation();
                }
            };

            scope.toggleSuccessfulSteps = function() {
                scope.showSuccessful = !scope.showSuccessful;

                var firstError = scope.artifact.step_data.steps.filter(function(step){
                    return step.result && step.result !== "success";
                })[0];

                if (!firstError) return;

                // scroll to the first error
                $timeout(function () {
                    var scrollTop = getOffsetOfStep(firstError.order);

                    $('.steps-data').scrollTop( scrollTop );
                });
            };

            scope.displayLog = function(step) {
                scope.displayedStep = step;
                scope.currentLineNumber = step.started_linenumber;

                scope.loadMore({}).then(function () {
                    $timeout(function () {
                        var raw = $('.lv-log-container')[0];
                        var line = $('.lv-log-line[line="' + step.started_linenumber + '"]');
                        raw.scrollTop += line.offset().top - $('.run-data').outerHeight() - 15 ;
                    });
                });
            };
        }
    };
}]);
