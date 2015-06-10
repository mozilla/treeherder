/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

perf.controller('CompareChooserCtrl', [
  '$state', '$stateParams', '$scope', 'ThRepositoryModel', 'ThResultSetModel',
  function CompareChooserCtrl($state, $stateParams, $scope,
                              ThRepositoryModel, ThResultSetModel) {
    ThRepositoryModel.get_list().success(function(projects) {
      $scope.projects = projects;
      $scope.originalProject = $scope.newProject = projects[1];

      $scope.runCompare = function() {
        ThResultSetModel.getResultSetsFromRevision($scope.originalProject.name, $scope.originalRevision).then(
          function(resultSets) {
            $scope.originalRevisionError = undefined;

        }, function(error) {
            $scope.originalRevisionError = error;
        });
        
        ThResultSetModel.getResultSetsFromRevision($scope.newProject.name, $scope.newRevision).then(
              function(resultSets) {
               $scope.newRevisionError = undefined;
               if($scope.originalRevisionError == undefined && $scope.newRevisionError == undefined) {
                $state.go('compare', {
                originalProject: $scope.originalProject.name,
                originalRevision: $scope.originalRevision,
                newProject: $scope.newProject.name,
                newRevision: $scope.newRevision });        
                }
        }, function(error) {
                $scope.newRevisionError = error;
        });
      };
    });
  }]);

