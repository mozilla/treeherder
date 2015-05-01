/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

perf.controller('CompareChooserCtrl', [
  '$state', '$stateParams', '$scope', 'ThRepositoryModel',
  function CompareChooserCtrl($state, $stateParams, $scope,
                              ThRepositoryModel) {
    ThRepositoryModel.get_list().success(function(projects) {
      $scope.projects = projects;
      $scope.originalProject = $scope.newProject = projects[0];

      $scope.runCompare = function() {
        $state.go('compare', {
          originalProject: $scope.originalProject.name,
          originalRevision: $scope.originalRevision,
          newProject: $scope.newProject.name,
          newRevision: $scope.newRevision });
      };
    });
  }]);

perf.controller('CompareResultsCtrl', [
  '$state', '$stateParams', '$scope', '$rootScope', '$location',
  'thServiceDomain', '$http', '$q', '$timeout', 'PhSeries', 'math',
  'isReverseTest', 'PhCompare',
  function CompareResultsCtrl($state, $stateParams, $scope,
                              $rootScope, $location,
                              thServiceDomain, $http, $q,
                              $timeout, PhSeries, math,
                              isReverseTest, PhCompare) {
    function displayComparison() {
      $scope.testList = [];
      $scope.platformList = [];

      var timeRange = PhCompare.getInterval($scope.originalTimestamp, $scope.newTimestamp);
      var resultSetIds = [$scope.originalResultSetID];

      // Optimization - if old/new branches are the same collect data in one pass
      if ($scope.originalProject == $scope.newProject) {
        resultSetIds = [$scope.originalResultSetID, $scope.newResultSetID];
      }

      PhSeries.getSeriesSummaries($scope.originalProject,
                    timeRange,
                    optionCollectionMap,
                    {e10s: $scope.e10s}).then(
        function(originalSeriesData) {
          $scope.platformList = originalSeriesData.platformList;
          $scope.testList = originalSeriesData.testList;
          return PhCompare.getResultsMap($scope.originalProject,
                               originalSeriesData.seriesList,
                               timeRange,
                               resultSetIds);
        }).then(function(resultMaps) {
          var originalResultsMap = resultMaps[$scope.originalResultSetID];
          var newResultsMap = resultMaps[$scope.newResultSetID];

          // Optimization - we collected all data in a single pass
          if (newResultsMap) {
            $scope.dataLoading = false;
            displayResults(originalResultsMap, newResultsMap);
            return;
          }

          PhSeries.getSeriesSummaries($scope.newProject,
                        timeRange,
                        optionCollectionMap,
                        {e10s: $scope.e10s}).then(
            function(newSeriesData) {
              $scope.platformList = _.union($scope.platformList,
                                            newSeriesData.platformList).sort();
              $scope.testList = _.union($scope.testList,
                                        newSeriesData.testList).sort();
              return PhCompare.getResultsMap($scope.newProject,
                                   newSeriesData.seriesList,
                                   timeRange,
                                   [$scope.newResultSetID]);
            }).then(function(resultMaps) {
              var newResultsMap = resultMaps[$scope.newResultSetID];
              $scope.dataLoading = false;
              displayResults(originalResultsMap, newResultsMap);
            });
        });
    }

    function displayResults(rawResultsMap, newRawResultsMap) {
      $scope.compareResults = {};
      $scope.titles = {};
      window.document.title = "Perfherder Compare Revisions";

      $scope.testList.forEach(function(testName) {
        $scope.titles[testName] = testName.replace('summary ', '');
        $scope.platformList.forEach(function(platform) {
          var oldSig = _.find(Object.keys(rawResultsMap), function (sig) {
            return (rawResultsMap[sig].name == testName && rawResultsMap[sig].platform == platform)});
          var newSig = _.find(Object.keys(newRawResultsMap), function (sig) {
            return (newRawResultsMap[sig].name == testName && newRawResultsMap[sig].platform == platform)});

          var cmap = PhCompare.getCounterMap(testName, rawResultsMap[oldSig], newRawResultsMap[newSig]);

          if (cmap.isEmpty) {
            return;
          }

          var detailsLink = 'perf.html#/comparesubtest?';
          ['originalProject', 'originalRevision', 'newProject', 'newRevision'].forEach(
            function(p) {
              detailsLink += p + "=" + $scope[p] + "&";
            });
          detailsLink += "originalSignature=" + oldSig + "&newSignature=" + newSig;

          cmap.detailsLink = detailsLink;
          cmap.name = platform;
          cmap.hideMinorChanges = $scope.hideMinorChanges;
          if (Object.keys($scope.compareResults).indexOf(testName) < 0)
            $scope.compareResults[testName] = [];
          $scope.compareResults[testName].push(cmap);
        });
      });

      // Remove the tests with no data, report them as well; not needed for subtests
      $scope.testNoResults = _.difference($scope.testList, Object.keys($scope.compareResults))
                              .map(function(name) { return ' ' + name.replace(' summary', '') }).join();
      $scope.testList = Object.keys($scope.compareResults).sort();
    }

    //TODO: duplicated in comparesubtestctrl
    function verifyRevision(project, revision, rsid) {
      var uri = thServiceDomain + '/api/project/' + project +
          '/resultset/?full=false&revision=' +
          revision;

      return $http.get(uri).then(function(response) {
        var results = response.data.results;
        if (results.length > 0) {
          //TODO: this is a bit hacky to pass in 'original' as a text string
          if (rsid == 'original') {
            $scope.originalResultSetID = results[0].id;
            $scope.originalTimestamp = results[0].push_timestamp;
          } else {
            $scope.newResultSetID = results[0].id;
            $scope.newTimestamp = results[0].push_timestamp;
          }
        } else {
          $scope.errors.push("No results found for revision " + revision + " on branch " + project);
        }
      });
    }

    $scope.dataLoading = true;
    var optionCollectionMap = {};
    $scope.getCompareClasses = PhCompare.getCompareClasses;

    $http.get(thServiceDomain + '/api/optioncollectionhash').then(
      function(response) {
        response.data.forEach(function(dict) {
          optionCollectionMap[dict.option_collection_hash] =
            dict.options.map(function(option) {
              return option.name; }).join(" ");
        });
      }).then(function() {
        $scope.errors = PhCompare.validateInput($stateParams.originalProject, $stateParams.newProject,
                                                $stateParams.originalRevision, $stateParams.originalProject);

        if ($scope.errors.length > 0) {
          $scope.dataLoading = false;
          return;
        }

        $stateParams.e10s = Boolean($stateParams.e10s);
        $scope.hideMinorChanges = Boolean($stateParams.hideMinorChanges);
        $scope.originalProject = $stateParams.originalProject;
        $scope.newProject = $stateParams.newProject;
        $scope.newRevision = $stateParams.newRevision;
        $scope.originalRevision = $stateParams.originalRevision;

        verifyRevision($scope.originalProject, $scope.originalRevision, "original").then(function () {
          verifyRevision($scope.newProject, $scope.newRevision, "new").then(function () {
            if ($scope.errors.length > 0) {
              $scope.dataLoading = false;
              return;
            }
            displayComparison();
          });
        });
      });
  }]);

