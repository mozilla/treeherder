'use strict';

treeherder.component('phCompareTable', {
    templateUrl: 'partials/perf/comparetable.html',
    bindings: {
        baseTitle: '@',
        newTitle: '@',
        frameworks: '<',
        titles: '<',
        compareResults: '<',
        testList: '<',
        filterOptions: '<',
        filterByFramework: '@',
        releaseBlockerCriteria: '@'
    },
    controller: function() {
        var ctrl = this;

        if (!ctrl.baseTitle) {
            ctrl.baseTitle = "Base";
        }
        if (!ctrl.newTitle) {
            ctrl.newTitle = "New";
        }
        ctrl.getCompareClasses = function(cr, type) {
            if (cr.isEmpty) return 'subtest-empty';
            if (type === 'row' && cr.highlightedTest) return 'active subtest-highlighted';
            if (type === 'row') return '';
            if (type === 'bar' && cr.isRegression) return 'bar-regression';
            if (type === 'bar' && cr.isImprovement) return 'bar-improvement';
            if (type === 'bar') return '';
            return cr.className;
        };

        function filter(item, matchText) {
            return !matchText || item.toLowerCase().indexOf(matchText.toLowerCase()) > (-1);
        }
        function shouldBeShown(result) {
            return (!ctrl.filterOptions.showOnlyImportant || result.isMeaningful) &&
                (!ctrl.filterOptions.showOnlyConfident || result.isConfident) &&
                (!ctrl.filterOptions.showOnlyBlockers || result.isBlocker);
        }
        function filterResult(results, key) {
            if (_.isUndefined(ctrl.filterOptions.filter)) {
                return results;
            }
            return _.filter(results, function(result) {
                var testCondition = key + ' ' + result.name;
                return _.every(ctrl.filterOptions.filter.split(' '), function(matchText) {
                    return filter(testCondition, matchText) && shouldBeShown(result);
                });
            });
        }

        ctrl.updateFilteredTestList = function() {
            ctrl.filteredResultList = {};
            _.forEach(ctrl.compareResults, function(result, key) {
                var compareResults = filterResult(result, key);
                if (compareResults.length > 0) {
                    ctrl.filteredResultList[key] = compareResults;
                }
            });
            ctrl.filteredResultList = _.map(_.keys(ctrl.filteredResultList), function(testName) {
                return {'testName': testName, 'results': ctrl.filteredResultList[testName]};
            });
        };

        ctrl.updateFilteredTestList();
    }
});

treeherder.component('phTrendTable', {
    templateUrl: 'partials/perf/trendtable.html',
    bindings: {
        baseTitle: '@',
        newTitle: '@',
        frameworks: '<',
        titles: '<',
        compareResults: '<',
        testList: '<',
        filterOptions: '<',
        filterByFramework: '@',
        releaseBlockerCriteria: '@'
    },
    controller: function() {
        var ctrl = this;

        if (!ctrl.baseTitle) {
            ctrl.baseTitle = "Base";
        }
        if (!ctrl.newTitle) {
            ctrl.newTitle = "New";
        }
        ctrl.getCompareClasses = function(cr, type) {
            if (cr.isEmpty) return 'subtest-empty';
            if (type === 'row' && cr.highlightedTest) return 'active subtest-highlighted';
            if (type === 'row') return '';
            if (type === 'bar' && cr.isRegression) return 'bar-regression';
            if (type === 'bar' && cr.isImprovement) return 'bar-improvement';
            if (type === 'bar') return '';
            return cr.className;
        };

        function filter(item, matchText) {
            return !matchText || item.toLowerCase().indexOf(matchText.toLowerCase()) > (-1);
        }
        function shouldBeShown(result) {
            return (!ctrl.filterOptions.showOnlyImportant || result.isMeaningful) &&
                (!ctrl.filterOptions.showOnlyConfident || result.isConfident) &&
                (!ctrl.filterOptions.showOnlyBlockers || result.isBlocker);
        }
        function filterResult(results, key) {
            if (_.isUndefined(ctrl.filterOptions.filter)) {
                return results;
            }
            return _.filter(results, function(result) {
                var testCondition = key + ' ' + result.name;
                return _.every(ctrl.filterOptions.filter.split(' '), function(matchText) {
                    return filter(testCondition, matchText) && shouldBeShown(result.trendResult);
                });
            });
        }

        ctrl.updateFilteredTestList = function() {
            ctrl.filteredResultList = {};
            _.forEach(ctrl.compareResults, function(result, key) {
                var compareResults = filterResult(result, key);
                if (compareResults.length > 0) {
                    ctrl.filteredResultList[key] = compareResults;
                }
            });
            ctrl.filteredResultList = _.map(_.keys(ctrl.filteredResultList), function(testName) {
                return {'testName': testName, 'results': ctrl.filteredResultList[testName]};
            });
        };

        ctrl.updateFilteredTestList();
    }
});

treeherder.component('phAverage', {
    templateUrl: 'partials/perf/average.html',
    bindings: {
        value: '@',
        stddev: '@',
        stddevpct: '@',
        replicates: '<'
    }
});

treeherder.component('revisionInformation', {
    templateUrl: 'partials/perf/revisiondescribe.html',
    bindings: {
        originalProject: '<',
        originalRevision: '<',
        newProject: '<',
        newRevision: '<',
        originalResultSet: '<',
        newResultSet: '<'
    }
});

treeherder.component('compareError', {
    templateUrl: 'partials/perf/comparerror.html',
    bindings: {
        errors: '<',
        originalProject: '<',
        originalRevision: '<',
        newProject: '<',
        newRevision: '<'
    }
});
