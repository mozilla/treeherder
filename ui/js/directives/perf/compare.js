'use strict';

treeherder.directive(
    'phCompareTable',
    ['PhCompare', function(PhCompare) {
        return {
            templateUrl: 'partials/perf/comparetable.html',
            scope: {
                titles: '=',
                compareResults: '=',
                testList: '=',
                filter: '=',
                showOnlyImportant: '=',
                showOnlyConfident: '='
            },
            link: function(scope, element, attrs) {
                scope.getCompareClasses = PhCompare.getCompareClasses;
                function filter(item, matchText) {
                    return !matchText || item.toLowerCase().indexOf(matchText.toLowerCase()) > (-1);
                }
                function shouldBeHidden(result) {
                    return (!scope.showOnlyImportant || result.isMeaningful)
                        && (!scope.showOnlyConfident || result.isConfident);
                }
                function filterResult (results, key) {
                    if (scope.filter === undefined) {
                        return results;
                    }
                    return _.filter(results, function(result) {
                        var testCondition = key + ' ' + result.name;
                        return _.every(scope.filter.split(' '), function(matchText) {
                            return filter(testCondition, matchText) && shouldBeHidden(result);
                        });
                    });
                }

                function updateFilteredTestList() {
                    scope.filteredResultList = {};
                    _.forEach(scope.compareResults, function(result, key) {
                        var compareResults = filterResult(result, key);
                        if (compareResults.length > 0) {
                            scope.filteredResultList[key] = compareResults;
                        }
                    });
                    scope.filteredResultList = _.map(_.keys(scope.filteredResultList), function(testName) {
                        return {'testName': testName, 'results': scope.filteredResultList[testName]};
                    });
                    scope.hasNoResults = _.isEmpty(scope.filteredResultList);
                }

                scope.$watchGroup(['filter', 'showOnlyImportant', 'showOnlyConfident'],
                                  function() {
                                      updateFilteredTestList();
                                  });
                updateFilteredTestList();
            }
        };
    }]);

treeherder.directive(
    'phAverage', function() {
        return {
            templateUrl: 'partials/perf/average.html',
            scope: {
                value: '@',
                stddev: '@',
                stddevpct: '@',
                replicates: '='
            }
        };
    });

treeherder.directive(
    'revisionInformation', function() {
        return {
            restrict: 'E',
            templateUrl: 'partials/perf/revisiondescribe.html',
            scope: {
                originalProject: '=',
                originalRevision: '=',
                newProject: '=',
                newRevision: '=',
                originalResultSet: '=',
                newResultSet: '='
            }
        };
    });

treeherder.directive(
    'compareError', function() {
        return {
            templateUrl: 'partials/perf/comparerror.html',
            restrict: 'E',
            scope: {
                errors: '=',
                originalProject: '=',
                originalRevision: '=',
                newProject: '=',
                newRevision: '='
            }
        };
    });
