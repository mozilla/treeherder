/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

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
        window.clearTimeout($scope.showToolTipTimeout)
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
          test: phSeries.name,
          platform: phSeries.platform,
          machine: phSeries.machine || 'mean',
          value: Math.round(v*1000)/1000,
          deltaValue: dv.toFixed(1),
          deltaPercentValue: (100 * dvp).toFixed(1),
          date: $.plot.formatDate(new Date(t), '%a %b %d, %H:%M:%S')
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
        window.clearTimeout($scope.showToolTipTimeout)
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
                                 return series.flotSeries }),
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
                      var resultSetId = resultSets[0].id
                      var j = series.flotSeries.resultSetData.indexOf(resultSetId);
                      var seriesToaddHighlight = _.find(
                        $scope.seriesList, function(sr) {
                          return sr.signature == series.signature });
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
                               function(series) { return series.flotSeries }),
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
    }

    $scope.repoName = $stateParams.projectId;
    
    function updateDocument() {
      $state.transitionTo('graphs', {
        timerange: $scope.myTimerange.value,
        series: $scope.seriesList.map(function(series) {
          return "[" + series.projectName + "," + series.signature + "," + (series.visible ? 1 : 0) + "]"
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
            return modifiedZoom 
          }
          else {
            $scope.zoom = [] 
            return $scope.zoom 
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
                       '/performance-data/0/get_performance_data/' +
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
                           }
                           response.data[0].blob.forEach(function(dataPoint) {
                             var mean = dataPoint.mean;
                             if (mean === undefined)
                               mean = dataPoint.geomean;

                             flotSeries.data.push([
                               new Date(dataPoint.push_timestamp*1000),
                               mean]);
                             flotSeries.resultSetData.push(
                               dataPoint.result_set_id);
                           });
                           flotSeries.data.sort(function(a,b) {
                             return a[0] < b[0]; });
                           series.flotSeries = flotSeries;
                         });
    }

    function addSeriesList(partialSeriesList) {
      var propsHash = {}
      return $q.all(partialSeriesList.map(
        function(partialSeries) {
          return $http.get(thServiceDomain + '/api/project/' +
                           partialSeries.project + '/performance-data/0/' +
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
    }

    $scope.resetHighlight = function(i) {
      $scope.highlightedRevisions[i] = ''
      $scope.updateHighlightedRevisions();
    }

    $scope.updateHighlightedRevisions = function() {
      // update url
      updateDocument();
      plotGraph();
    };

    ThOptionCollectionModel.get_map().then(
      function(_optionCollectionMap) {
        optionCollectionMap = _optionCollectionMap;

        if ($stateParams.zoom) {
          var zoomString = decodeURIComponent($stateParams.zoom).replace(/[\[\{\}\]"]+/g, '')  
          var zoomArray = zoomString.split(",")
          var zoomObject = {
            "x": zoomArray.slice(0,2),
            "y": zoomArray.slice(2,4)
          }
          $scope.zoom = (zoomString) ? zoomObject : []
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
            }
            return partialSeriesObject;
          });    
          addSeriesList(partialSeriesList);
        } else {
          $scope.seriesList = [];
          addSeriesList([]);
        }

        ThRepositoryModel.get_list().then(function(response) {
          $scope.projects = response.data;

          $scope.addTestData = function() {
            var defaultProjectName, defaultPlatform;
            if ($scope.seriesList.length > 0) {
              var lastSeries = $scope.seriesList.slice(-1)[0];
              defaultProjectName = lastSeries.projectName;
              defaultPlatform = lastSeries.platform;
            }

            var modalInstance = $modal.open({
              templateUrl: 'partials/perf/testdatachooser.html',
              controller: 'TestChooserCtrl',
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
                defaultProjectName: function() { return defaultProjectName; },
                defaultPlatform: function() { return defaultPlatform; }
              }
            });

            modalInstance.opened.then(function () {
              window.setTimeout(function () { modalInstance.updateTestInput(); }, 0);
            });

            modalInstance.result.then(function(series) {
              series.highlightedPoints = [];
              series.visible = true;
              series.color = availableColors.pop();

              $scope.seriesList.push(series);
              if( !$scope.highlightedRevision ) {
                $scope.highlightedRevision = '';
              }
              if (!$scope.zoom) {
                $scope.zoom = {};
              }
              updateDocument();
              getSeriesData(series).then(function() {
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
                                            PhSeries, defaultProjectName,
                                            defaultPlatform) {
  $scope.timeRange = timeRange;
  $scope.projects = projects;
  if (defaultProjectName) {
    $scope.selectedProject = _.findWhere(projects, {name: defaultProjectName});
  } else {
    $scope.selectedProject = projects[1];
  }
  $scope.loadingTestData = false;

  var testInputCreated = false;

  $scope.addTestData = function () {
    var series = _.clone($scope.selectedSeries);
    series.projectName = $scope.selectedProject.name;
    $modalInstance.close(series);
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };

  $scope.updateTestInput = function() {
    $scope.addTestDataDisabled = true;
    $scope.loadingTestData = true;
    $scope.platformList = [];

    PhSeries.getAllSeries($scope.selectedProject.name, $scope.timeRange, optionCollectionMap).then(
    function(seriesData) {
      $scope.platformList = seriesData.platformList;
      $scope.platformList.sort();
      $scope.selectedPlatform = defaultPlatform ||
        $scope.platformList[0];

      $scope.updateTestSelector = function() {
        var filteredSeriesList = seriesData.seriesList.filter(
          function(series) {
            return (series.platform === $scope.selectedPlatform);
          }).sort(function(a, b) { return a.name > b.name; });

        var signatures = new Bloodhound({
          datumTokenizer: Bloodhound.tokenizers.obj.whitespace('name'),
          queryTokenizer: Bloodhound.tokenizers.whitespace,
          limit: 100,
          local: filteredSeriesList
        });

        // kicks off the loading/processing of `local` and `prefetch`
        signatures.initialize();

        if (testInputCreated) {
          $('.typeahead').typeahead('destroy');
        }

        $('.typeahead').typeahead(null, {
          name: 'signatures',
          displayKey: 'name',
          source: signatures.ttAdapter(),
          limit: 100
        }).on('typeahead:selected', function(obj, datum) {
          $scope.selectedSeries = datum;
          $scope.addTestDataDisabled = false;
        });
        testInputCreated = true;
      }
      $scope.updateTestSelector();

      $scope.loadingTestData = false;
    });
  };

  $modalInstance.updateTestInput = $scope.updateTestInput;
});
