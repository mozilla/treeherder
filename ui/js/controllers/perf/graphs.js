/* eslint-disable no-use-before-define, no-var, vars-on-top */
// TODO: Vet/fix the use-before-defines to ensure switching var
// to let/const won't break anything.

import $ from 'jquery';
import _ from 'lodash';
import angular from 'angular';
import Mousetrap from 'mousetrap';
import MG from 'metrics-graphics';
import Popper from 'popper.js';

import perf from '../../perf';
import testDataChooserTemplate from '../../../partials/perf/testdatachooser.html';
import {
  thDefaultRepo,
  phTimeRanges,
  phDefaultTimeRangeValue,
  phDefaultFramework,
  thPerformanceBranches,
} from '../../constants';

perf.controller('GraphsCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$uibModal',
    '$window', '$q', '$timeout', 'PhSeries', 'PhAlerts',
    'ThRepositoryModel', 'ThResultSetModel',
    function GraphsCtrl($state, $stateParams, $scope, $rootScope,
        $uibModal, $window, $q, $timeout, PhSeries,
        PhAlerts, ThRepositoryModel, ThResultSetModel) {
        var availableColors = ['maroon', 'navy', 'pink', 'turquoise', 'brown',
            'red', 'green', 'blue', 'orange', 'purple'];

        $scope.highlightedRevisions = [undefined, undefined];
        $scope.highlightAlerts = true;
        $scope.loadingGraphs = false;

        $scope.timeranges = phTimeRanges;

        $scope.timeRangeChanged = null;
        $scope.ttHideTimer = null;
        $scope.selectedDataPoint = null;
        $scope.showToolTipTimeout = null;
        $scope.seriesList = [];

        $scope.createAlert = function (dataPoint) {
            $scope.creatingAlert = true;
            PhAlerts.createAlert(dataPoint).then(function (alertSummaryId) {
                PhAlerts.getAlertSummaries({
                    seriesSignature: dataPoint.series.seriesSignature,
                    repository: dataPoint.project.id,
                }).then(function (alertSummaryData) {
                    $scope.creatingAlert = false;

                    var alertSummary = alertSummaryData.results.find(result =>
                        result.id === alertSummaryId);
                    $scope.tooltipContent.alertSummary = alertSummary;

                    dataPoint.series.relatedAlertSummaries = alertSummaryData.results;
                    plotGraph();
                });
            });
        };

        function getSeriesDataPoint(flotItem) {
            // gets universal elements of a series given a flot item

            // sometimes we have multiple results with the same result id, in
            // which case we need to calculate an offset to it (I guess
            // technically even this is subject to change in the case of
            // retriggers but oh well, hopefully this will work for 99%
            // of cases)
            var resultSetId = flotItem.series.resultSetData[flotItem.dataIndex];
            return {
                projectName: flotItem.series.thSeries.projectName,
                signature: flotItem.series.thSeries.signature,
                signatureId: flotItem.series.thSeries.id,
                frameworkId: flotItem.series.thSeries.frameworkId,
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

        const tip = $('#graph-tooltip');
        $scope._tip = new Popper(document.documentElement, tip, { placement: 'top' });

        function showTooltip(dataPoint, pointIndex) {
            if ($scope.showToolTipTimeout) {
                window.clearTimeout($scope.showToolTipTimeout);
            }

            $scope.showToolTipTimeout = window.setTimeout(function () {
                if ($scope.ttHideTimer) {
                    clearTimeout($scope.ttHideTimer);
                    $scope.ttHideTimer = null;
                }

                var phSeries = $scope.seriesList.find(
                    s => s.id === dataPoint.signatureId);

                // we need the flot data for calculating values/deltas and to know where
                // on the graph to position the tooltip
                var flotIndex = phSeries.flotSeries.idData.indexOf(
                    dataPoint.id);
                var flotData = {
                    series: $scope.seriesList.find(
                        sl => sl.flotSeries.thSeries.id === dataPoint.signatureId).flotSeries,
                    pointIndex: flotIndex,
                };
                // check if there are any points belonging to earlier pushes in this
                // graph -- if so, get the previous push so we can link to a pushlog
                var firstResultSetIndex = phSeries.flotSeries.resultSetData.indexOf(
                    dataPoint.resultSetId);
                var prevResultSetId = (firstResultSetIndex > 0) ?
                    phSeries.flotSeries.resultSetData[firstResultSetIndex - 1] : null;

                var retriggerNum = _.countBy(phSeries.flotSeries.resultSetData,
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
                                repo.name === phSeries.projectName),
                    revisionUrl: `/#/jobs?repo=${phSeries.projectName}`,
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

                // Get revision information for both this datapoint and the previous
                // one
                [{
                    resultSetId: dataPoint.resultSetId,
                    scopeKey: 'revision',
                }, {
                    resultSetId: prevResultSetId,
                    scopeKey: 'prevRevision',
                }].forEach((resultRevision) => {
                    ThResultSetModel.getRevisions(
                        phSeries.projectName, resultRevision.resultSetId,
                    ).then(function (revisions) {
                        $scope.tooltipContent[resultRevision.scopeKey] = revisions[0];
                        if ($scope.tooltipContent.prevRevision && $scope.tooltipContent.revision) {
                            $scope.tooltipContent.pushlogURL = $scope.tooltipContent.project.getPushLogHref({
                                from: $scope.tooltipContent.prevRevision,
                                to: $scope.tooltipContent.revision,
                            });
                        }
                    }, function () {
                        $scope.tooltipContent.revisionInfoAvailable = false;
                    });
                });

                // now position it
                $timeout(function () {
                    var tip = $('#graph-tooltip');
                    tip.css({
                        opacity: 1,
                        visibility: 'visible',
                    });
                    $scope._tip.reference = document.querySelector(`#graph .mg-points .path-${pointIndex}`);
                    $scope._tip.update();
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

        function plotSelected(range) {
            deselectDataPoint();
            hideTooltip();
            if (range.x[0] === range.x[1] && range.y[0] === range.y[1]) {
                $scope.zoom = {};
                $scope.selectedDataPoint = null;
            } else {
                $scope.zoom = { x: $scope.mainPlot.processed.zoom_x, y: $scope.mainPlot.processed.zoom_y };
            }
            updateDocument();
        }

        function plotOverviewGraph() {
            const overviewPlot = {
                target: '#overview-plot',
                data: $scope.seriesList.map((series) => {
                    if (series.visible) return series.flotSeries.data;
                    return [];
                }),
                area: false,
                width: document.getElementById('overview-plot').offsetWidth,
                height: document.getElementById('overview-plot').offsetHeight,
                top: 8,
                bottom: 35,
                left: 35,
                right: 10,
                x_accessor: 0,
                y_accessor: 1,
                min_y_from_data: true,
                colors: $scope.seriesList.map(i => i.color),
                brush: 'xy',
                zoom_target: $scope.mainPlot,
                brushing_selection_changed: (_, range) => plotSelected(range),
                show_rollover_text: false,
            };
            MG.data_graphic(overviewPlot);
        }

        function zoomGraph() {
            if ($scope.zoom && ($scope.zoom.x || $scope.zoom.y)) {
                MG.zoom_to_data_domain($scope.mainPlot, $scope.zoom);
            }
        }

        function plotGraph() {
            // synchronize series visibility with flot, in case it's changed
            $scope.seriesList.forEach(function (series) {
                series.flotSeries.points.show = series.visible;
                series.blockColor = series.visible ? series.color : 'grey';
            });

            // reset highlights
            $scope.seriesList.forEach(function (series) {
                series.highlightedPoints = [];
            });

            // highlight points which correspond to an alert
            var markings = [];
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
                series.highlightedPoints = _.union(
                    series.highlightedPoints,
                    _.map(
                        series.flotSeries.resultSetData,
                        function (seriesResultSetId, index) {
                            return resultSetId === seriesResultSetId ? index : null;
                        }).filter(v => v));
            }

            if ($scope.highlightAlerts) {
                $scope.seriesList.forEach(function (series) {
                    if (series.visible) {
                        series.relatedAlertSummaries.forEach(function (alertSummary) {
                            addHighlightedDatapoint(series, alertSummary.push_id);
                        });
                    }
                });
            }

            // highlight each explicitly highlighted revision on visible serii
            var highlightPromises = [];
            $scope.highlightedRevisions.forEach((rev) => {
                if (rev && rev.length === 12) {
                    highlightPromises = _.union(
                        highlightPromises, $scope.seriesList.map(function (series) {
                            if (series.visible) {
                                return ThResultSetModel.getResultSetsFromRevision(
                                    series.projectName, rev).then(
                                    function (resultSets) {
                                        addHighlightedDatapoint(series, resultSets[0].id);
                                    }, function () {
                                            /* ignore cases where no result set exists
                                           for revision */
                                    });
                            }
                            return null;
                        }));
                }
            });
            $q.all(highlightPromises).then(function () {
                $scope.mainPlot = {
                    target: '#graph',
                    data: _.flatten($scope.seriesList.map((series, seriesIndex) => {
                        if (series.visible) {
                            return series.flotSeries.data.map((i, dataIndex) => ({
                                x: i[0],
                                y: i[1],
                                seriesIndex,
                                dataIndex,
                                highlight: series.highlightedPoints.includes(dataIndex),
                            }));
                        }
                        return [];
                    })),
                    width: document.getElementById('graph').offsetWidth,
                    height: document.getElementById('graph').offsetHeight,
                    chart_type: 'point',
                    x_accessor: 'x',
                    y_accessor: 'y',
                    color_accessor: 'seriesIndex',
                    color_domain: _.range($scope.seriesList.length),
                    color_range: $scope.seriesList.map(i => i.color),
                    color_type: 'category',
                    brush: 'xy',
                    highlight: d => d.highlight,
                    click_to_zoom_out: false,
                    show_rollover_text: false,
                    mouseover: (d, i) => {
                        if ($scope.selectedDataPoint) return;
                        if (d.data.seriesIndex !== $scope.prevSeriesIndex || d.data.dataIndex !== $scope.prevDataIndex) {
                            const item = {
                                series: $scope.seriesList[d.data.seriesIndex].flotSeries,
                                seriesIndex: d.data.seriesIndex,
                                dataIndex: d.data.dataIndex,
                            };
                            const seriesDataPoint = getSeriesDataPoint(item);
                            $scope.prevSeriesIndex = item.seriesIndex;
                            $scope.prevDataIndex = item.dataIndex;
                            showTooltip(seriesDataPoint, i);
                        }
                    },
                    click: (d, i) => {
                        const item = {
                            series: $scope.seriesList[d.data.seriesIndex].flotSeries,
                            seriesIndex: d.data.seriesIndex,
                            dataIndex: d.data.dataIndex,
                        };
                        const seriesDataPoint = getSeriesDataPoint(item);
                        $scope.selectedDataPoint = seriesDataPoint;
                        $scope.prevSeriesIndex = item.seriesIndex;
                        $scope.prevDataIndex = item.dataIndex;
                        showTooltip(seriesDataPoint, i);
                    },
                    brushing_selection_changed: (_, range) => {
                        if (range.x[0] === range.x[1] || range.y[0] === range.y[1]) return;
                        plotSelected(range);
                    },
                };
                MG.data_graphic($scope.mainPlot);
                updateSelectedItem(null);
                plotOverviewGraph();
                zoomGraph();

                function updateSelectedItem() {
                    if (!$scope.selectedDataPoint) {
                        hideTooltip();
                    }
                }

                // Close pop up when user clicks outside of the graph area
                $('html').click(function () {
                    $scope.closePopup();
                });

                // // Stop propagation when user clicks inside the graph area
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
            // TODO:
            $state.transitionTo('graphs', {
                series: $scope.seriesList.map(series => `${series.projectName},${series.id},${series.visible ? 1 : 0},${series.frameworkId}`),
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
            return PhSeries.getSeriesData(series.projectName, { interval: $scope.myTimerange.value,
                signature_id: series.id,
                framework: series.frameworkId,
            }).then(
                function (seriesData) {
                    series.flotSeries = {
                        lines: { show: false },
                        points: { show: series.visible },
                        color: series.color,
                        label: series.projectName + ' ' + series.name,
                        data: _.map(
                            seriesData[series.signature],
                            function (dataPoint) {
                                return [
                                    new Date(dataPoint.push_timestamp * 1000),
                                    dataPoint.value,
                                ];
                            }),
                        resultSetData: _.map(
                            seriesData[series.signature],
                            'push_id'),
                        thSeries: $.extend({}, series),
                        jobIdData: _.map(seriesData[series.signature], 'job_id'),
                        idData: _.map(seriesData[series.signature], 'id'),
                    };
                }).then(function () {
                    series.relatedAlertSummaries = [];
                    var repo = $rootScope.repos.find(repo =>
                        repo.name === series.projectName);
                    return PhAlerts.getAlertSummaries({
                        signatureId: series.id,
                        repository: repo.id }).then(function (data) {
                            series.relatedAlertSummaries = data.results;
                        });
                });
        }

        function addSeriesList(partialSeriesList) {
            $scope.loadingGraphs = true;
            return $q.all(partialSeriesList.map(function (partialSeries) {
                const params = { framework: partialSeries.frameworkId };
                if (partialSeries.id) {
                    params.id = partialSeries.id;
                } else {
                    params.signature = partialSeries.signature;
                }
                return PhSeries.getSeriesList(
                    partialSeries.project, params).then(function (seriesList) {
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
                    });
            }, function (error) {
                alert('Error loading performance signature\n\n' + error);
            })).then(function () {
                $q.all($scope.seriesList.map(getSeriesData)).then(function () {
                    plotGraph();
                    updateDocumentTitle();
                    $scope.loadingGraphs = false;
                    if ($scope.selectedDataPoint) {
                        // showTooltip($scope.selectedDataPoint);
                    }
                });
            }, function (error) {
                if (error.statusText) {
                    error = 'HTTP Error: ' + error.statusText;
                }
                // we could probably do better than print this
                // rather useless error, but at least this gives
                // a hint on what the problem is
                alert('Error loading performance data\n\n' + error);
            });
        }

        $scope.removeSeries = function (projectName, signature) {
            var newSeriesList = [];
            $scope.seriesList.forEach(function (series) {
                if (series.signature !== signature ||
                    series.projectName !== projectName) {
                    newSeriesList.push(series);
                } else {
                    // add the color back to the list of available colors
                    availableColors.push(series.color);

                    // deselect datapoint if no longer valid
                    if ($scope.selectedDataPoint &&
                        $scope.selectedDataPoint.signatureId === series.id) {
                        $scope.selectedDataPoint = null;
                    }
                }
            });
            $scope.seriesList = newSeriesList;

            if ($scope.seriesList.length === 0) {
                $scope.resetHighlight();
                $scope.zoom = {};
            }
            updateDocument();
            plotGraph();
        };

        $scope.showHideSeries = function () {
            updateDocument();
            plotGraph();
        };

        $scope.resetHighlight = function (i) {
            $scope.highlightedRevisions[i] = '';

            // update url
            updateDocument();
            plotGraph();
        };

        $scope.updateHighlightedRevisions = function () {
            updateDocument();
            plotGraph();
        };

        $scope.closePopup = function () {
            $scope.selectedDataPoint = null;
            hideTooltip();
            // highlightDataPoints();
        };

        ThRepositoryModel.load().then(function () {
            if ($stateParams.timerange) {
                var timeRange = phTimeRanges.find(timeRange =>
                    timeRange.value === parseInt($stateParams.timerange));
                $scope.myTimerange = timeRange;
            } else {
                $scope.myTimerange = phTimeRanges.find(timeRange =>
                    timeRange.value === phDefaultTimeRangeValue);
            }
            $scope.timeRangeChanged = function () {
                $scope.loadingGraphs = true;
                $scope.zoom = {};
                deselectDataPoint();

                updateDocument();
                // refetch and re-render all graph data
                $q.all($scope.seriesList.map(getSeriesData)).then(function () {
                    plotGraph();
                    $scope.loadingGraphs = false;
                });
            };

            if ($stateParams.zoom) {
                var zoomString = decodeURIComponent($stateParams.zoom).replace(/[\[\{\}\]"]+/g, '');
                var zoomArray = zoomString.split(',');
                var zoomObject = {
                    x: zoomArray.slice(0, 2),
                    y: zoomArray.slice(2, 4),
                };
                $scope.zoom = (zoomString) ? zoomObject : [];
            } else {
                $scope.zoom = [];
            }

            if ($stateParams.series) {
                $scope.seriesList = [];
                if (_.isString($stateParams.series)) {
                    $stateParams.series = [$stateParams.series];
                }
                if ($stateParams.highlightAlerts) {
                    $scope.highlightAlerts = parseInt($stateParams.highlightAlerts);
                }
                if ($stateParams.highlightedRevisions) {
                    if (typeof ($stateParams.highlightedRevisions) === 'string') {
                        $scope.highlightedRevisions = [$stateParams.highlightedRevisions];
                    } else {
                        $scope.highlightedRevisions = $stateParams.highlightedRevisions;
                    }
                } else {
                    $scope.highlightedRevisions = ['', ''];
                }

                // we only store the signature + project name in the url, we need to
                // fetch everything else from the server
                var partialSeriesList = $stateParams.series.map(function (encodedSeries) {
                    var partialSeriesString = decodeURIComponent(encodedSeries).replace(/[\[\]"]/g, '');
                    var partialSeriesArray = partialSeriesString.split(',');
                    var partialSeriesObject = {
                        project: partialSeriesArray[0],
                        signature: partialSeriesArray[1].length === 40 ? partialSeriesArray[1] : undefined,
                        id: partialSeriesArray[1].length === 40 ? undefined : partialSeriesArray[1],
                        visible: partialSeriesArray[2] !== '0',
                        frameworkId: partialSeriesArray[3],
                    };
                    return partialSeriesObject;
                });
                addSeriesList(partialSeriesList);
            } else {
                $scope.seriesList = [];
                addSeriesList([]);
            }
            if ($stateParams.selected) {
                var tooltipString = decodeURIComponent($stateParams.selected).replace(/[\[\]"]/g, '');
                var tooltipArray = tooltipString.split(',');
                var tooltip = {
                    projectName: tooltipArray[0],
                    signatureId: parseInt(tooltipArray[1]),
                    resultSetId: parseInt(tooltipArray[2]),
                    id: parseInt(tooltipArray[3]),
                    frameworkId: parseInt(tooltipArray[4]) || 1,
                };
                $scope.selectedDataPoint = (tooltipString) ? tooltip : null;
            }

            $scope.addTestData = function (option, seriesSignature) {
                var defaultProjectName;
                var defaultPlatform;
                var defaultFrameworkId;
                var options = {};
                if ($scope.seriesList.length > 0) {
                    var lastSeries = $scope.seriesList.slice(-1)[0];
                    defaultProjectName = lastSeries.projectName;
                    defaultPlatform = lastSeries.platform;
                    defaultFrameworkId = lastSeries.frameworkId;
                }

                if (option !== undefined) {
                    var series = $scope.seriesList.find(series =>
                        series.signature === seriesSignature);
                    options = { option: option, relatedSeries: series };
                }

                var modalInstance = $uibModal.open({
                    template: testDataChooserTemplate,
                    controller: 'TestChooserCtrl',
                    size: 'lg',
                    resolve: {
                        projects: function () {
                            return $rootScope.repos;
                        },
                        timeRange: function () {
                            return $scope.myTimerange.value;
                        },
                        testsDisplayed: function () {
                            return $scope.seriesList;
                        },
                        defaultFrameworkId: function () { return defaultFrameworkId; },
                        defaultProjectName: function () { return defaultProjectName; },
                        defaultPlatform: function () { return defaultPlatform; },
                        options: function () { return options; },
                    },
                });

                modalInstance.result.then(function (seriesList) {
                    $scope.loadingGraphs = true;
                    seriesList.forEach(function (series) {
                        series.hightlightedPoints = [];
                        series.visible = true;
                        series.color = availableColors.pop();
                        $scope.seriesList.push(series);
                    });
                    if (!$scope.highlightedRevision) {
                        $scope.highlightedRevision = '';
                    }
                    if (!$scope.zoom) {
                        $scope.zoom = {};
                    }
                    updateDocument();
                    $q.all($scope.seriesList.map(getSeriesData)).then(function () {
                        plotGraph();
                        $scope.loadingGraphs = false;
                    });
                });
            };
        });

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

perf.controller('TestChooserCtrl', ['$scope', '$uibModalInstance',
    'projects', 'timeRange', 'PhSeries',
    'PhFramework', 'defaultFrameworkId', 'defaultProjectName', 'defaultPlatform',
    '$q', 'testsDisplayed', 'options',
    function ($scope, $uibModalInstance, projects, timeRange,
        PhSeries, PhFramework, defaultFrameworkId, defaultProjectName,
        defaultPlatform, $q, testsDisplayed, options) {
        $scope.timeRange = timeRange;
        $scope.projects = projects;
        $scope.selectedProject = projects.find(project =>
            project.name === defaultProjectName || thDefaultRepo);
        $scope.includeSubtests = false;
        $scope.loadingTestData = false;
        $scope.loadingRelatedSignatures = true;
        var series = [];
        $scope.addTestData = function () {
            if (($scope.testsToAdd.length + testsDisplayed.length) > 6) {
                var a = window.confirm('WARNING: Displaying more than 6 graphs at the same time is not supported in the UI. Do it anyway?');
                if (a === true) {
                    addTestToGraph();
                }
            } else {
                addTestToGraph();
            }
        };

        var addTestToGraph = function () {
            $scope.selectedSeriesList = $scope.testsToAdd;
            $scope.selectedSeriesList.forEach(function (selectedSeries, i) {
                series[i] = { ...selectedSeries };
                series[i].projectName = selectedSeries.projectName;
            });
            $uibModalInstance.close(series);
        };

        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };

        $scope.unselectedTestList = []; // tests in the "tests" list
        $scope.selectedTestSignatures = []; // tests in the "tests" list that have been selected by the user
        $scope.testsToAdd = []; // tests in the "tests to add" list
        $scope.selectedTestsToAdd = []; // tests in the "to add" test list that have been selected by the user

        $scope.unselectTest = function () {
            $scope.selectedTestsToAdd.forEach(function (testValue) {
                // selectedTestsToAdd is stored in JSON format, need to convert
                // it back to an object and get the actual value
                var test = $scope.testsToAdd.find(test =>
                    test.id === JSON.parse(testValue).id);
                // add test back to unselected test list if we're browsing for
                // the current project/platform, otherwise just discard it
                if (test.projectName === $scope.selectedProject.name &&
                    test.platform === $scope.selectedPlatform) {
                    $scope.unselectedTestList.push(test);
                }

                // unconditionally remove it from the current list
                _.remove($scope.testsToAdd, test);
            });
            // resort unselected test list
            $scope.unselectedTestList = _.sortBy($scope.unselectedTestList,
                'name');
        };

        $scope.selectTest = function () {
            $scope.selectedTestSignatures.forEach(function (signature) {
                // Add the selected tests to the selected test list
                $scope.testsToAdd.push({ ...$scope.unselectedTestList.find(
                    test => test.signature === signature),
                });

                // Remove the added tests from the unselected test list
                _.remove($scope.unselectedTestList, { signature: signature });
            });
        };

        var loadingExtraDataPromise = $q.defer();
        var addRelatedPlatforms = function (originalSeries) {
            PhSeries.getSeriesList(
                originalSeries.projectName, {
                    interval: $scope.timeRange,
                    framework: originalSeries.frameworkId,
                }).then((seriesList) => {
                    const filteredSeriesList = seriesList.filter(series =>
                        series.platform !== originalSeries.platform &&
                        series.name === originalSeries.name &&
                        !testsDisplayed.map(test =>
                            (test.projectName === series.projectName &&
                            test.signature === series.signature)).some(x => x),
                    );
                    $scope.testsToAdd = (filteredSeriesList === undefined ? undefined : [...filteredSeriesList]);
                }).then(function () {
                    // resolve the testsToAdd's length after every thing was done
                    // so we don't need timeout here
                    loadingExtraDataPromise.resolve($scope.testsToAdd.length);
                });
        };

        var addRelatedBranches = function (originalSeries) {
            var branchList = [];
            thPerformanceBranches.forEach(function (branch) {
                if (branch !== originalSeries.projectName) {
                    branchList.push($scope.projects.find(project =>
                        project.name === branch));
                }
            });
            // get each project's series data from remote and use promise to
            // ensure each step will be executed after last on has finished
            $q.all(branchList.map(function (project) {
                return PhSeries.getSeriesList(project.name, {
                    interval: $scope.timeRange,
                    signature: originalSeries.signature,
                    framework: originalSeries.frameworkId,
                });
            })).then(function (seriesList) {
                // we get a list of lists because we are getting the results
                // of multiple promises, filter that down to one flat list
                seriesList = seriesList.reduce((a, b) => [...a, ...b], []);

                // filter out tests which are already displayed
                $scope.testsToAdd = seriesList.filter(series =>
                  !testsDisplayed.map(test =>
                    (test.projectName === series.projectName &&
                     test.signature === series.signature)).some(x => x));
            }).then(function () {
                loadingExtraDataPromise.resolve($scope.testsToAdd.length);
            });
        };

        var addRelatedConfigs = function (originalSeries) {
            PhSeries.getSeriesList(
                originalSeries.projectName, {
                    interval: $scope.timeRange,
                    framework: originalSeries.frameworkId,
                }).then(function (seriesList) {
                    const filteredSeriesList = seriesList.filter(series =>
                        series.platform === originalSeries.platform &&
                        series.testName === originalSeries.testName &&
                        series.name !== originalSeries.name,
                    );
                    $scope.testsToAdd = (filteredSeriesList === undefined ? undefined : [...filteredSeriesList]);
                }).then(function () {
                    // resolve the testsToAdd's length after every thing was done
                    // so we don't need timeout here
                    loadingExtraDataPromise.resolve($scope.testsToAdd.length);
                });
        };
        if (options.option !== undefined) {
            $scope.loadingRelatedSignatures = false;
            if (options.option === 'addRelatedPlatform') {
                addRelatedPlatforms(options.relatedSeries);
            } else if (options.option === 'addRelatedBranches') {
                addRelatedBranches(options.relatedSeries);
            } else if (options.option === 'addRelatedConfigs') {
                addRelatedConfigs(options.relatedSeries);
            }
            loadingExtraDataPromise.promise.then(function (length) {
                if (length > 0) {
                    $scope.loadingRelatedSignatures = true;
                } else {
                    window.alert('Oops, no related platforms or branches have been found.');
                }
            });
        }

        PhFramework.getFrameworkList().then(function (frameworkList) {
            $scope.frameworkList = frameworkList;
            if (defaultFrameworkId) {
                $scope.selectedFramework = $scope.frameworkList.find(framework =>
                    framework.id === defaultFrameworkId,
                );
            } else {
                $scope.selectedFramework = $scope.frameworkList.find(framework =>
                    framework.name === phDefaultFramework,
                );
            }
            $scope.updateTestInput = function () {
                $scope.addTestDataDisabled = true;
                $scope.loadingTestData = true;
                $scope.loadingPlatformList = true;
                $scope.platformList = [];
                PhSeries.getPlatformList($scope.selectedProject.name, {
                    interval: $scope.timeRange,
                    framework: $scope.selectedFramework.id }).then(function (platformList) {
                        $scope.platformList = platformList;
                        $scope.platformList.sort();
                        if ($scope.platformList.indexOf(defaultPlatform) !== -1) {
                            $scope.selectedPlatform = defaultPlatform;
                        } else {
                            $scope.selectedPlatform = $scope.platformList[0];
                        }
                        $scope.loadingPlatformList = false;
                        $scope.updateTestSelector();
                    });

                $scope.updateTestSelector = function () {
                    $scope.loadingTestData = true;
                    if ($scope.selectedPlatform) {
                        defaultPlatform = $scope.selectedPlatform;
                    }
                    PhSeries.getSeriesList(
                        $scope.selectedProject.name,
                        { interval: $scope.timeRange,
                            platform: $scope.selectedPlatform,
                            framework: $scope.selectedFramework.id,
                            subtests: $scope.includeSubtests ? 1 : 0 }).then(function (seriesList) {
                                $scope.unselectedTestList = _.sortBy(
                                    seriesList.filter(series => series.platform === $scope.selectedPlatform),
                                    'name',
                                );
                                // filter out tests which are already displayed or are
                                // already selected
                                _.union(testsDisplayed, $scope.testsToAdd).forEach(
                                    function (test) {
                                        _.remove($scope.unselectedTestList, {
                                            projectName: test.projectName,
                                            signature: test.signature });
                                    });
                                $scope.loadingTestData = false;
                                $scope.$apply();
                            });
                };

            };
            $uibModalInstance.updateTestInput = $scope.updateTestInput;
            $scope.updateTestInput();
        });
    }]);
