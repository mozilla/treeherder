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
                function shouldBeHidden(result) {
                    return (!scope.showOnlyImportant || result.isMeaningful)
                        && (!scope.showOnlyConfident || result.isConfident)
                        && (scope.showUnreliablePlatforms || !_.contains(
                            phUnreliablePlatforms, result.name));
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
                // We use this function to sort result list been filtered out.
                function sortResults (resultsList) {
                    var keys = _.sortBy(_.keys(resultsList), function (key) {
                        return key;
                    });
                    return _.object(keys, _.map(keys, function (key) {
                        return resultsList[key];
                    }));
                }

                function updateFilteredTestList() {
                    scope.filteredResultList = {};
                    _.forEach(scope.compareResults, function(result, key) {
                        var compareResults = filterResult(result, key);
                        if (compareResults.length > 0) {
                            scope.filteredResultList[key] = compareResults;
                        }
                    });
                    scope.filteredResultList = sortResults(scope.filteredResultList);
                    scope.hasNoResults = _.isEmpty(scope.filteredResultList);
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
