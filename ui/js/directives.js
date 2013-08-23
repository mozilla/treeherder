'use strict';

angular.module('treeherder.directives', []).
    directive('processLog', function() {
        return function(scope, element, attrs){
            scope.$watch('logData', function(data) {
                if(data) {
                    scope.full_log = [];
                    scope.jsonObj.step_data.steps.forEach(function(step) {
                        var offset = step.started_linenumber;
                        var procStep = [];
                        step.errors.forEach(function(err) {
                            var end = err.linenumber;
                            if (offset !== end) {
                                procStep.push({
                                    text: (data.slice(offset, end)).join('\n'),
                                    hasError: false
                                });
                            }
                            procStep.push({
                                text: data.slice(end, end+1),
                                hasError: true,
                                errLine: end
                            });
                            offset = end+1;
                        });
                        procStep.push({
                            text: (data.slice(offset, step.finished_linenumber+1)).join('\n'),
                            hasError: false
                        });
                        scope.full_log.push(procStep);
                    });
                }
            });
        }
    });
