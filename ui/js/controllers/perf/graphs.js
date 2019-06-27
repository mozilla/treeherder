// Remove the eslint-disable when rewriting this file during the React conversion.
/* eslint-disable func-names, no-use-before-define, no-useless-escape, no-var, object-shorthand, prefer-destructuring, prefer-template, radix, vars-on-top */
// TODO: Vet/fix the use-before-defines to ensure switching var
// to let/const won't break anything.

import $ from 'jquery';
// import map from 'lodash/map';
import countBy from 'lodash/countBy';
import angular from 'angular';
import Mousetrap from 'mousetrap';

import perf from '../../perf';
import {
    alertIsOfState,
    createAlert,
    findPushIdNeighbours,
    getAlertStatusText,
    getAlertSummaries,
    getAlertSummaryStatusText,
    nudgeAlert,
} from '../../../perfherder/helpers';
// import testDataChooserTemplate from '../../../partials/perf/testdatachooser.html';
import {
  phTimeRanges,
  phAlertStatusMap,
  phAlertSummaryStatusMap,
  phDefaultTimeRangeValue,
} from '../../../helpers/constants';
import PushModel from '../../../models/push';
import RepositoryModel from '../../../models/repository';
// import PerfSeriesModel from '../../../models/perfSeries';

perf.controller('GraphsCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$uibModal',
    '$window', '$q', '$timeout',
    function GraphsCtrl($state, $stateParams, $scope, $rootScope,
        $uibModal, $window, $q, $timeout) {
        // const availableColors = ['darkseagreen', 'lightseagreen', 'darkslateblue', 'darkgreen', 'steelblue', 'darkorchid', 'blue', 'darkcyan'];
    
        $scope.highlightedRevisions = [undefined, undefined];
        $scope.highlightAlerts = true;
        $scope.loadingGraphs = false;
        $scope.nudgingAlert = false;

        $scope.timeranges = phTimeRanges;

        $scope.timeRangeChanged = null;
        $scope.ttHideTimer = null;
        $scope.selectedDataPoint = null;
        $scope.showToolTipTimeout = null;
        $scope.seriesList = [];
        $scope.zoom = {};
        
        $scope.updateGraphs = function (state) {
            const { testData, highlightAlerts, highlightedRevisions, zoom, selectedDataPoint, timeRange, projects } = state;
            $rootScope.repos = projects;
            $scope.seriesList = testData;            
            $scope.highlightAlerts = highlightAlerts;
            $scope.highlightedRevisions = highlightedRevisions;
            $scope.zoom = zoom;
            $scope.selectedDataPoint = selectedDataPoint;
            $scope.myTimerange = timeRange;
            plotGraph();
        }

        $scope.createAlert = function (dataPoint) {
            $scope.creatingAlert = true;
            createAlert(dataPoint)
            .then(alertSummaryId => refreshGraphData(alertSummaryId, dataPoint))
            .then(() => {
                $scope.creatingAlert = false;
            });
        };
        // TODO remove - this functionality will be enabled later
        $scope.nudgeAlert = (dataPoint, direction) => {
            $scope.nudgingAlert = true;

            const resultSetData = dataPoint.series.flotSeries.resultSetData;
            const towardsDataPoint = findPushIdNeighbours(dataPoint, resultSetData, direction);

            nudgeAlert(dataPoint, towardsDataPoint)
                .then(alertSummaryId => refreshGraphData(alertSummaryId, dataPoint),
                      (error) => {
                          $scope.nudgingAlert = false;
                          alertHttpError(error);
                }).then(() => {
                    deselectDataPoint();
                    $scope.nudgingAlert = false;
                });
        };

        function refreshGraphData(alertSummaryId, dataPoint) {
            return getAlertSummaries({
                signatureId: dataPoint.series.id,
                repository: dataPoint.project.id,
            }).then(function (alertSummaryData) {
                var alertSummary = alertSummaryData.results.find(result =>
                    result.id === alertSummaryId);
                $scope.tooltipContent.alertSummary = alertSummary;

                dataPoint.series.relatedAlertSummaries = alertSummaryData.results;
                plotGraph();
            });
        }

        function getSeriesDataPoint(flotItem) {
            // gets universal elements of a series given a flot item

            // sometimes we have multiple results with the same result id, in
            // which case we need to calculate an offset to it (I guess
            // technically even this is subject to change in the case of
            // retriggers but oh well, hopefully this will work for 99%
            // of cases)
            var resultSetId = flotItem.series.resultSetData[flotItem.dataIndex];
            return {
                projectName: flotItem.series.thSeries.repository_name,
                signature: flotItem.series.thSeries.signature_hash,
                signatureId: flotItem.series.thSeries.signature_id,
                frameworkId: flotItem.series.thSeries.framework_id,
                resultSetId: resultSetId,
                flotDataOffset: (flotItem.dataIndex -
                                 flotItem.series.resultSetData.indexOf(resultSetId)),
                id: flotItem.series.idData[flotItem.dataIndex],
                jobId: flotItem.series.jobIdData[flotItem.dataIndex],
            };
        }

        function deselectDataPoint() {
            $timeout(function () {
                $scope.selectedDataPoint = null;
                hideTooltip();
                updateDocument();
            });
        }

        function showTooltip(dataPoint) {
            if ($scope.showToolTipTimeout) {
                window.clearTimeout($scope.showToolTipTimeout);
            }

            $scope.showToolTipTimeout = window.setTimeout(function () {
                if ($scope.ttHideTimer) {
                    clearTimeout($scope.ttHideTimer);
                    $scope.ttHideTimer = null;
                }

                var phSeries = $scope.seriesList.find(
                    s => s.signature_id === dataPoint.signatureId);

                // we need the flot data for calculating values/deltas and to know where
                // on the graph to position the tooltip
                var flotIndex = phSeries.flotSeries.idData.indexOf(
                    dataPoint.id);
                var flotData = {
                    series: $scope.plot.getData().find(
                        fs => fs.thSeries.signature_id === dataPoint.signatureId),
                    pointIndex: flotIndex,
                };
                // check if there are any points belonging to earlier pushes in this
                // graph -- if so, get the previous push so we can link to a pushlog
                var firstResultSetIndex = phSeries.flotSeries.resultSetData.indexOf(
                    dataPoint.resultSetId);
                var prevResultSetId = (firstResultSetIndex > 0) ?
                    phSeries.flotSeries.resultSetData[firstResultSetIndex - 1] : null;

                var retriggerNum = countBy(phSeries.flotSeries.resultSetData,
                    function (resultSetId) {
                        return resultSetId === dataPoint.resultSetId ? 'retrigger' : 'original';
                    });
                var prevFlotDataPointIndex = (flotData.pointIndex - 1);
                var flotSeriesData = flotData.series.data;

                var t = flotSeriesData[flotData.pointIndex][0];
                var v = flotSeriesData[flotData.pointIndex][1];
                var v0 = (prevFlotDataPointIndex >= 0) ? flotSeriesData[prevFlotDataPointIndex][1] : v;
                var dv = v - v0;
                var dvp = v / v0 - 1;
                var alertSummary = phSeries.relatedAlertSummaries.find(alertSummary =>
                    alertSummary.push_id === dataPoint.resultSetId);
                var alert;
                if (alertSummary) {
                    alert = alertSummary.alerts.find(alert =>
                        alert.series_signature.id === phSeries.id);
                }
                $scope.tooltipContent = {
                    project: $rootScope.repos.find(repo =>
                                repo.name === phSeries.repository_name),
                    revisionUrl: `/#/jobs?repo=${phSeries.repository_name}`,
                    prevResultSetId: prevResultSetId,
                    resultSetId: dataPoint.resultSetId,
                    jobId: dataPoint.jobId,
                    series: phSeries,
                    value: Math.round(v * 1000) / 1000,
                    deltaValue: dv.toFixed(1),
                    deltaPercentValue: (100 * dvp).toFixed(1),
                    date: $.plot.formatDate(new Date(t), '%a %b %d, %H:%M:%S'),
                    retriggers: (retriggerNum.retrigger - 1),
                    alertSummary: alertSummary,
                    revisionInfoAvailable: true,
                    alert: alert,
                };

                // TODO fix RepositoryModel to use getData wrap and use this model
                // to fetch the list in GraphsView
                const repoModel = new RepositoryModel($scope.tooltipContent.project);
                
                // Get revision information for both this datapoint and the previous
                // one
                [{
                    resultSetId: dataPoint.resultSetId,
                    scopeKey: 'revision',
                }, {
                    resultSetId: prevResultSetId,
                    scopeKey: 'prevRevision',
                }].forEach((resultRevision) => {
                    PushModel.get(resultRevision.resultSetId, { repo: phSeries.repository_name })
                      .then(async (resp) => {
                        const push = await resp.json();
                        $scope.tooltipContent[resultRevision.scopeKey] = push.revision;
                        if ($scope.tooltipContent.prevRevision && $scope.tooltipContent.revision) {
                            $scope.tooltipContent.pushlogURL = repoModel.getPushLogRangeHref({
                                fromchange: $scope.tooltipContent.prevRevision,
                                tochange: $scope.tooltipContent.revision,
                            });
                        }
                        $scope.$apply();
                    }, function () {
                        $scope.tooltipContent.revisionInfoAvailable = false;
                    });
                });

                // now position it
                $timeout(function () {
                    var x = parseInt(flotData.series.xaxis.p2c(t) +
                        $scope.plot.offset().left);
                    var y = parseInt(flotData.series.yaxis.p2c(v) +
                        $scope.plot.offset().top);

                    var tip = $('#graph-tooltip');
                    function getTipPosition(tip, x, y, yoffset) {
                        return {
                            left: x - tip.width() / 2,
                            top: y - tip.height() - yoffset,
                        };
                    }

                    tip.stop(true);

                    // first, reposition tooltip (width/height won't be calculated correctly
                    // in all cases otherwise)
                    var tipPosition = getTipPosition(tip, x, y, 10);
                    tip.css({ left: tipPosition.left, top: tipPosition.top });

                    // get new tip position after transform
                    tipPosition = getTipPosition(tip, x, y, 10);
                    if (tip.css('visibility') === 'hidden') {
                        tip.css({
                            opacity: 0,
                            visibility: 'visible',
                            left: tipPosition.left,
                            top: tipPosition.top + 10,
                        });
                        tip.animate({
                            opacity: 1,
                            left: tipPosition.left,
                            top: tipPosition.top,
                        }, 250);
                    } else {
                        tip.css({
                            opacity: 1,
                            left: tipPosition.left,
                            top: tipPosition.top,
                        });
                    }
                });
            }, 250);
        }

        function hideTooltip(now) {
            var tip = $('#graph-tooltip');
            if ($scope.showToolTipTimeout) {
                window.clearTimeout($scope.showToolTipTimeout);
            }

            if (!$scope.ttHideTimer && tip.css('visibility') === 'visible') {
                $scope.ttHideTimer = setTimeout(function () {
                    $scope.ttHideTimer = null;
                    tip.animate({ opacity: 0, top: '+=10' },
                        250, 'linear', function () {
                            $(this).css({ visibility: 'hidden' });
                        });
                }, now ? 0 : 250);
            }
        }

        Mousetrap.bind('escape', function () {
            deselectDataPoint();
        });

        // on window resize, replot the graph
        angular.element($window).bind('resize', () => plotGraph());

        // Highlight the points persisted in the url
        function highlightDataPoints() {
            $scope.plot.unhighlight();

            // if we have a highlighted revision(s), highlight all points that
            // correspond to that
            $scope.seriesList.forEach(function (series, i) {
                if (series.visible && series.highlightedPoints &&
                    series.highlightedPoints.length) {
                    series.highlightedPoints.forEach(function (highlightedPoint) {
                        $scope.plot.highlight(i, highlightedPoint);
                    });
                }
            });

            // also highlighted the selected item (if there is one)
            if ($scope.selectedDataPoint) {
                var selectedSeriesIndex = $scope.seriesList.findIndex(
                    s => s.signature_id === $scope.selectedDataPoint.signatureId);
                var selectedSeries = $scope.seriesList[selectedSeriesIndex];
                var flotDataPoint = selectedSeries.flotSeries.idData.indexOf(
                    $scope.selectedDataPoint.id);
                flotDataPoint = flotDataPoint || selectedSeries.flotSeries.resultSetData.indexOf(
                    $scope.selectedDataPoint.resultSetId);
                $scope.plot.highlight(selectedSeriesIndex, flotDataPoint);
            }
        }

        function plotUnselected() {
            $scope.zoom = {};
            $scope.selectedDataPoint = null;
            hideTooltip();
            updateDocument();
            plotGraph();
        }

        function plotSelected(event, ranges) {
            deselectDataPoint();
            hideTooltip();

            $.each($scope.plot.getXAxes(), function (_, axis) {
                var opts = axis.options;
                opts.min = ranges.xaxis.from;
                opts.max = ranges.xaxis.to;
            });
            $.each($scope.plot.getYAxes(), function (_, axis) {
                var opts = axis.options;
                opts.min = ranges.yaxis.from;
                opts.max = ranges.yaxis.to;
            });
            $scope.zoom = { x: [ranges.xaxis.from, ranges.xaxis.to], y: [ranges.yaxis.from, ranges.yaxis.to] };

            $scope.plot.setupGrid();
            $scope.plot.draw();
            updateDocument();
        }

        function plotOverviewGraph() {
            // We want to show lines for series in the overview plot, if they are visible
            $scope.seriesList.forEach(function (series) {
                series.flotSeries.points.show = false;
                series.flotSeries.lines.show = series.visible;
            });

            $scope.overviewPlot = $.plot(
                $('#overview-plot'),
                $scope.seriesList.map(function (series) {
                    return series.flotSeries;
                }),
                {
                    xaxis: { mode: 'time' },
                    selection: { mode: 'xy', color: '#97c6e5' },
                    series: { shadowSize: 0 },
                    lines: { show: true },
                    points: { show: false },
                    legend: { show: false },
                    grid: {
                        color: '#cdd6df',
                        borderWidth: 2,
                        backgroundColor: '#fff',
                        hoverable: true,
                        clickable: true,
                        autoHighlight: false,
                    },
                },
            );
            // Reset $scope.seriesList with lines.show = false
            $scope.seriesList.forEach(function (series) {
                series.flotSeries.points.show = series.visible;
                series.flotSeries.lines.show = false;
            });

            $('#overview-plot').on('plotunselected', plotUnselected);

            $('#overview-plot').on('plotselected', plotSelected);
        }

        function zoomGraph() {
            // If either x or y exists then there is zoom set in the variable
            if ($scope.zoom.x) {
                if ($scope.seriesList.find(series => series.visible)) {
                    $.each($scope.plot.getXAxes(), function (_, axis) {
                        var opts = axis.options;
                        opts.min = $scope.zoom.x[0];
                        opts.max = $scope.zoom.x[1];
                    });
                    $.each($scope.plot.getYAxes(), function (_, axis) {
                        var opts = axis.options;
                        opts.min = $scope.zoom.y[0];
                        opts.max = $scope.zoom.y[1];
                    });
                    $scope.plot.setupGrid();
                    $scope.overviewPlot.setSelection({
                        xaxis: {
                            from: $scope.zoom.x[0],
                            to: $scope.zoom.x[1],
                        },
                        yaxis: {
                            from: $scope.zoom.y[0],
                            to: $scope.zoom.y[1],
                        },
                    }, true);
                    $scope.overviewPlot.draw();
                    $scope.plot.draw();
                }
            }
        }

        function plotGraph() {
            // synchronize series visibility with flot, in case it's changed
            $scope.seriesList.forEach(function (series) {
                series.flotSeries.points.show = series.visible;
                series.blockColor = series.visible ? series.color : 'grey';
                series.highlightedPoints = [];                
            });

            // highlight points which correspond to an alert
            var markings = [];
            if ($scope.highlightAlerts) {
                $scope.seriesList.forEach(function (series) {
                    if (series.visible) {
                        series.relatedAlertSummaries.forEach(function (alertSummary) {
                            addHighlightedDatapoint(series, alertSummary.push_id);
                        });
                    }
                });
            }
            function addHighlightedDatapoint(series, resultSetId) {
                // add a vertical line where alerts are, for extra visibility
                var index = series.flotSeries.resultSetData.indexOf(resultSetId);
                if (index !== (-1)) {
                    markings.push({
                        color: '#ddd',
                        lineWidth: 1,
                        xaxis: {
                            from: series.flotSeries.data[index][0],
                            to: series.flotSeries.data[index][0],
                        },
                    });
                }
                // highlight the datapoints too
                series.highlightedPoints = [...new Set([
                    ...series.highlightedPoints,
                    ...series.flotSeries.resultSetData.map((seriesResultSetId, index) => (
                        resultSetId === seriesResultSetId ? index : null
                    )).filter(v => v)])];
            }
    
            // highlight each explicitly highlighted revision on visible serii
            var highlightPromises = [];

            $scope.highlightedRevisions.forEach((rev) => {
                if (rev && rev.length === 12) {
                    highlightPromises = [...new Set([
                        ...highlightPromises,
                        ...$scope.seriesList.map(async (series) => {
                            if (series.visible) {
                                const { data, failureStatus } = await PushModel.getList({
                                    repo: series.projectName,
                                    revision: rev,
                                });                                
                                if (!failureStatus && data.results && data.results.length) {
                                    addHighlightedDatapoint(series, data.results[0].id);
                                    $scope.$apply();
                                }
                                // ignore cases where no push exists
                                // for revision
                            }
                            return null;
                        })])];
                }
            });
            $q.all(highlightPromises).then(function () {
                // plot the actual graph
                $scope.plot = $.plot(
                    $('#graph'),
                    $scope.seriesList.map(function (series) {
                        return series.flotSeries;
                    }),
                    {
                        xaxis: { mode: 'time' },
                        series: { shadowSize: 0 },
                        selection: { mode: 'xy', color: '#97c6e5' },
                        lines: { show: false },
                        points: { show: true },
                        legend: { show: false },
                        grid: {
                            color: '#cdd6df',
                            borderWidth: 2,
                            backgroundColor: '#fff',
                            hoverable: true,
                            clickable: true,
                            autoHighlight: false,
                            markings: markings,
                        },
                    },
                );

                updateSelectedItem(null);
                highlightDataPoints();
                plotOverviewGraph();
                zoomGraph();

                if ($scope.selectedDataPoint) {
                    showTooltip($scope.selectedDataPoint);
                }

                function updateSelectedItem() {
                    if (!$scope.selectedDataPoint) {
                        hideTooltip();
                    }
                }

                $('#graph').on('plothover', function (event, pos, item) {
                    // if examining an item, disable this behaviour
                    if ($scope.selectedDataPoint) return;

                    $('#graph').css({ cursor: item ? 'pointer' : '' });

                    if (item && item.series.thSeries) {
                        if (item.seriesIndex !== $scope.prevSeriesIndex ||
                            item.dataIndex !== $scope.prevDataIndex) {
                            var seriesDataPoint = getSeriesDataPoint(item);
                            showTooltip(seriesDataPoint);
                            $scope.prevSeriesIndex = item.seriesIndex;
                            $scope.prevDataIndex = item.dataIndex;
                        }
                    } else {
                        hideTooltip();
                        $scope.prevSeriesIndex = null;
                        $scope.prevDataIndex = null;
                    }
                });

                $('#graph').on('plotclick', function (e, pos, item) {
                    if (item) {
                        $scope.selectedDataPoint = getSeriesDataPoint(item);
                        showTooltip($scope.selectedDataPoint);
                        updateSelectedItem();
                    } else {
                        $scope.selectedDataPoint = null;
                        hideTooltip();
                        $scope.$digest();
                    }
                    updateDocument();
                    highlightDataPoints();
                });

                $('#graph').on('plotselected', function (event, ranges) {
                    $scope.plot.clearSelection();
                    plotSelected(event, ranges);
                    zoomGraph();
                });

                // Close pop up when user clicks outside of the graph area
                $('html').click(function () {
                    $scope.closePopup();
                });

                // Stop propagation when user clicks inside the graph area
                $('#graph, #graph-tooltip').click(function (event) {
                    event.stopPropagation();
                });
            });
        }

        $scope.repoName = $stateParams.projectId;

        function updateDocumentTitle() {
            if ($scope.seriesList.length) {
                window.document.title = ($scope.seriesList[0].name + ' ' +
                    $scope.seriesList[0].platform +
                        ' (' + $scope.seriesList[0].projectName +
                        ')');
                if ($scope.seriesList.length > 1) {
                    window.document.title += ' and others';
                }
            } else {
                window.document.title = $state.current.title;
            }
        }

        function updateDocument() {
            $state.transitionTo('graphs', {
                series: $scope.seriesList.map(series => `${series.repository_name},${series.signature_id},${series.framework_id}`),
                timerange: ($scope.myTimerange.value !== phDefaultTimeRangeValue) ?
                    $scope.myTimerange.value : undefined,
                highlightedRevisions: $scope.highlightedRevisions.filter(highlight => highlight && highlight.length >= 12),
                highlightAlerts: !$scope.highlightAlerts ? 0 : undefined,
                zoom: (function () {
                    if ((typeof $scope.zoom.x !== 'undefined')
                        && (typeof $scope.zoom.y !== 'undefined')
                        && ($scope.zoom.x !== 0 && $scope.zoom.y !== 0)) {
                        var modifiedZoom = ('[' + ($scope.zoom.x.toString()
                                + ',' + $scope.zoom.y.toString()) + ']').replace(/[\[\{\}\]"]+/g, '');
                        return modifiedZoom;
                    }
                    $scope.zoom = [];
                    return $scope.zoom;
                }()),
                selected: (function () {
                    return ($scope.selectedDataPoint) ? [$scope.selectedDataPoint.projectName,
                        $scope.selectedDataPoint.signatureId,
                        $scope.selectedDataPoint.resultSetId,
                        $scope.selectedDataPoint.id,
                        $scope.selectedDataPoint.frameworkId].toString() : undefined;
                }()),
            }, {
                location: true,
                inherit: true,
                relative: $state.$current,
                notify: false,
            });

            updateDocumentTitle();
        }

        function getSeriesData(series) {
            return PerfSeriesModel.getSeriesData(series.projectName, { interval: $scope.myTimerange.value,
                signature_id: series.id,
                framework: series.frameworkId,
            }).then(
                function (seriesData) {
                    series.flotSeries = {
                        lines: { show: false },
                        points: { show: series.visible },
                        color: series.color ? series.color[1] : '#6c757d',
                        label: series.projectName + ' ' + series.name,
                        data: map(
                            seriesData[series.signature],
                            function (dataPoint) {
                                return [
                                    new Date(dataPoint.push_timestamp * 1000),
                                    dataPoint.value,
                                ];
                            }),
                        resultSetData: map(
                            seriesData[series.signature],
                            'push_id'),
                        thSeries: $.extend({}, series),
                        jobIdData: map(seriesData[series.signature], 'job_id'),
                        idData: map(seriesData[series.signature], 'id'),
                    };
                }).then(function () {
                    series.relatedAlertSummaries = [];
                    var repo = $rootScope.repos.find(repo =>
                        repo.name === series.projectName);
                    return getAlertSummaries({
                        signatureId: series.id,
                        repository: repo.id }).then(function (data) {
                            series.relatedAlertSummaries = data.results;
                        });
                });
        }

        function addSeriesList(partialSeriesList) {
            $q.all(partialSeriesList.map(async function (partialSeries) {
                $scope.loadingGraphs = true;                
                const params = { framework: partialSeries.frameworkId };
                if (partialSeries.id) {
                    params.id = partialSeries.id;
                } else {
                    params.signature = partialSeries.signature;
                }
                const { data: seriesList, failureStatus} = await PerfSeriesModel.getSeriesList(
                    partialSeries.project, params);
 
                if (failureStatus) {
                    return alert('Error loading performance signature\n\n' + seriesList);
                }
                if (!seriesList.length) {
                    return $q.reject('Signature `' + partialSeries.signature +
                        '` not found for ' + partialSeries.project);
                }
                var seriesSummary = seriesList[0];
                seriesSummary.projectName = partialSeries.project;
                seriesSummary.visible = partialSeries.visible;
                seriesSummary.color = availableColors.pop();
                seriesSummary.highlighted = partialSeries.highlighted;
                $scope.seriesList.push(seriesSummary);

                $q.all($scope.seriesList.map(getSeriesData)).then(function () {
                    plotGraph();
                    updateDocumentTitle();
                    $scope.loadingGraphs = false;
                    if ($scope.selectedDataPoint) {
                        showTooltip($scope.selectedDataPoint);
                    }
                });
                $scope.seriesList = [...$scope.seriesList];
            }));
        }

        function alertHttpError(error) {
            if (error.statusText) {
                error = 'HTTP Error: ' + error.statusText;
            }

            // we could probably do better than print this
            // rather useless error, but at least this gives
            // a hint on what the problem is
            alert('Error loading performance data\n\n' + error);
        }

        $scope.updateHighlightedRevisions = function () {
            updateDocument();
            plotGraph();
        };

        $scope.closePopup = function () {
            $scope.selectedDataPoint = null;
            hideTooltip();
            highlightDataPoints();
        };

        // Alert functions
        $scope.phAlertStatusMap = phAlertStatusMap;

        $scope.getAlertStatusText = getAlertStatusText;
        $scope.alertIsOfState = alertIsOfState;

        // AlertSummary functions
        $scope.phAlertSummaryStatusMap = phAlertSummaryStatusMap;

        $scope.getAlertSummaryStatusText = getAlertSummaryStatusText;

        RepositoryModel.getList().then((repos) => {
            $rootScope.repos = repos;
        })
    }]);

perf.filter('testNameContainsWords', function () {
    /*
     Filter a list of test by ensuring that every word in the textFilter is
     present in the test name.
     */
    return function (tests, textFilter) {
        if (!textFilter) {
            return tests;
        }

        var filters = textFilter.split(/\s+/);
        return tests.filter(test => filters.every(filter => test.name.toLowerCase().indexOf(filter) !== -1));
    };
});