perf.controller('CompareResultsCtrl', [
  '$state', '$stateParams', '$scope', '$rootScope', '$location',
  'thServiceDomain', 'ThOptionCollectionModel', 'ThRepositoryModel',
  'ThResultSetModel', '$http', '$q', '$timeout', 'PhSeries', 'math',
  'isReverseTest', 'PhCompare',
  function CompareResultsCtrl($state, $stateParams, $scope,
                              $rootScope, $location,
                              thServiceDomain, ThOptionCollectionModel,
                              ThRepositoryModel, ThResultSetModel, $http,
                              $q, $timeout, PhSeries, math, isReverseTest,
                              PhCompare) {
    function displayComparison() {
      $scope.testList = [];
      $scope.platformList = [];

      var timeRange = PhCompare.getInterval($scope.originalTimestamp, $scope.newTimestamp);
      var resultSetIds = [$scope.originalResultSetID];

      // Optimization - if old/new branches are the same collect data in one pass
      if (_.isEqual($scope.originalProject, $scope.newProject)) {
        resultSetIds = [$scope.originalResultSetID, $scope.newResultSetID];
      }

      PhSeries.getSeriesSummaries($scope.originalProject.name,
                    timeRange,
                    optionCollectionMap,
                    {e10s: $scope.e10s}).then(
        function(originalSeriesData) {
          $scope.platformList = originalSeriesData.platformList;
          $scope.testList = originalSeriesData.testList;
          return PhCompare.getResultsMap($scope.originalProject.name,
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

          PhSeries.getSeriesSummaries($scope.newProject.name,
                        timeRange,
                        optionCollectionMap,
                        {e10s: $scope.e10s}).then(
            function(newSeriesData) {
              $scope.platformList = _.union($scope.platformList,
                                            newSeriesData.platformList).sort();
              $scope.testList = _.union($scope.testList,
                                        newSeriesData.testList).sort();
              return PhCompare.getResultsMap($scope.newProject.name,
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
      window.document.title = ("Comparison between " + $scope.originalRevision + 
                              " (" + $scope.originalProject.name + ") " + 
                              "and " + $scope.newRevision + " (" + $scope.newProject.name + ")");

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
          detailsLink += _.map(_.pairs({
            originalProject: $scope.originalProject.name,
            originalRevision: $scope.originalRevision,
            newProject: $scope.newProject.name,
            newRevision: $scope.newRevision,
            originalSignature: oldSig,
            newSignature: newSig
          }), function(kv) { return kv[0]+"="+kv[1] }).join("&");

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
      return ThResultSetModel.getResultSetsFromRevision(project.name, revision).then(
        function(resultSets) {
          var resultSet = resultSets[0];
          //TODO: this is a bit hacky to pass in 'original' as a text string
          if (rsid == 'original') {
            $scope.originalResultSetID = resultSet.id;
            $scope.originalTimestamp = resultSet.push_timestamp;
          } else {
            $scope.newResultSetID = resultSet.id;
            $scope.newTimestamp = resultSet.push_timestamp;
          }
        }, function(error) {
          $scope.errors.push(error);
        });
    }

    $scope.dataLoading = true;
    $scope.getCompareClasses = PhCompare.getCompareClasses;

    var optionCollectionMap = {};
    var loadRepositories = ThRepositoryModel.load();
    var loadOptions = ThOptionCollectionModel.get_map().then(
      function(_optionCollectionMap) {
        optionCollectionMap = _optionCollectionMap;
      });
    $q.all([loadRepositories, loadOptions]).then(function() {
        $scope.errors = PhCompare.validateInput($stateParams.originalProject,
                                                $stateParams.newProject,
                                                $stateParams.originalRevision,
                                                $stateParams.originalProject);

        if ($scope.errors.length > 0) {
          $scope.dataLoading = false;
          return;
        }

        $stateParams.e10s = Boolean($stateParams.e10s);
        $scope.hideMinorChanges = Boolean($stateParams.hideMinorChanges);
        $scope.originalProject = ThRepositoryModel.getRepo(
          $stateParams.originalProject);
        $scope.newProject = ThRepositoryModel.getRepo(
          $stateParams.newProject);
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
  'thServiceDomain', 'ThOptionCollectionModel', 'ThRepositoryModel',
  'ThResultSetModel', '$http', '$q', '$timeout', 'PhSeries', 'math',
  'isReverseTest', 'PhCompare',
  function CompareSubtestResultsCtrl($state, $stateParams, $scope, $rootScope,
                                     $location, thServiceDomain,
                                     ThOptionCollectionModel,
                                     ThRepositoryModel, ThResultSetModel,
                                     $http, $q, $timeout, PhSeries, math,
                                     isReverseTest, PhCompare) {
    //TODO: duplicated from comparectrl
    function verifyRevision(project, revision, rsid) {
      return ThResultSetModel.getResultSetsFromRevision(project.name, revision).then(
        function(resultSets) {
          var resultSet = resultSets[0];
          //TODO: this is a bit hacky to pass in 'original' as a text string
          if (rsid == 'original') {
            $scope.originalResultSetID = resultSet.id;
            $scope.originalTimestamp = resultSet.push_timestamp;
          } else {
            $scope.newResultSetID = resultSet.id;
            $scope.newTimestamp = resultSet.push_timestamp;
          }
        }, function(error) {
          $scope.errors.push(error);
        });
    }

    function displayResults(rawResultsMap, newRawResultsMap, timeRange) {
      $scope.compareResults = {};
      $scope.titles = {};

      $scope.subtestTitle = ($scope.platformList[0].split(' ')[0] + " " +
                             $scope.testList[0].split(' ')[0]);
      window.document.title = $scope.subtestTitle + " subtest comparison";

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
          if (oldSig == $scope.originalSignature ||
              oldSig == $scope.newSignature ||
              newSig == $scope.originalSignature ||
              newSig == $scope.newSignature) {
            cmap.highlightedTest = true;
          }

          var originalSeries = "[" + $scope.originalProject.name + "," +
              oldSig + ",1]";
          var newSeries = "[" + $scope.newProject.name + "," +
              newSig + ",1]";

          var detailsLink = 'perf.html#/graphs?timerange=' +
              timeRange + '&series=' + newSeries;

          if (oldSig != newSig) {
            detailsLink += '&series=' + originalSeries;
          }
          detailsLink += '&highlightedRevisions=' + $scope.originalRevision;
          detailsLink += '&highlightedRevisions=' + $scope.newRevision;

          cmap.detailsLink = detailsLink;
          cmap.name = page;
          cmap.hideMinorChanges = $scope.hideMinorChanges;
          $scope.compareResults[testName].push(cmap);
        });
      });
    }

    $scope.dataLoading = true;
    $scope.getCompareClasses = PhCompare.getCompareClasses;

    var optionCollectionMap = {};
    var loadRepositories = ThRepositoryModel.load();
    var loadOptions = ThOptionCollectionModel.get_map().then(
      function(_optionCollectionMap) {
        optionCollectionMap = _optionCollectionMap;
      });
    $q.all([loadRepositories, loadOptions]).then(
      function() {
        $scope.errors = PhCompare.validateInput($stateParams.originalProject,
                                                $stateParams.newProject,
                                                $stateParams.originalRevision,
                                                $stateParams.newRevision,
                                                $stateParams.originalSignature,
                                                $stateParams.newSignature);

        if ($scope.errors.length > 0) {
          $scope.dataLoading = false;
          return;
        }

        $scope.hideMinorChanges = Boolean($stateParams.hideMinorChanges);
        $scope.originalProject = ThRepositoryModel.getRepo(
          $stateParams.originalProject);
        $scope.newProject = ThRepositoryModel.getRepo(
          $stateParams.newProject);
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

            PhSeries.getSubtestSummaries($scope.originalProject.name,
                          timeRange,
                          optionCollectionMap,
                          $scope.originalSignature).then(
              function (originalSeriesData) {
                $scope.testList = originalSeriesData.testList;
                $scope.platformList = originalSeriesData.platformList;
                return PhCompare.getResultsMap($scope.originalProject.name,
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

                PhSeries.getSubtestSummaries($scope.newProject.name,
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

