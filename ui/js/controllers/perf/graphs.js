"use strict";

perf.controller('GraphsCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$location', '$uibModal',
    'thServiceDomain', '$http', '$q', '$timeout', 'PhSeries', 'PhAlerts',
    'ThRepositoryModel', 'ThResultSetModel', 'phTimeRanges', 'phDefaultTimeRangeValue',
    function GraphsCtrl($state, $stateParams, $scope, $rootScope, $location,
                        $uibModal, thServiceDomain, $http, $q, $timeout, PhSeries,
                        PhAlerts, ThRepositoryModel, ThResultSetModel,
                        phTimeRanges, phDefaultTimeRangeValue) {
        var availableColors = [ 'red', 'green', 'blue', 'orange', 'purple' ];

        $scope.highlightedRevisions = [ undefined, undefined ];
        $scope.highlightAlerts = true;

        $scope.timeranges = phTimeRanges;

        $scope.timeRangeChanged = null;
        $scope.ttHideTimer = null;
        $scope.selectedDataPoint = null;
        $scope.showToolTipTimeout = null;
        $scope.seriesList = [];

        $scope.createAlert = function(dataPoint) {
            $scope.creatingAlert = true;
            PhAlerts.createAlert(dataPoint).then(function(alertSummaryId) {
                PhAlerts.getAlertSummaries({
                    seriesSignature: dataPoint.series.seriesSignature,
                    repository: dataPoint.project.id
                }).then(function(alertSummaryData) {
                    $scope.creatingAlert = false;

                    var alertSummary = _.find(alertSummaryData.results,
                                              { id: alertSummaryId });
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
                frameworkId: flotItem.series.thSeries.frameworkId,
                resultSetId: resultSetId,
                flotDataOffset: (flotItem.dataIndex -
                                 flotItem.series.resultSetData.indexOf(resultSetId)),
                jobId: flotItem.series.jobIdData[flotItem.dataIndex]
            };
        }

        function deselectDataPoint() {
            $timeout(function() {
                $scope.selectedDataPoint = null;
                hideTooltip();
                updateDocument();
            });
        }

        function showTooltip(dataPoint) {
            if ($scope.showToolTipTimeout){
                window.clearTimeout($scope.showToolTipTimeout);
            }

            $scope.showToolTipTimeout = window.setTimeout(function() {
                if ($scope.ttHideTimer) {
                    clearTimeout($scope.ttHideTimer);
                    $scope.ttHideTimer = null;
                }

                var phSeriesIndex = _.findIndex(
                    $scope.seriesList,
                    function(s) {
                        return s.projectName === dataPoint.projectName &&
                            s.signature === dataPoint.signature;
                    });
                var phSeries = $scope.seriesList[phSeriesIndex];

                // we need the flot data for calculating values/deltas and to know where
                // on the graph to position the tooltip
                var index = phSeries.flotSeries.resultSetData.indexOf(
                    dataPoint.resultSetId);
                var flotData = {
                    series: _.find($scope.plot.getData(), function(fs) {
                        return fs.thSeries.projectName === dataPoint.projectName &&
                            fs.thSeries.signature === dataPoint.signature;
                    }),
                    pointIndex: index
                };
                var prevResultSetId = null;
                if (index > 0) {
                    prevResultSetId = phSeries.flotSeries.resultSetData[index- 1];
                }
                var retriggerNum = _.countBy(phSeries.flotSeries.resultSetData,
                                             function(resultSetId) {
                                                 return resultSetId === dataPoint.resultSetId ? 'retrigger':'original';
                                             });
                var prevFlotDataPointIndex = (flotData.pointIndex - 1);
                var flotSeriesData = flotData.series.data;

                var t = flotSeriesData[flotData.pointIndex][0],
                    v = flotSeriesData[flotData.pointIndex][1],
                    v0 = ((prevFlotDataPointIndex >= 0) ?
                          flotSeriesData[prevFlotDataPointIndex][1] : v),
                    dv = v - v0,
                    dvp = v / v0 - 1;
                var alertSummary = _.find(phSeries.relatedAlertSummaries, function(alertSummary) {
                    return alertSummary.push_id === dataPoint.resultSetId;
                });
                var alert;
                if (alertSummary) {
                    alert = _.find(alertSummary.alerts,
                                   function(alert) {
                                       return alert.series_signature.signature_hash === phSeries.signature;
                                   });
                }
                $scope.tooltipContent = {
                    project: _.findWhere($rootScope.repos,
                                         { name: phSeries.projectName }),
                    revisionUrl: thServiceDomain + '#/jobs?repo=' + phSeries.projectName,
                    prevResultSetId: prevResultSetId,
                    resultSetId: dataPoint.resultSetId,
                    jobId: phSeries.flotSeries.jobIdData[index],
                    series: phSeries,
                    value: Math.round(v*1000)/1000,
                    deltaValue: dv.toFixed(1),
                    deltaPercentValue: (100 * dvp).toFixed(1),
                    date: $.plot.formatDate(new Date(t), '%a %b %d, %H:%M:%S'),
                    retriggers: (retriggerNum['retrigger'] - 1),
                    alertSummary: alertSummary,
                    revisionInfoAvailable: true,
                    alert: alert
                };

                // Get revision information for both this datapoint and the previous
                // one
                _.each([{ resultSetId: dataPoint.resultSetId,
                          scopeKey: 'revision' },
                        { resultSetId: prevResultSetId,
                          scopeKey: 'prevRevision' }],
                       function(resultRevision) {
                           ThResultSetModel.getRevisions(
                               phSeries.projectName, resultRevision.resultSetId).then(
                                   function(revisions) {
                                       $scope.tooltipContent[resultRevision.scopeKey] =
                                           revisions[0];
                                       if ($scope.tooltipContent.prevRevision && $scope.tooltipContent.revision) {
                                           $scope.tooltipContent.pushlogURL = $scope.tooltipContent.project.getPushLogHref({
                                               from: $scope.tooltipContent.prevRevision,
                                               to: $scope.tooltipContent.revision
                                           });
                                       }
                                   }, function() {
                                       $scope.tooltipContent.revisionInfoAvailable = false;
                                   });
                       });

                // now position it
                $timeout(function() {
                    var x = parseInt(flotData.series.xaxis.p2c(t) +
                                     $scope.plot.offset().left);
                    var y = parseInt(flotData.series.yaxis.p2c(v) +
                                     $scope.plot.offset().top);

                    var tip = $('#graph-tooltip');
                    function getTipPosition(tip, x, y, yoffset) {
                        return {
                            left: x - tip.width() / 2,
                            top: y - tip.height() - yoffset
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
                        tip.css({ opacity: 0, visibility: 'visible', left: tipPosition.left,
                                  top: tipPosition.top + 10 });
                        tip.animate({ opacity: 1, left: tipPosition.left,
                                      top: tipPosition.top }, 250);
                    } else {
                        tip.css({ opacity: 1, left: tipPosition.left, top: tipPosition.top });
                    }
                });
            }, 250);
        }

        function hideTooltip(now) {
            var tip = $('#graph-tooltip');
            if ($scope.showToolTipTimeout){
                window.clearTimeout($scope.showToolTipTimeout);
            }

            if (!$scope.ttHideTimer && tip.css('visibility') === 'visible') {
                $scope.ttHideTimer = setTimeout(function() {
                    $scope.ttHideTimer = null;
                    tip.animate({ opacity: 0, top: '+=10' },
                                250, 'linear', function() {
                                    $(this).css({ visibility: 'hidden' });
                                });
                }, now ? 0 : 250);
            }
        }

        Mousetrap.bind('escape', function() {
            deselectDataPoint();
        });

        // Highlight the points persisted in the url
        function highlightDataPoints() {
            $scope.plot.unhighlight();

            // if we have a highlighted revision(s), highlight all points that
            // correspond to that
            $scope.seriesList.forEach(function(series, i) {
                if (series.visible && series.highlightedPoints &&
                    series.highlightedPoints.length) {
                    _.forEach(series.highlightedPoints, function(highlightedPoint) {
                        $scope.plot.highlight(i, highlightedPoint);
                    });
                }
            });

            // also highlighted the selected item (if there is one)
            if ($scope.selectedDataPoint) {
                var selectedSeriesIndex = _.findIndex(
                    $scope.seriesList,
                    function(s) {
                        return s.projectName === $scope.selectedDataPoint.projectName &&
                            s.signature === $scope.selectedDataPoint.signature;
                    });
                var selectedSeries = $scope.seriesList[selectedSeriesIndex];
                var flotDataPoint = selectedSeries.flotSeries.jobIdData.indexOf(
                    $scope.selectedDataPoint.jobId);
                flotDataPoint = flotDataPoint ? flotDataPoint : selectedSeries.flotSeries.resultSetData.indexOf(
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

            $.each($scope.plot.getXAxes(), function(_, axis) {
                var opts = axis.options;
                opts.min = ranges.xaxis.from;
                opts.max = ranges.xaxis.to;
            });
            $.each($scope.plot.getYAxes(), function(_, axis) {
                var opts = axis.options;
                opts.min = ranges.yaxis.from;
                opts.max = ranges.yaxis.to;
            });
            $scope.zoom = {'x': [ranges.xaxis.from, ranges.xaxis.to], 'y': [ranges.yaxis.from, ranges.yaxis.to]};

            $scope.plot.setupGrid();
            $scope.plot.draw();
            updateDocument();
        }

        function plotOverviewGraph() {
            // We want to show lines for series in the overview plot, if they are visible
            $scope.seriesList.forEach(function(series) {
                series.flotSeries.points.show = false;
                series.flotSeries.lines.show = series.visible;
            });

            $scope.overviewPlot = $.plot(
                $("#overview-plot"),
                $scope.seriesList.map(function(series) {
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
                        autoHighlight: false
                    }
                }
            );
            // Reset $scope.seriesList with lines.show = false
            $scope.seriesList.forEach(function(series) {
                series.flotSeries.points.show = series.visible;
                series.flotSeries.lines.show = false;
            });

            $("#overview-plot").bind("plotunselected", plotUnselected);

            $("#overview-plot").bind("plotselected", plotSelected);
        }

        function zoomGraph() {
            // If either x or y exists then there is zoom set in the variable
            if ($scope.zoom['x']) {
                if (_.find($scope.seriesList, function(series) { return series.visible; })) {
                    $.each($scope.plot.getXAxes(), function(_, axis) {
                        var opts = axis.options;
                        opts.min = $scope.zoom['x'][0];
                        opts.max = $scope.zoom['x'][1];
                    });
                    $.each($scope.plot.getYAxes(), function(_, axis) {
                        var opts = axis.options;
                        opts.min = $scope.zoom['y'][0];
                        opts.max = $scope.zoom['y'][1];
                    });
                    $scope.plot.setupGrid();
                    $scope.overviewPlot.setSelection({
                        xaxis: {
                            from: $scope.zoom['x'][0],
                            to: $scope.zoom['x'][1]
                        },
                        yaxis: {
                            from: $scope.zoom['y'][0],
                            to: $scope.zoom['y'][1]
                        }
                    }, true);
                    $scope.overviewPlot.draw();
                    $scope.plot.draw();
                }
            }
        }

        function plotGraph() {
            // synchronize series visibility with flot, in case it's changed
            $scope.seriesList.forEach(function(series) {
                series.flotSeries.points.show = series.visible;
                series.blockColor = series.visible ? series.color : "grey";
            });

            // reset highlights
            $scope.seriesList.forEach(function(series) {
                series.highlightedPoints = [];
            });

            // highlight points which correspond to an alert
            var markings = [];
            function addHighlightedDatapoint(series, resultSetId) {
                // add a vertical line where alerts are, for extra visibility
                var index = series.flotSeries.resultSetData.indexOf(resultSetId);
                if (index !== (-1)) {
                    markings.push({
                        color: "#ddd",
                        lineWidth: 1,
                        xaxis: {
                            from: series.flotSeries.data[index][0],
                            to: series.flotSeries.data[index][0]
                        }
                    });
                }
                // highlight the datapoints too
                series.highlightedPoints = _.union(
                    series.highlightedPoints,
                    _.compact(_.map(
                        series.flotSeries.resultSetData,
                        function(seriesResultSetId, index) {
                            return resultSetId === seriesResultSetId ? index : null;
                        })));
            }

            if ($scope.highlightAlerts) {
                _.forEach($scope.seriesList, function(series) {
                    if (series.visible) {
                        _.forEach(series.relatedAlertSummaries, function(alertSummary) {
                            addHighlightedDatapoint(series, alertSummary.push_id);
                        });
                    }
                });
            }

            // highlight each explicitly highlighted revision on visible serii
            var highlightPromises = [];
            _.each($scope.highlightedRevisions, function(rev) {
                if (rev && rev.length === 12) {
                    highlightPromises = _.union(
                        highlightPromises, $scope.seriesList.map(function(series) {
                            if (series.visible) {
                                return ThResultSetModel.getResultSetsFromRevision(
                                    series.projectName, rev).then(
                                        function(resultSets) {
                                            addHighlightedDatapoint(series, resultSets[0].id);
                                        }, function() {
                                            /* ignore cases where no result set exists
                                               for revision */
                                        });
                            }
                            return null;
                        }));
                }
            });
            $q.all(highlightPromises).then(function() {
                // plot the actual graph
                $scope.plot = $.plot(
                    $("#graph"),
                    $scope.seriesList.map(function(series) {
                        return series.flotSeries;
                    }),
                    {
                        xaxis: { mode: 'time' },
                        series: { shadowSize: 0 },
                        selection: { mode: 'xy', color: '#97c6e5'},
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
                            markings: markings
                        }
                    }
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
                        return;
                    }
                }

                $("#graph").bind("plothover", function (event, pos, item) {
                    // if examining an item, disable this behaviour
                    if ($scope.selectedDataPoint)
                        return;

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

                $('#graph').bind('plotclick', function(e, pos, item) {
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

                $('#graph').bind("plotselected", function(event, ranges) {
                    $scope.plot.clearSelection();
                    plotSelected(event, ranges);
                    zoomGraph();
                });

                // Close pop up when user clicks outside of the graph area
                $('html').click(function() {
                    $scope.closePopup();
                });

                // Stop propagation when user clicks inside the graph area
                $('#graph, #graph-tooltip').click(function(event) {
                    event.stopPropagation();
                });
            });
        }

        $scope.repoName = $stateParams.projectId;

        function updateDocumentTitle() {
            if ($scope.seriesList.length) {
                window.document.title = ($scope.seriesList[0].name + " " +
                                         $scope.seriesList[0].platform +
                                         " (" + $scope.seriesList[0].projectName +
                                         ")");
                if ($scope.seriesList.length > 1)
                    window.document.title += " and others";
            } else {
                window.document.title = $state.current.title;
            }
        }

        function updateDocument() {
            $state.transitionTo('graphs', {
                series: $scope.seriesList.map(function(series) {
                    return "[" + [series.projectName,
                                  series.signature,
                                  (series.visible ? 1 : 0),
                                  series.frameworkId] + "]";
                }),
                timerange: ($scope.myTimerange.value !== phDefaultTimeRangeValue) ?
                    $scope.myTimerange.value : undefined,
                highlightedRevisions: _.filter($scope.highlightedRevisions,
                                               function(highlight) {
                                                   return (highlight &&
                                                           highlight.length >= 12);
                                               }),
                highlightAlerts: !$scope.highlightAlerts ? 0 : undefined,
                zoom: (function() {
                    if ((typeof $scope.zoom.x !== "undefined")
                        && (typeof $scope.zoom.y !== "undefined")
                        && ($scope.zoom.x !== 0 && $scope.zoom.y !== 0)) {
                        var modifiedZoom = ("[" + ($scope.zoom['x'].toString()
                                                   + ',' + $scope.zoom['y'].toString()) + "]").replace(/[\[\{\}\]"]+/g, '');
                        return modifiedZoom;
                    }
                    $scope.zoom = [];
                    return $scope.zoom;
                })(),
                selected: (function() {
                    return ($scope.selectedDataPoint) ? "[" + [$scope.selectedDataPoint.projectName,
                                                               $scope.selectedDataPoint.signature,
                                                               $scope.selectedDataPoint.resultSetId,
                                                               $scope.selectedDataPoint.jobId,
                                                               $scope.selectedDataPoint.frameworkId]
                        + "]" : undefined;
                })()
            }, {
                location: true,
                inherit: true,
                relative: $state.$current,
                notify: false
            });

            updateDocumentTitle();
        }

        function getSeriesData(series) {
            return PhSeries.getSeriesData(series.projectName, { interval: $scope.myTimerange.value,
                                                                signatures: series.signature,
                                                                framework: series.frameworkId
}).then(
                function(seriesData) {
                    series.flotSeries = {
                        lines: { show: false },
                        points: { show: series.visible },
                        color: series.color,
                        label: series.projectName + " " + series.name,
                        data: _.map(
                            seriesData[series.signature],
                            function(dataPoint) {
                                return [
                                    new Date(dataPoint.push_timestamp*1000),
                                    dataPoint.value
                                ];
                            }),
                        resultSetData: _.pluck(
                            seriesData[series.signature],
                            'push_id'),
                        thSeries: jQuery.extend({}, series),
                        jobIdData: _.pluck(seriesData[series.signature],
                                           'job_id')
                    };
                }).then(function() {
                    series.relatedAlertSummaries = [];
                    var repo = _.find($rootScope.repos, { name: series.projectName });
                    return PhAlerts.getAlertSummaries({
                        seriesSignature: series.signature,
                        repository: repo.id }).then(function(data) {
                            series.relatedAlertSummaries = data.results;
                        });
                });
        }

        function addSeriesList(partialSeriesList) {
            return $q.all(partialSeriesList.map(function(partialSeries) {
                return PhSeries.getSeriesList(
                    partialSeries.project, {
                        signature: partialSeries.signature,
                        framework: partialSeries.frameworkId
                    }).then(function(seriesList) {
                        if (!seriesList.length) {
                            return $q.reject("Signature `" + partialSeries.signature +
                                             "` not found for " + partialSeries.project);
                        }
                        var seriesSummary = seriesList[0];
                        seriesSummary.projectName = partialSeries.project;
                        seriesSummary.visible = partialSeries.visible;
                        seriesSummary.color = availableColors.pop();
                        seriesSummary.highlighted = partialSeries.highlighted;
                        $scope.seriesList.push(seriesSummary);
                    });
            }, function(error) {
                alert("Error loading performance signature\n\n" + error);
            })).then(function() {
                $q.all($scope.seriesList.map(getSeriesData)).then(function() {
                    plotGraph();
                    updateDocumentTitle();
                    if ($scope.selectedDataPoint) {
                        showTooltip($scope.selectedDataPoint);
                    }
                });
            }, function(error) {
                if (error.statusText) {
                    error = "HTTP Error: " + error.statusText;
                }
                // we could probably do better than print this
                // rather useless error, but at least this gives
                // a hint on what the problem is
                alert("Error loading performance data\n\n" + error);
            });
        }

        $scope.removeSeries = function(projectName, signature) {
            var newSeriesList = [];
            $scope.seriesList.forEach(function(series) {
                if (series.signature !== signature ||
                    series.projectName !== projectName) {
                    newSeriesList.push(series);
                } else {
                    // add the color back to the list of available colors
                    availableColors.push(series.color);

                    // deselect datapoint if no longer valid
                    if ($scope.selectedDataPoint &&
                        $scope.selectedDataPoint.signature === signature &&
                        $scope.selectedDataPoint.projectName === projectName) {
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
            if ($scope.selectedDataPoint) {
                showTooltip($scope.selectedDataPoint);
            }
        };

        $scope.showHideSeries = function() {
            updateDocument();
            plotGraph();
        };

        $scope.resetHighlight = function(i) {
            $scope.highlightedRevisions[i] = '';

            // update url
            updateDocument();
            plotGraph();
        };

        $scope.updateHighlightedRevisions = function() {
            updateDocument();
            plotGraph();
        };

        $scope.closePopup = function() {
            $scope.selectedDataPoint = null;
            hideTooltip();
            highlightDataPoints();
        };

        ThRepositoryModel.load().then(function() {
            if ($stateParams.timerange) {
                var timeRange = _.find(phTimeRanges,
                                       {'value': parseInt($stateParams.timerange)});
                $scope.myTimerange = timeRange;
            } else {
                $scope.myTimerange = _.find(phTimeRanges,
                                            {'value': phDefaultTimeRangeValue});
            }
            $scope.timeRangeChanged = function() {
                $scope.zoom = {};
                deselectDataPoint();

                updateDocument();
                // refetch and re-render all graph data
                $q.all($scope.seriesList.map(getSeriesData)).then(function() {
                    plotGraph();
                });
            };

            if ($stateParams.zoom) {
                var zoomString = decodeURIComponent($stateParams.zoom).replace(/[\[\{\}\]"]+/g, '');
                var zoomArray = zoomString.split(",");
                var zoomObject = {
                    "x": zoomArray.slice(0,2),
                    "y": zoomArray.slice(2,4)
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
                    if (typeof($stateParams.highlightedRevisions) === 'string') {
                        $scope.highlightedRevisions = [$stateParams.highlightedRevisions];
                    } else {
                        $scope.highlightedRevisions = $stateParams.highlightedRevisions;
                    }
                } else {
                    $scope.highlightedRevisions = ['', ''];
                }

                // we only store the signature + project name in the url, we need to
                // fetch everything else from the server
                var partialSeriesList = $stateParams.series.map(function(encodedSeries) {
                    var partialSeriesString = decodeURIComponent(encodedSeries).replace(/[\[\]"]/g, '');
                    var partialSeriesArray = partialSeriesString.split(",");
                    var partialSeriesObject = {
                        project:  partialSeriesArray[0],
                        signature:  partialSeriesArray[1],
                        visible: (partialSeriesArray[2] === 0) ? false : true,
                        frameworkId: partialSeriesArray[3]
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
                var tooltipArray = tooltipString.split(",");
                var tooltip = {
                    projectName: tooltipArray[0],
                    signature: tooltipArray[1],
                    resultSetId: parseInt(tooltipArray[2]),
                    jobId: parseInt(tooltipArray[3]),
                    frameworkId: parseInt(tooltipArray[4]) || 1
                };
                $scope.selectedDataPoint = (tooltipString) ? tooltip : null;
            }

            $scope.addTestData = function(option, seriesSignature) {
                var defaultProjectName, defaultPlatform, defaultFrameworkId;
                var options = {};
                if ($scope.seriesList.length > 0) {
                    var lastSeries = $scope.seriesList.slice(-1)[0];
                    defaultProjectName = lastSeries.projectName;
                    defaultPlatform = lastSeries.platform;
                    defaultFrameworkId = lastSeries.frameworkId;
                }

                if (option !== undefined) {
                    var series = _.findWhere($scope.seriesList, {"signature": seriesSignature});
                    options = { option: option, relatedSeries: series };
                }

                var modalInstance = $uibModal.open({
                    templateUrl: 'partials/perf/testdatachooser.html',
                    controller: 'TestChooserCtrl',
                    size: 'lg',
                    resolve: {
                        projects: function() {
                            return $rootScope.repos;
                        },
                        timeRange: function() {
                            return $scope.myTimerange.value;
                        },
                        testsDisplayed: function() {
                            return $scope.seriesList;
                        },
                        defaultFrameworkId: function() { return defaultFrameworkId; },
                        defaultProjectName: function() { return defaultProjectName; },
                        defaultPlatform: function() { return defaultPlatform; },
                        options: function() { return options; }
                    }
                });

                modalInstance.result.then(function(seriesList) {
                    seriesList.forEach(function(series) {
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
                    $q.all($scope.seriesList.map(getSeriesData)).then(function() {
                        plotGraph();
                    });
                });
            };
        });
    }]);

perf.filter('testNameContainsWords', function() {
    /**
     Filter a list of test by ensuring that every word in the textFilter is
     present in the test name.
     **/
    return function(tests, textFilter) {
        if (!textFilter) {
            return tests;
        }

        var filters = textFilter.split(/\s+/);
        return _.filter(tests, function(test) {
            return _.every(filters, function(filter) {
                return test.name.toLowerCase().indexOf(filter) !== -1;
            });
        });
    };
});

perf.controller('TestChooserCtrl', function($scope, $uibModalInstance, $http,
                                            projects, timeRange, thServiceDomain,
                                            thDefaultRepo, PhSeries, PhFramework,
                                            defaultFrameworkId, defaultProjectName,
                                            defaultPlatform, $q, testsDisplayed,
                                            options, thPerformanceBranches,
                                            phDefaultFramework) {
    $scope.timeRange = timeRange;
    $scope.projects = projects;
    $scope.selectedProject = _.findWhere(projects, {
        name: defaultProjectName ? defaultProjectName : thDefaultRepo
    });
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
        $scope.selectedSeriesList.forEach(function(selectedSeries, i) {
            series[i] = _.clone(selectedSeries);
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
        $scope.selectedTestsToAdd.forEach(function(testValue) {
            // selectedTestsToAdd is stored in JSON format, need to convert
            // it back to an object and get the actual value
            var test = _.findWhere($scope.testsToAdd, JSON.parse(testValue));

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
        $scope.selectedTestSignatures.forEach(function(signature) {
            // Add the selected tests to the selected test list
            $scope.testsToAdd.push(_.clone(
                _.findWhere($scope.unselectedTestList, { signature: signature })));

            // Remove the added tests from the unselected test list
            _.remove($scope.unselectedTestList, { signature: signature });
        });
    };

    var loadingExtraDataPromise = $q.defer();
    var addRelatedPlatforms = function(originalSeries) {
        PhSeries.getSeriesList(
            originalSeries.projectName, {
                interval: $scope.timeRange,
                framework: originalSeries.frameworkId
            }).then(function(seriesList) {
                $scope.testsToAdd = _.clone(_.filter(seriesList, function(series) {
                    return series.platform !== originalSeries.platform &&
                        series.name === originalSeries.name;
                }));
            }).then(function() {
                // resolve the testsToAdd's length after every thing was done
                // so we don't need timeout here
                loadingExtraDataPromise.resolve($scope.testsToAdd.length);
            });
    };

    var addRelatedBranches = function(originalSeries) {
        var branchList = [];
        thPerformanceBranches.forEach(function (branch) {
            if (branch !== originalSeries.projectName) {
                branchList.push(_.findWhere($scope.projects, {name: branch}));
            }
        });
        // get each project's series data from remote and use promise to
        // ensure each step will be executed after last on has finished
        $q.all(branchList.map(function(project) {
            return PhSeries.getSeriesList(project.name, {
                interval: $scope.timeRange,
                signature: originalSeries.signature,
                framework: originalSeries.frameworkId
            });
        })).then(function(seriesList) {
            // we get a list of lists because we are getting the results
            // of multiple promises, filter that down to one flat list
            seriesList = _.flatten(seriesList);

            // filter out tests which are already displayed
            $scope.testsToAdd = _.filter(seriesList, function(series) {
                return !_.any(testsDisplayed, {
                    projectName: series.projectName,
                    signature: series.signature
                });
            });
        }).then(function () {
            loadingExtraDataPromise.resolve($scope.testsToAdd.length);
        });
    };
    if (options.option !== undefined) {
        $scope.loadingRelatedSignatures = false;
        if (options.option === "addRelatedPlatform") {
            addRelatedPlatforms(options.relatedSeries);
        } else if (options.option === "addRelatedBranches") {
            addRelatedBranches(options.relatedSeries);
        }
        loadingExtraDataPromise.promise.then(function(length){
            if (length > 0) {
                $scope.loadingRelatedSignatures = true;
            } else {
                window.alert("Oops, no related platforms or branches have been found.");
            }
        });
    }

    PhFramework.getFrameworkList().then(function(frameworkList) {
        $scope.frameworkList = frameworkList;
        if (defaultFrameworkId) {
            $scope.selectedFramework = _.findWhere($scope.frameworkList, {
                id: defaultFrameworkId
            });
        } else {
            $scope.selectedFramework = _.findWhere($scope.frameworkList, {
                name: phDefaultFramework
            });
        }
        $scope.updateTestInput = function() {
            $scope.addTestDataDisabled = true;
            $scope.loadingTestData = true;
            $scope.loadingPlatformList = true;
            $scope.platformList = [];
            PhSeries.getPlatformList($scope.selectedProject.name, {
                interval: $scope.timeRange,
                framework: $scope.selectedFramework.id }).then(function(platformList) {
                    $scope.platformList = platformList;
                    $scope.platformList.sort();
                    if (_.contains($scope.platformList, defaultPlatform)) {
                        $scope.selectedPlatform = defaultPlatform;
                    } else {
                        $scope.selectedPlatform = $scope.platformList[0];
                    }
                    $scope.loadingPlatformList = false;
                    $scope.updateTestSelector();
                });

            $scope.updateTestSelector = function() {
                $scope.loadingTestData = true;
                if ($scope.selectedPlatform) {
                    defaultPlatform = $scope.selectedPlatform;
                }
                PhSeries.getSeriesList(
                    $scope.selectedProject.name,
                    { interval: $scope.timeRange, platform: $scope.selectedPlatform,
                      framework: $scope.selectedFramework.id,
                      subtests: $scope.includeSubtests ? 1 : 0 }).then(function(seriesList) {
                          $scope.unselectedTestList = _.sortBy(
                              _.filter(seriesList,
                                       { platform: $scope.selectedPlatform }), 'name');
                          // filter out tests which are already displayed or are
                          // already selected
                          _.forEach(_.union(testsDisplayed, $scope.testsToAdd),
                                    function(test) {
                                        _.remove($scope.unselectedTestList, {
                                            projectName: test.projectName,
                                            signature: test.signature });
                                    });
                          $scope.loadingTestData = false;
                      });
            };

        };
        $uibModalInstance.updateTestInput = $scope.updateTestInput;
        $scope.updateTestInput();
    });
});
