"use strict";

perf.controller('GraphsCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$location', '$modal',
    'thServiceDomain', '$http', '$q', '$timeout', 'PhSeries',
    'ThRepositoryModel', 'ThOptionCollectionModel', 'ThResultSetModel',
    'phTimeRanges',
    function GraphsCtrl($state, $stateParams, $scope, $rootScope, $location,
                        $modal, thServiceDomain, $http, $q, $timeout, PhSeries,
                        ThRepositoryModel, ThOptionCollectionModel,
                        ThResultSetModel, phTimeRanges) {

        var availableColors = [ 'red', 'green', 'blue', 'orange', 'purple' ];
        var optionCollectionMap = null;

        $scope.highlightedRevisions = [ undefined, undefined ];
        $scope.timeranges = phTimeRanges;
        $scope.myTimerange = _.find(phTimeRanges, {'value': parseInt($stateParams.timerange)});
        $scope.myMeasure = "mean";
        $scope.ttHideTimer = null;
        $scope.selectedDataPoint = null;
        $scope.showToolTipTimeout = null;
        $scope.seriesList = [];

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
                resultSetId: resultSetId,
                flotDataOffset: (flotItem.dataIndex -
                                 flotItem.series.resultSetData.indexOf(resultSetId))
            };
        }

        function deselectDataPoint() {
            $timeout(function() {
                $scope.selectedDataPoint = null;
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
                        return s.projectName == dataPoint.projectName &&
                            s.signature == dataPoint.signature;
                    });
                var phSeries = $scope.seriesList[phSeriesIndex];

                // we need the flot data for calculating values/deltas and to know where
                // on the graph to position the tooltip
                var flotData = {
                    series: _.find($scope.plot.getData(), function(fs) {
                        return fs.thSeries.projectName == dataPoint.projectName &&
                            fs.thSeries.signature == dataPoint.signature;
                    }),
                    pointIndex: phSeries.flotSeries.resultSetData.indexOf(
                        dataPoint.resultSetId) + dataPoint.flotDataOffset
                };
                var prevResultSetId = _.find(phSeries.flotSeries.resultSetData,
                                             function(resultSetId) {
                                                 return (resultSetId < dataPoint.resultSetId);
                                             });
                var retriggerNum = _.countBy(phSeries.flotSeries.resultSetData,
                                             function(resultSetId) {
                                                 return resultSetId === dataPoint.resultSetId ? 'retrigger':'original';
                                             });
                var prevFlotDataPointIndex = (flotData.pointIndex -
                                              dataPoint.flotDataOffset - 1);
                var flotSeriesData = flotData.series.data;

                var t = flotSeriesData[flotData.pointIndex][0],
                    v = flotSeriesData[flotData.pointIndex][1],
                    v0 = ((prevFlotDataPointIndex >= 0) ?
                          flotSeriesData[prevFlotDataPointIndex][1] : v),
                    dv = v - v0,
                    dvp = v / v0 - 1;

                $scope.tooltipContent = {
                    project: _.findWhere($scope.projects,
                                         { name: phSeries.projectName }),
                    revisionUrl: thServiceDomain + '#/jobs?repo=' + phSeries.projectName,
                    test: phSeries.name,
                    platform: phSeries.platform,
                    machine: phSeries.machine || 'mean',
                    value: Math.round(v*1000)/1000,
                    deltaValue: dv.toFixed(1),
                    deltaPercentValue: (100 * dvp).toFixed(1),
                    date: $.plot.formatDate(new Date(t), '%a %b %d, %H:%M:%S'),
                    retriggers: (retriggerNum['retrigger'] - 1)
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
                                   }, function(error) {
                                       console.log("Failed to get revision: " + error.reason);
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
                    var tipPosition = getTipPosition(tip, x, y, 10);
                    if (tip.css('visibility') == 'hidden') {
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

            if (!$scope.ttHideTimer && tip.css('visibility') == 'visible') {
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
                if (series.visible && series.highlightedPoints.length) {
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
                        return s.projectName == $scope.selectedDataPoint.projectName &&
                            s.signature == $scope.selectedDataPoint.signature;
                    });
                var selectedSeries = $scope.seriesList[selectedSeriesIndex];
                var flotDataPoint = selectedSeries.flotSeries.resultSetData.indexOf(
                    $scope.selectedDataPoint.resultSetId) + $scope.selectedDataPoint.flotDataOffset;
                $scope.plot.highlight(selectedSeriesIndex, flotDataPoint);
            }
        }

        function plotOverviewGraph() {
            // We want to show lines for series in the overview plot, if they are visible
            $scope.seriesList.forEach(function(series) {
                series.flotSeries.points.show = false;
                series.flotSeries.lines.show = series.visible;
            });

            $scope.overviewPlot = $.plot($("#overview-plot"),
                                         $scope.seriesList.map(
                                             function(series) {
                                                 return series.flotSeries; }),
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
                                         });
            // Reset $scope.seriesList with lines.show = false
            $scope.seriesList.forEach(function(series) {
                series.flotSeries.points.show = series.visible;
                series.flotSeries.lines.show = false;
            });

            $("#overview-plot").bind("plotunselected", function() {
                $scope.zoom = {};
                $scope.selectedDataPoint = null;
                hideTooltip();
                updateDocument();
                plotGraph();
            });

            $("#overview-plot").bind("plotselected", function (event, ranges) {
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
            });
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
                    });
                    $scope.overviewPlot.draw();
                    $scope.plot.draw();
                }
            }
        }

        function plotGraph() {
            // synchronize series visibility with flot, in case it's changed
            $scope.seriesList.forEach(function(series) {
                series.flotSeries.points.show = series.visible;
                series.active = (!series.subtestSignatures || $scope.myMeasure === 'mean');
                series.blockColor = series.active ? series.color : "grey";
            });

            // reset highlights
            $scope.seriesList.forEach(function(series) {
                series.highlightedPoints = [];
            });

            // highlight each revision on visible serii
            var highlightPromises = [];
            _.each($scope.highlightedRevisions, function(rev) {
                if (rev && rev.length == 12) {
                    highlightPromises = _.union(
                        highlightPromises, $scope.seriesList.map(function(series) {
                            if (series.visible) {
                                return ThResultSetModel.getResultSetsFromRevision(
                                    series.projectName, rev).then(
                                        function(resultSets) {
                                            var resultSetId = resultSets[0].id;
                                            var j = series.flotSeries.resultSetData.indexOf(resultSetId);
                                            var seriesToaddHighlight = _.find(
                                                $scope.seriesList, function(sr) {
                                                    return sr.signature == series.signature;
                                                });
                                            seriesToaddHighlight.highlightedPoints.push(j);
                                        });
                            }
                            return null;
                        }));
                }
            });

            $q.all(highlightPromises).then(function() {
                // plot the actual graph
                $scope.plot = $.plot($("#graph"),
                                     $scope.seriesList.map(
                                         function(series) { return series.flotSeries; }),
                                     {
                                         xaxis: { mode: 'time' },
                                         series: { shadowSize: 0 },
                                         lines: { show: false },
                                         points: { show: true },
                                         legend: { show: false },
                                         grid: {
                                             color: '#cdd6df',
                                             borderWidth: 2,
                                             backgroundColor: '#fff',
                                             hoverable: true,
                                             clickable: true,
                                             autoHighlight: false
                                         }
                                     });

                updateSelectedItem(null);
                highlightDataPoints();
                plotOverviewGraph();
                zoomGraph();

                function getDateStr(timestamp) {
                    var date = new Date(parseInt(timestamp));
                    return date.toUTCString();
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

                    $('#graph').css({ cursor: item ? 'pointer' : 'default' });

                    if (item && item.series.thSeries) {
                        if (item.seriesIndex != $scope.prevSeriesIndex ||
                            item.dataIndex != $scope.prevDataIndex) {
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

                    highlightDataPoints();
                });
            });
        }

        if (!$scope.myTimerange) {
            // 7 days is a sensible default
            $scope.myTimerange = $scope.timeranges[1];
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

        $scope.myMeasureChanged = function() {
            $scope.zoom = {};
            deselectDataPoint();

            updateDocument();
            $q.all($scope.seriesList.map(getSeriesData)).then(function() {
                plotGraph();
            });
        };

        $scope.repoName = $stateParams.projectId;

        function updateDocument() {
            $state.transitionTo('graphs', {
                timerange: $scope.myTimerange.value,
                series: $scope.seriesList.map(function(series) {
                    return "[" + series.projectName + "," + series.signature + "," + (series.visible ? 1 : 0) + "]";
                }),
                highlightedRevisions: _.filter($scope.highlightedRevisions,
                                               function(highlight) {
                                                   return (highlight &&
                                                           highlight.length == 12);
                                               }),
                zoom: (function() {
                    if ((typeof $scope.zoom.x != "undefined")
                        && (typeof $scope.zoom.y != "undefined")
                        && ($scope.zoom.x != 0 && $scope.zoom.y != 0)) {
                        var modifiedZoom = ("[" + ($scope.zoom['x'].toString()
                                                   + ',' + $scope.zoom['y'].toString()) + "]").replace(/[\[\{\}\]"]+/g, '');
                        return modifiedZoom;
                    }
                    else {
                        $scope.zoom = [];
                        return $scope.zoom;
                    }
                })(),
            }, {location: true, inherit: true,
                relative: $state.$current,
                notify: false});
            if ($scope.seriesList.length) {
                window.document.title = ($scope.seriesList[0].name + " " +
                                         $scope.seriesList[0].platform +
                                         " (" + $scope.seriesList[0].projectName +
                                         ")");
                if ($scope.seriesList.length > 1)
                    window.document.title += " and others";
            } else {
                window.document.title = "Perfherder Graphs";
            }
        }

        function getSeriesData(series) {
            return $http.get(thServiceDomain + '/api/project/' +
                             series.projectName +
                             '/performance-data/get_performance_data/' +
                             '?interval_seconds=' + $scope.myTimerange.value +
                             '&signatures=' + series.signature).then(
                                 function(response) {
                                     var flotSeries = {
                                         lines: { show: false },
                                         points: { show: series.visible },
                                         color: series.color,
                                         label: series.projectName + " " + series.name,
                                         data: [],
                                         resultSetData: [],
                                         thSeries: jQuery.extend({}, series)
                                     };
                                     response.data[0].blob.forEach(function(dataPoint) {
                                         var measure = dataPoint.mean;
                                         if ($scope.myMeasure === "min") {
                                             measure = dataPoint.min;
                                         } else if ($scope.myMeasure === "max") {
                                             measure = dataPoint.max;
                                         } else if ($scope.myMeasure === "median") {
                                             measure = dataPoint.median;
                                         } else if ($scope.myMeasure === "mean") {
                                             measure = dataPoint.mean;
                                             if (measure === undefined) {
                                                 measure = dataPoint.geomean;
                                             }
                                         }
                                         flotSeries.data.push([
                                             new Date(dataPoint.push_timestamp*1000),
                                             measure]);
                                         flotSeries.resultSetData.push(
                                             dataPoint.result_set_id);
                                     });
                                     flotSeries.data.sort(function(a,b) {
                                         return a[0] > b[0]; });
                                     series.flotSeries = flotSeries;
                                 });
        }

        function addSeriesList(partialSeriesList) {
            var propsHash = {};
            return $q.all(partialSeriesList.map(
                function(partialSeries) {
                    return $http.get(thServiceDomain + '/api/project/' +
                                     partialSeries.project + '/performance-data/' +
                                     'get_signature_properties/?signatures=' +
                                     partialSeries.signature).then(function(response) {
                                         var data = response.data;
                                         if (!propsHash[partialSeries.project]) {
                                             propsHash[partialSeries.project] = {};
                                         }
                                         propsHash[partialSeries.project][partialSeries.signature] = data[0];
                                     });
                })).then(function() {
                    // create a new seriesList in the correct order
                    partialSeriesList.forEach(function(partialSeries) {
                        var seriesSummary = PhSeries.getSeriesSummary(
                            partialSeries.project,
                            partialSeries.signature,
                            propsHash[partialSeries.project][partialSeries.signature],
                            optionCollectionMap);
                        seriesSummary.projectName = partialSeries.project;
                        seriesSummary.visible = partialSeries.visible;
                        seriesSummary.color = availableColors.pop();
                        seriesSummary.highlighted = partialSeries.highlighted;
                        $scope.seriesList.push(seriesSummary);
                    });
                    $q.all($scope.seriesList.map(getSeriesData)).then(function() {
                        plotGraph();
                        if ($scope.selectedDataPoint) {
                            showTooltip($scope.selectedDataPoint);
                        }
                    });
                });
        };

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

            if ($scope.seriesList.length == 0) {
                $scope.resetHighlight();
                $scope.zoom = {};
            }
            updateDocument();
            plotGraph();
            if ($scope.selectedDataPoint) {
                showTooltip($scope.selectedDataPoint);
            }
        };

        $scope.showHideSeries = function(signature) {
            updateDocument();
            plotGraph();
        };

        $scope.resetHighlight = function(i) {
            $scope.highlightedRevisions[i] = '';
            $scope.updateHighlightedRevisions();
        };

        $scope.updateHighlightedRevisions = function() {
            // update url
            updateDocument();
            plotGraph();
        };

        ThOptionCollectionModel.get_map().then(
            function(_optionCollectionMap) {
                optionCollectionMap = _optionCollectionMap;

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
                            "project":  partialSeriesArray[0],
                            "signature":  partialSeriesArray[1],
                            "visible": (partialSeriesArray[2] == 0) ? false : true
                        };
                        return partialSeriesObject;
                    });
                    addSeriesList(partialSeriesList);
                } else {
                    $scope.seriesList = [];
                    addSeriesList([]);
                }

                ThRepositoryModel.get_list().then(function(response) {

                    $scope.projects = response.data;
                    $scope.addTestData = function(option, seriesSignature) {
                        var defaultProjectName, defaultPlatform;
                        var options = {};
                        if ($scope.seriesList.length > 0) {
                            var lastSeries = $scope.seriesList.slice(-1)[0];
                            defaultProjectName = lastSeries.projectName;
                            defaultPlatform = lastSeries.platform;
                        }

                        if (option !== undefined) {
                            var series = _.findWhere($scope.seriesList, {"signature": seriesSignature});
                            options = { option: option, relatedSeries: series };
                        }

                        var modalInstance = $modal.open({
                            templateUrl: 'partials/perf/testdatachooser.html',
                            controller: 'TestChooserCtrl',
                            size: 'lg',
                            resolve: {
                                projects: function() {
                                    return $scope.projects;
                                },
                                optionCollectionMap: function() {
                                    return optionCollectionMap;
                                },
                                timeRange: function() {
                                    return $scope.myTimerange.value;
                                },
                                testsDisplayed: function() {
                                    return $scope.seriesList;
                                },
                                defaultProjectName: function() { return defaultProjectName; },
                                defaultPlatform: function() { return defaultPlatform; },
                                options: function() { return options; }
                            }
                        });

                        modalInstance.opened.then(function () {
                            window.setTimeout(function () { modalInstance.updateTestInput(); }, 0);
                        });

                        modalInstance.result.then(function(seriesList) {
                            seriesList.forEach(function(series)  {
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
            });
    }]);

perf.controller('TestChooserCtrl', function($scope, $modalInstance, $http,
                                            projects, optionCollectionMap,
                                            timeRange, thServiceDomain,
                                            thDefaultRepo, PhSeries,
                                            defaultProjectName, defaultPlatform, $q,
                                            testsDisplayed, options, thPerformanceBranches) {
    $scope.timeRange = timeRange;
    $scope.projects = projects;
    $scope.selectedProject = _.findWhere(projects, {
        name: defaultProjectName ? defaultProjectName : thDefaultRepo
    });
    $scope.loadingTestData = false;
    $scope.loadingRelatedSignatures = true;
    var series = [];
    $scope.addTestData = function () {
        if (($scope.testsToAdd.length + testsDisplayed.length) > 6) {
            var a = window.confirm('WARNING: Displaying more than 6 graphs at the same time is not supported in the UI. Do it anyway?');
            if (a == true) {
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
        $modalInstance.close(series);
    };

    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
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
                test.platform == $scope.selectedPlatform) {
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
    var addRelatedPlatforms = function(relatedSeries) {
        PhSeries.getAllSeries(relatedSeries.projectName,
            $scope.timeRange, optionCollectionMap).then(
            function(seriesData) {
                var platformList = seriesData.platformList;
                platformList.forEach(function(platform) {
                    // query all the tests with specific platform, then find
                    // out the test which has same with the existed test
                    var testList = _.sortBy(_.filter(seriesData.seriesList,
                        { platform: platform }), 'name');
                    var temp = _.findWhere(testList, {"name": relatedSeries.name});
                    // if found something different from the series we already have,
                    // then we push it into the testsToAdd list.
                    if (temp !== undefined && temp.signature !== relatedSeries.signature) {
                        $scope.testsToAdd.push(_.clone(temp));
                    }
                });
            }
        ).then(function() {
                // resolve the testsToAdd's length after every thing was done
                // so we don't need timeout here
                loadingExtraDataPromise.resolve($scope.testsToAdd.length);
            });
    };

    var addRelatedBranches = function(relatedSeries) {
        var branchList = [];
        thPerformanceBranches.forEach(function (branch) {
            if (branch !== relatedSeries.projectName) {
                branchList.push(_.findWhere($scope.projects, {name: branch}));
            }
        });
        // get each project's series data from remote and use promise to
        // ensure each step will be executed after last on has finished
        $q.all(branchList.map(function (project) {
            return PhSeries.getAllSeries(project.name,
                $scope.timeRange, optionCollectionMap);
        })).then(function (seriesList) {
            seriesList.forEach(function (series) {
                var testList = _.sortBy(_.filter(series.seriesList,
                    {platform: relatedSeries.platform}), 'name');
                var temp = _.findWhere(testList, {"name": relatedSeries.name});
                $scope.testsToAdd.push(_.clone(temp));
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

    $scope.updateTestInput = function() {
        $scope.addTestDataDisabled = true;
        $scope.loadingTestData = true;
        $scope.loadingPlatformList = true;
        $scope.platformList = [];

        PhSeries.getPlatformList($scope.selectedProject.name,
            $scope.timeRange).then(function(platformList) {
                $scope.platformList = platformList.platformList;
                $scope.platformList.sort();
                $scope.selectedPlatform = $scope.platformList[0];
                $scope.loadingPlatformList = false;
                $scope.updateTestSelector();
            });

        $scope.updateTestSelector = function() {
            $scope.loadingTestData = true;
            PhSeries.getSeriesByPlatform($scope.selectedProject.name,
                $scope.timeRange, $scope.selectedPlatform, optionCollectionMap).then(
                function(seriesData) {
                    $scope.unselectedTestList = _.sortBy(
                        _.filter(seriesData.seriesList,
                            { platform: $scope.selectedPlatform }), 'name');
                }
            );
            // filter out tests which are already displayed or are
            // already selected
            _.forEach(_.union(testsDisplayed, $scope.testsToAdd),
                function(test) {
                    _.remove($scope.unselectedTestList, {
                        projectName: test.projectName,
                        signature: test.signature });
                });
            $scope.loadingTestData = false;
        };

    };

    $modalInstance.updateTestInput = $scope.updateTestInput;
});
