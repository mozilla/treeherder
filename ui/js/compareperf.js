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
    function displayComparision() {
      //TODO: determine the dates of the two revisions and only grab what we need
      $scope.timeRange = 2592000; // last 30 days
      $scope.testList = [];
      $scope.platformList = [];

      PhSeries.getSeriesSummaries($scope.originalProject,
                    $scope.timeRange,
                    optionCollectionMap,
                    {e10s: $scope.e10s,
                     pgo: $scope.pgo}).then(
        function(originalSeriesData) {
          $scope.platformList = originalSeriesData.platformList;
          $scope.testList = originalSeriesData.testList;
          return PhCompare.getResultsMap($scope.originalProject,
                               originalSeriesData.seriesList,
                               $scope.timeRange,
                               $scope.originalResultSetID);
        }).then(function(originalResultsMap) {
          PhSeries.getSeriesSummaries($scope.newProject,
                        $scope.timeRange,
                        optionCollectionMap,
                        {e10s: $scope.e10s,
                         pgo: $scope.pgo}).then(
            function(newSeriesData) {
              $scope.platformList = _.union($scope.platformList,
                                            newSeriesData.platformList).sort();
              $scope.testList = _.union($scope.testList,
                                        newSeriesData.testList).sort();
              return PhCompare.getResultsMap($scope.newProject,
                                   newSeriesData.seriesList,
                                   $scope.timeRange,
                                   $scope.newResultSetID);
            }).then(function(newResultsMap) {
              $scope.dataLoading = false;
              displayResults(originalResultsMap, newResultsMap);
            });
        });
    }

    function displayResults(rawResultsMap, newRawResultsMap) {
      $scope.compareResults = {};
      $scope.titles = {};

      $scope.testList.forEach(function(testName) {
        $scope.titles[testName] = testName.replace('summary ', '');
        $scope.compareResults[testName] = [];

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
          $scope.compareResults[testName].push(cmap);
        });
      });
    }

    //TODO: duplicated in comparesubtestctrl
    function verifyRevision(project, revision, rsid) {
      var uri = thServiceDomain + '/api/project/' + project +
          '/resultset/?format=json&full=false&with_jobs=false&revision=' +
          revision;

      return $http.get(uri).then(function(response) {
        var results = response.data.results;
        if (results.length > 0) {

          //TODO: this is a bit hacky to pass in 'original' as a text string
          if (rsid == 'original') {
            $scope.originalResultSetID = results[0].id;
          } else {
            $scope.newResultSetID = results[0].id;
          }
        }
      });
    }

    var optionCollectionMap = {};
    $scope.dataLoading = true;

    $http.get(thServiceDomain + '/api/optioncollectionhash').then(
      function(response) {
        response.data.forEach(function(dict) {
          optionCollectionMap[dict.option_collection_hash] =
            dict.options.map(function(option) {
              return option.name; }).join(" ");
        });
      }).then(function() {
        $stateParams.pgo = Boolean($stateParams.pgo);
        $stateParams.e10s = Boolean($stateParams.e10s);
        $scope.hideMinorChanges = Boolean($stateParams.hideMinorChanges);

        // TODO: validate projects and revisions
        $scope.originalProject = $stateParams.originalProject;
        $scope.newProject = $stateParams.newProject;
        $scope.newRevision = $stateParams.newRevision;
        $scope.originalRevision = $stateParams.originalRevision;
        if (!$scope.originalProject ||
            !$scope.newProject ||
            !$scope.originalRevision ||
            !$scope.newRevision) {
          //TODO: get an error to the UI
          return;
        }


        verifyRevision($scope.originalProject, $scope.originalRevision, "original").then(function () {
          verifyRevision($scope.newProject, $scope.newRevision, "new").then(function () {
            $http.get(thServiceDomain + '/api/repository/').then(function(response) {
              $scope.projects = response.data;
            });
          });
        });
      displayComparision();
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
          '/resultset/?format=json&full=false&with_jobs=false&revision=' +
          revision;

      return $http.get(uri).then(function(response) {
        var results = response.data.results;
        if (results.length > 0) {

          //TODO: this is a bit hacky to pass in 'original' as a text string
          if (rsid == 'original') {
            $scope.originalResultSetID = results[0].id;
          } else {
            $scope.newResultSetID = results[0].id;
          }
        }
      });
    }

    function displayResults(rawResultsMap, newRawResultsMap) {
      $scope.compareResults = {};
      $scope.titles = {};

      $scope.testList.forEach(function(testName) {
        $scope.titles[testName] = testName.replace('summary ', '');
        $scope.compareResults[testName] = [];

        $scope.pageList.forEach(function(page) {
          var oldSig = _.find(Object.keys(rawResultsMap), function (sig) {
            return (rawResultsMap[sig].name == page)});
          var newSig = _.find(Object.keys(newRawResultsMap), function (sig) {
            return (newRawResultsMap[sig].name == page)});

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
              $scope.timeRange + '&series=' + newSeries;

          if (oldSig != newSig) {
            detailsLink += '&series=' + originalSeries;
          }
          detailsLink += '&highlightedRevision=' + $scope.newRevision;

          cmap.detailsLink = detailsLink;
          cmap.name = page;
          $scope.compareResults[testName].push(cmap);
        });
      });
    }

    var optionCollectionMap = {};

    $http.get(thServiceDomain + '/api/optioncollectionhash').then(
      function(response) {
        response.data.forEach(function(dict) {
          optionCollectionMap[dict.option_collection_hash] =
            dict.options.map(function(option) {
              return option.name; }).join(" ");
        });
      }).then(function() {
        // TODO: validate projects and revisions
        $scope.timeRange = 2592000; // last 30 days
        $scope.originalProject = $stateParams.originalProject;
        $scope.newProject = $stateParams.newProject;
        $scope.newRevision = $stateParams.newRevision;
        $scope.originalRevision = $stateParams.originalRevision;
        $scope.originalSignature = $stateParams.originalSignature;
        $scope.newSignature = $stateParams.newSignature;
        if (!$scope.originalProject ||
            !$scope.newProject ||
            !$scope.originalRevision ||
            !$scope.newRevision ||
            !$scope.originalSignature ||
            !$scope.newSignature) {
          //TODO: get an error to the UI
          return;
        }


        verifyRevision($scope.originalProject, $scope.originalRevision, "original").then(function () {
          verifyRevision($scope.newProject, $scope.newRevision, "new").then(function () {
            $http.get(thServiceDomain + '/api/repository/').then(function(response) {
              $scope.projects = response.data;
              $scope.pageList = [];
              PhSeries.getSubtestSummaries($scope.originalProject,
                            $scope.timeRange,
                            optionCollectionMap,
                            $scope.originalSignature).then(
                function (originalSeriesData) {
                  $scope.testList = originalSeriesData.testList;
                  $scope.platformList = originalSeriesData.platformList;
                  return PhCompare.getResultsMap($scope.originalProject,
                                       originalSeriesData.seriesList,
                                       $scope.timeRange,
                                       $scope.originalResultSetID);
              }).then(function(originalSeriesMap) {
                  Object.keys(originalSeriesMap).forEach(function(series) {
                    if (!_.contains($scope.pageList, originalSeriesMap[series].name)) {
                      $scope.pageList.push(originalSeriesMap[series].name);
                    }
                  });
                  PhSeries.getSubtestSummaries($scope.newProject,
                                $scope.timeRange,
                                optionCollectionMap,
                                $scope.originalSignature).then(
                    function (newSeriesData) {
                      return PhCompare.getResultsMap($scope.newProject,
                                           newSeriesData.seriesList,
                                           $scope.timeRange,
                                           $scope.newResultSetID);
                  }).then(function(newSeriesMap) {
                    Object.keys(newSeriesMap).forEach(function(series) {
                      if (!_.contains($scope.pageList, newSeriesMap[series].name)) {
                        $scope.pageList.push(newSeriesMap[series].name);
                      }
                    });
                    displayResults(originalSeriesMap, newSeriesMap);
                  });
              });
            });
          });
        });
    });
  }]);

