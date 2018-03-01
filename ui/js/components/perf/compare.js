import treeherder from '../../treeherder';
import trendTableTemplate from '../../../partials/perf/trendtable.html';
import compareTableTemplate from '../../../partials/perf/comparetable.html';
import averageTemplate from '../../../partials/perf/average.html';
import revisionDescribeTemplate from '../../../partials/perf/revisiondescribe.html';
import compareErrorTemplate from '../../../partials/perf/comparerror.html';

treeherder.component('phCompareTable', {
    template: ['$attrs', function ($attrs) {
        if ($attrs.type === 'trend') {
            return trendTableTemplate;
        }
        return compareTableTemplate;
    }],
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
    controller: ['$attrs', function ($attrs) {
        // TODO: Use $onInit() so the legacy preAssignBindingsEnabled pref
        // doesn't have to be enabled in perfapp.js
        var ctrl = this;

        if (!ctrl.baseTitle) {
            ctrl.baseTitle = "Base";
        }
        if (!ctrl.newTitle) {
            ctrl.newTitle = "New";
        }
        ctrl.getCompareClasses = function (cr, type) {
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
                (!ctrl.filterOptions.showOnlyBlockers || result.isBlocker) &&
                (!ctrl.filterOptions.showOnlyNoise || result.isNoiseMetric);
        }
        function filterResult(results, key) {
            if (_.isUndefined(ctrl.filterOptions.filter)) {
                return results;
            }
            return results.filter((result) => {
                var testCondition = `${key} ${($attrs.type === 'trend') ? result.trendResult.name : result.name}`;
                return _.every(ctrl.filterOptions.filter.split(' '), function (matchText) {
                    if ($attrs.type === 'trend') {
                        return filter(testCondition, matchText) && shouldBeShown(result.trendResult);
                    }
                    return filter(testCondition, matchText) && shouldBeShown(result);
                });
            });
        }

        ctrl.updateFilteredTestList = function () {
            ctrl.filteredResultList = {};
            _.forEach(ctrl.compareResults, function (result, key) {
                var compareResults = filterResult(result, key);
                if (compareResults.length > 0) {
                    ctrl.filteredResultList[key] = compareResults;
                }
            });
            ctrl.filteredResultList = _.map(_.keys(ctrl.filteredResultList), function (testName) {
                return { testName: testName, results: ctrl.filteredResultList[testName] };
            });
        };

        ctrl.updateFilteredTestList();
    }]
});

treeherder.component('phAverage', {
    template: averageTemplate,
    bindings: {
        value: '@',
        stddev: '@',
        stddevpct: '@',
        replicates: '<'
    }
});

treeherder.component('revisionInformation', {
    template: revisionDescribeTemplate,
    bindings: {
        originalProject: '<',
        originalRevision: '<',
        newProject: '<',
        newRevision: '<',
        originalResultSet: '<',
        newResultSet: '<',
        selectedTimeRange: '<'
    }
});

treeherder.component('compareError', {
    template: compareErrorTemplate,
    bindings: {
        errors: '<',
        originalProject: '<',
        originalRevision: '<',
        newProject: '<',
        newRevision: '<'
    }
});

treeherder.component('distributionGraph', {
    template: `
        <table class="tooltip-table">
            <tr>
                <td class="value-column">{{$ctrl.minValue|abbreviatedNumber}}</td>
                <td class="distribution-column"><canvas id="distribution-graph-new" width="190" height="30"></canvas></td>
                <td class="value-column">{{$ctrl.maxValue|abbreviatedNumber}}</td>
            </tr>
        </table>`,
    bindings: {
        replicates: '<'
    },
    controller: [function () {
        let ctrl = this;
        let cvs = document.getElementById("distribution-graph-new");
        let ctx = cvs.getContext("2d");
        cvs.setAttribute("id", "distribution-graph-current");
        ctrl.maxValue = Math.max.apply(null, ctrl.replicates);
        ctrl.minValue = Math.min.apply(null, ctrl.replicates);
        if (ctrl.maxValue - ctrl.minValue > 1) {
            ctrl.maxValue = Math.ceil(ctrl.maxValue*1.001);
            ctrl.minValue = Math.floor(ctrl.minValue/1.001);
        }
        ctx.globalAlpha = 0.3;
        ctrl.replicates.forEach((value) => {
            ctx.beginPath();
            ctx.arc(180/(ctrl.maxValue - ctrl.minValue)*(value - ctrl.minValue) + 5, 18, 5, 0, 360);
            ctx.fillStyle = 'white';
            ctx.fill();
        });
    }]
});
