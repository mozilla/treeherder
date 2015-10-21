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
                testFilter: '=',
                platformFilter: '=',
                showOnlyImportant: '=',
                showOnlyConfident: '='
            },
            link: function(scope, element, attrs) {
                scope.getCompareClasses = PhCompare.getCompareClasses;
                function filter(item, matchText) {
                    return item.toLowerCase().indexOf(matchText.toLowerCase()) > (-1);
                }
                scope.filterTest = function(item) {
                    return filter(item, scope.testFilter);
                };
                scope.filterPlatform = function(result) {
                    return filter(result.name, scope.platformFilter) &&
                        (!scope.showOnlyImportant || result.isMeaningful) &&
                        (!scope.showOnlyConfident || result.isConfident);
                };
                function updateFilteredTestList() {
                    scope.filteredTestList = _.filter(_.keys(scope.compareResults), function(testName) {
                        return scope.filterTest(scope.titles[testName]) &&
                            _.any(_.map(scope.compareResults[testName], function(result) {
                                return scope.filterPlatform(result);
                            }));
                    }).sort();
                }
                scope.$watchGroup(['testFilter', 'platformFilter',
                                   'showOnlyImportant', 'showOnlyConfident'], function() {
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
