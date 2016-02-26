'use strict';

treeherder.directive(
    'phCompareTable',
    ['PhCompare', function(PhCompare) {
        return {
            templateUrl: 'partials/perf/comparetable.html',
            scope: {
                baseTitle: '@',
                newTitle: '@',
                frameworks: '=',
                titles: '=',
                compareResults: '=',
                testList: '=',
                filterOptions: '=',
                filterByFramework: '@'
            },
            link: function(scope, element, attrs) {
                if (!scope.baseTitle) {
                    scope.baseTitle = "Base";
                }
                if (!scope.newTitle) {
                    scope.newTitle = "New";
                }

                scope.getCompareClasses = PhCompare.getCompareClasses;
                function filter(item, matchText) {
                    return !matchText || item.toLowerCase().indexOf(matchText.toLowerCase()) > (-1);
                }
                function shouldBeShown(result) {
                    return (!scope.filterByFramework || _.isUndefined(scope.filterOptions.framework) ||
                            result.frameworkId === scope.filterOptions.framework.id) &&
                        (!scope.filterOptions.showOnlyImportant || result.isMeaningful) &&
                        (!scope.filterOptions.showOnlyConfident || result.isConfident);
                }
                function filterResult(results, key) {
                    if (_.isUndefined(scope.filterOptions.filter)) {
                        return results;
                    }
                    return _.filter(results, function(result) {
                        var testCondition = key + ' ' + result.name;
                        return _.every(scope.filterOptions.filter.split(' '), function(matchText) {
                            return filter(testCondition, matchText) && shouldBeShown(result);
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

                scope.$watchGroup([
                    'filterOptions.framework', 'filterOptions.filter',
                    'filterOptions.showOnlyImportant',
                    'filterOptions.showOnlyConfident'],
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