perf.controller('CompareSubtestResultsCtrl', [
  '$state', '$stateParams', '$scope', '$rootScope', '$location',
  'thServiceDomain', '$http', '$q', '$timeout', 'PhSeries', 'math',
  'isReverseTest', 'PhCompare',
  function CompareSubtestResultsCtrl($state, $stateParams, $scope, $rootScope,
                                     $location, thServiceDomain, $http, $q,
                                     $timeout, PhSeries, math,
                                     isReverseTest, PhCompare) {

    //TODO: duplicated from comparectrl
    function verifyRevision(project, revision, rsid) {
      var uri = thServiceDomain + '/api/project/' + project +
          '/resultset/?full=false&revision=' +
          revision;

      return $http.get(uri).then(function(response) {
        var results = response.data.results;
        if (results.length > 0) {

          //TODO: this is a bit hacky to pass in 'original' as a text string
          if (rsid == 'original') {
            $scope.originalResultSetID = results[0].id;
            $scope.originalTimestamp = results[0].push_timestamp;
          } else {
            $scope.newResultSetID = results[0].id;
            $scope.newTimestamp = results[0].push_timestamp;
          }
        } else {
          $scope.errors.push("No results found for revision " + revision + " on branch " + project);
        }
      });
    }

    function displayResults(rawResultsMap, newRawResultsMap, timeRange) {
      $scope.compareResults = {};
      $scope.titles = {};

      var subtestTitle = $scope.platformList[0].split(' ')[0];
      subtestTitle += " " + $scope.testList[0].split(' ')[0];
      window.document.title = subtestTitle + " subtest comparison";

      $scope.testList.forEach(function(testName) {
        $scope.titles[testName] = testName.replace('summary ', '');
        $scope.compareResults[testName] = [];

        $scope.pageList.sort();
        $scope.pageList.forEach(function(page) {
          var mapsigs = [];
          [rawResultsMap, newRawResultsMap].forEach(function(resultsMap) {
            // If no data for a given platform, or test, display N/A in table
            if (resultsMap) {
              var tempsig = _.find(Object.keys(resultsMap), function (sig) {
                return (resultsMap[sig].name == page)});
            } else {
              var tempsig = 'undefined';
              resultsMap = {};
              resultsMap[tempsig] = {};
            }
            mapsigs.push(tempsig);
          });
          var oldSig = mapsigs[0];
          var newSig = mapsigs[1];

          var cmap = PhCompare.getCounterMap(testName, rawResultsMap[oldSig], newRawResultsMap[newSig]);

          //TODO: Can we have >1 highlighted revision?
          var originalSeries = encodeURIComponent(JSON.stringify(
                        { project: $scope.originalProject,
                          signature: oldSig,
                          visible: true}));

          var newSeries = encodeURIComponent(JSON.stringify(
                        { project: $scope.newProject,
                          signature: newSig,
                          visible: true}));

          var detailsLink = thServiceDomain + '/perf.html#/graphs?timerange=' +
              timeRange + '&series=' + newSeries;

          if (oldSig != newSig) {
            detailsLink += '&series=' + originalSeries;
          }
          detailsLink += '&highlightedRevision=' + $scope.newRevision;

          cmap.detailsLink = detailsLink;
          cmap.name = page;
          cmap.hideMinorChanges = $scope.hideMinorChanges;
          $scope.compareResults[testName].push(cmap);
        });
      });
    }

    $scope.dataLoading = true;
    var optionCollectionMap = {};
    $scope.getCompareClasses = PhCompare.getCompareClasses;

    $http.get(thServiceDomain + '/api/optioncollectionhash').then(
      function(response) {
        response.data.forEach(function(dict) {
          optionCollectionMap[dict.option_collection_hash] =
            dict.options.map(function(option) {
              return option.name; }).join(" ");
        });
      }).then(function() {
        $scope.errors = PhCompare.validateInput($stateParams.originalProject, $stateParams.newProject,
                                                $stateParams.originalRevision, $stateParams.newRevision,
                                                $stateParams.originalSignature, $stateParams.newSignature);

        if ($scope.errors.length > 0) {
          $scope.dataLoading = false;
          return;
        }

        $scope.hideMinorChanges = Boolean($stateParams.hideMinorChanges);
        $scope.originalProject = $stateParams.originalProject;
        $scope.newProject = $stateParams.newProject;
        $scope.newRevision = $stateParams.newRevision;
        $scope.originalRevision = $stateParams.originalRevision;
        $scope.originalSignature = $stateParams.originalSignature;
        $scope.newSignature = $stateParams.newSignature;

        verifyRevision($scope.originalProject, $scope.originalRevision, "original").then(function () {
          verifyRevision($scope.newProject, $scope.newRevision, "new").then(function () {
            $scope.pageList = [];

            if ($scope.errors.length > 0) {
              $scope.dataLoading = false;
              return;
            }

            var timeRange = PhCompare.getInterval($scope.originalTimestamp, $scope.newTimestamp);
            var resultSetIds = [$scope.originalResultSetID];

            // Optimization - if old/new branches are the same collect data in one pass
            if ($scope.originalProject == $scope.newProject) {
              resultSetIds = [$scope.originalResultSetID, $scope.newResultSetID];
            }

            PhSeries.getSubtestSummaries($scope.originalProject,
                          timeRange,
                          optionCollectionMap,
                          $scope.originalSignature).then(
              function (originalSeriesData) {
                $scope.testList = originalSeriesData.testList;
                $scope.platformList = originalSeriesData.platformList;
                return PhCompare.getResultsMap($scope.originalProject,
                                     originalSeriesData.seriesList,
                                     timeRange,
                                     resultSetIds);
            }).then(function(seriesMaps) {
                var originalSeriesMap = seriesMaps[$scope.originalResultSetID];
                var newSeriesMap = seriesMaps[$scope.newResultSetID];
                [originalSeriesMap, newSeriesMap].forEach(function (seriesMap) {
                  // If there is no data for a given signature, handle it gracefully
                  if (seriesMap) {
                    Object.keys(seriesMap).forEach(function(series) {
                      if (!_.contains($scope.pageList, seriesMap[series].name)) {
                        $scope.pageList.push(seriesMap[series].name);
                      }
                    });
                  }
                });

                // Optimization- collect all data in a single pass
                if (newSeriesMap) {
                  $scope.dataLoading = false;
                  displayResults(originalSeriesMap, newSeriesMap, timeRange);
                  return;
                }

                PhSeries.getSubtestSummaries($scope.newProject,
                              timeRange,
                              optionCollectionMap,
                              $scope.newSignature).then(
                  function (newSeriesData) {
                    $scope.platformList = _.union($scope.platformList,
                                                  newSeriesData.platformList).sort();
                    $scope.testList = _.union($scope.testList,
                                              newSeriesData.testList).sort();

                    return PhCompare.getResultsMap($scope.newProject,
                                         newSeriesData.seriesList,
                                         timeRange,
                                         [$scope.newResultSetID]);
                }).then(function(newSeriesMaps) {
                  var newSeriesMap = newSeriesMaps[$scope.newResultSetID];
                  // There is a chance that we haven't received data for the given signature/resultSet yet
                  if (newSeriesMap) {
                    Object.keys(newSeriesMap).forEach(function(series) {
                      if (!_.contains($scope.pageList, newSeriesMap[series].name)) {
                        $scope.pageList.push(newSeriesMap[series].name);
                      }
                    });
                  } else {
                    newSeriesMap = {};
                  }
                  $scope.dataLoading = false;
                  displayResults(originalSeriesMap, newSeriesMap, timeRange);
                });
            });
          });
        });
    });
  }]);

