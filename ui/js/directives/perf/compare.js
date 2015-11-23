'use strict';

treeherder.directive(
    'phCompareTable',
    ['PhCompare', 'phUnreliablePlatforms', function(PhCompare, phUnreliablePlatforms) {
        return {
            templateUrl: 'partials/perf/comparetable.html',
            scope: {
                titles: '=',
                compareResults: '=',
                testList: '=',
                filter: '=',
                showOnlyImportant: '=',
                showOnlyConfident: '=',
                showUnreliablePlatforms: '='
            },
            link: function(scope, element, attrs) {
                scope.getCompareClasses = PhCompare.getCompareClasses;
                function filter(item, matchText) {
                    return !matchText || item.toLowerCase().indexOf(matchText.toLowerCase()) > (-1);
                }
                scope.filterTest = function(item) {
                    return _.any(scope.filter.split(' '), function(matchText) {
                        return filter(item, matchText);
                    });
                };
                scope.filterPlatform = function(result) {
                    return _.any(scope.filter.split(' '), function(matchText) {
                        return filter(result.name, matchText);
                    });
                };
                scope.hideOptions = function(result) {
                    return (!scope.showOnlyImportant || result.isMeaningful)
                        && (!scope.showOnlyConfident || result.isConfident)
                        && (scope.showUnreliablePlatforms || !_.contains(
                            phUnreliablePlatforms, result.name));
                };
                function updateFilteredTestList() {
                    scope.filteredTestList = _.filter(_.keys(scope.compareResults), function(testName) {
                        return (scope.filterTest(scope.titles[testName]) ||
                            _.any(_.map(scope.compareResults[testName], function(result) {
                                return scope.filterPlatform(result);
                            }))) && _.any(_.map(scope.compareResults[testName], function(result) {
                                return scope.hideOptions(result);
                            }));
                    }).sort();
                    console.log(scope.filteredTestList);
                }
                scope.$watchGroup(['filter', 'showOnlyImportant', 'showOnlyConfident',
                                   'showUnreliablePlatforms'], function() {
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
