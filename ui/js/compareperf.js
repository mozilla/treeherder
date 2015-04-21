/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";


// -------------------------------------------------------------------------
// Utility Functions
// -------------------------------------------------------------------------


/**
 * Compute the standard deviation for an array of values.
 * 
 * @param values
 *        An array of numbers.
 * @param avg
 *        Average of the values.
 * @return a number (the standard deviation)
 */
function stddev(values, avg) {
  if (values.length <= 1) {
    return 0;
  }

  return Math.sqrt(
    values.map(function (v) { return Math.pow(v - avg, 2); })
          .reduce(function (a, b) { return a + b; }) / (values.length - 1));
}


// -------------------------------------------------------------------------
// End Utility Functions
// -------------------------------------------------------------------------

perf.controller('CompareChooserCtrl', [ '$state', '$stateParams',
                                               '$scope',
                                               '$rootScope', '$location',
                                               'thServiceDomain', '$http',
                                               '$q', '$timeout', 'ThRepositoryModel',
  function CompareChooserCtrl($state, $stateParams, $scope, $rootScope, $location,
                    thServiceDomain, $http, $q, $timeout, ThRepositoryModel) {
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

perf.controller('CompareResultsCtrl', [ '$state', '$stateParams', '$scope', '$rootScope', '$location',
                              'thServiceDomain', '$http', '$q', '$timeout', 'getSeriesSummary',
  function CompareResultsCtrl($state, $stateParams, $scope, $rootScope, $location,
                    thServiceDomain, $http, $q, $timeout, getSeriesSummary) {

    function displayComparision() {
      //TODO: determine the dates of the two revisions and only grab what we need
      $scope.timeRange = 2592000; // last 30 days
      $scope.testList = [];
      $scope.platformList = [];

      function getSeriesData(projectName, e10s, pgo) {
        var signatureURL = thServiceDomain + '/api/project/' + projectName + 
          '/performance-data/0/get_performance_series_summary/?interval=' +
          $scope.timeRange;
        return $http.get(signatureURL).then(function(response) {
          var seriesList = [];
          var platformList = [];
          var testList = [];

          Object.keys(response.data).forEach(function(signature) {
            var seriesSummary = getSeriesSummary(signature,
                                                 response.data[signature],
                                                 optionCollectionMap);

            // Only keep summary signatures, filter in/out e10s and pgo
            if (!seriesSummary.subtestSignatures ||
                (e10s && !_.contains(seriesSummary.options, 'e10s')) ||
                (!e10s && _.contains(seriesSummary.options, 'e10s')) ||
                (pgo && !_.contains(seriesSummary.options, 'pgo')) ||
                (!pgo && _.contains(seriesSummary.options, 'pgo'))) {
              return; // skip, not valid
            } else {
              seriesList.push(seriesSummary);

              // add test/platform to lists if not yet present
              if (!_.contains(platformList, seriesSummary.platform)) {
                platformList.push(seriesSummary.platform);
              }
              if (!_.contains(testList, seriesSummary.name)) {
               testList.push(seriesSummary.name);
              }
            }
          });

          return {
            seriesList: seriesList,
            platformList: platformList,
            testList: testList
          };
        });
      }

      function getResultsMap(projectName, seriesList, timeRange, resultSetId) {
        var baseURL = thServiceDomain + '/api/project/' +
          projectName + '/performance-data/0/' +
          'get_performance_data/?interval_seconds=' + timeRange;

        var resultsMap = {};
        return $q.all(seriesList.map(function(series) {
          return $http.get(baseURL + "&signatures=" + series.signature).then(
            function(response) {
              response.data.forEach(function(data) {
                resultsMap[data.series_signature] = calculateStats(
                  data.blob, resultSetId);
                resultsMap[data.series_signature].name = series.name;
                resultsMap[data.series_signature].platform = series.platform;
              });
            })
        })).then(function() {
          return resultsMap;
        });
      }

      getSeriesData($scope.originalProject, $scope.e10s, $scope.pgo).then(
        function(originalSeriesData) {
          $scope.platformList = originalSeriesData.platformList;
          $scope.testList = originalSeriesData.platformList;
          return getResultsMap($scope.originalProject,
                               originalSeriesData.seriesList,
                               $scope.timeRange,
                               $scope.originalResultSetID);
        }).then(function(originalResultsMap) {
          getSeriesData($scope.newProject, $scope.e10s, $scope.pgo).then(
            function(newSeriesData) {
              $scope.platformList = _.union($scope.platformList,
                                            newSeriesData.platformList).sort();
              $scope.testList = _.union($scope.testList,
                                        newSeriesData.testList).sort();
              return getResultsMap($scope.newProject,
                                   newSeriesData.seriesList,
                                   $scope.timeRange,
                                   $scope.newResultSetID);
            }).then(function(newResultsMap) {
              $scope.dataLoading = false;
              displayResults(originalResultsMap, newResultsMap);
            });
        });
    }

    //TODO: put this into a generic library
    function calculateStats(perfData, resultSetID) {
      var geomeans = [];
      var total = 0;
      _.where(perfData, { result_set_id: resultSetID }).forEach(function(pdata) {
        geomeans.push(pdata.geomean);
        total += pdata.geomean;
      });

      var avg = total / geomeans.length;
      var sigma = stddev(geomeans, avg);
      return {geomean: avg.toFixed(2), stddev: sigma.toFixed(2), runs: geomeans.length};
    }

    //TODO: put this into a generic library
    function isReverseTest(testName) {
      var reverseTests = ['dromaeo_dom', 'dromaeo_css', 'v8_7', 'canvasmark'];
      var found = false;
      reverseTests.forEach(function(rt) {
        if (testName.indexOf(rt) >= 0) {
          found = true;
        }
      });
      return found;
    }

    function displayResults(rawResultsMap, newRawResultsMap) {
      var counter = 0;
      var compareResultsMap = {};

      $scope.testList.forEach(function(testName) {
        if (counter > 0 && compareResultsMap[(counter-1)].headerColumns==2) {
          counter--;
        }

        //TODO: figure out a cleaner method for making the names a header row
        compareResultsMap[counter++] = {'name': testName.replace(' summary', ''),
                                        'isEmpty': true, 'isMinor': false, 'headerColumns': 2,
                                        'originalGeoMean': 'Old Rev', 'originalStddev': 'StdDev',
                                        'newGeoMean': 'New Rev', 'newStddev': 'StdDev',
                                        'delta': 'Delta', 'deltaPercentage': 'Delta'};


        $scope.platformList.forEach(function(platform) {
          var cmap = {'originalGeoMean': NaN, 'originalRuns': 0, 'originalStddev': NaN,
                      'newGeoMean': NaN, 'newRuns': 0, 'newStddev': NaN, 'headerColumns': 1,
                      'delta': NaN, 'deltaPercentage': NaN, 'isEmpty': false,
                      'isRegression': false, 'isImprovement': false, 'isMinor': true};

          var oldSig = _.find(Object.keys(rawResultsMap), function (sig) {
            return (rawResultsMap[sig].name == testName && rawResultsMap[sig].platform == platform)});
          var newSig = _.find(Object.keys(newRawResultsMap), function (sig) {
            return (newRawResultsMap[sig].name == testName && newRawResultsMap[sig].platform == platform)});

          if (oldSig) {
             var originalData = rawResultsMap[oldSig];
             cmap.originalGeoMean = originalData.geomean;
             cmap.originalRuns = originalData.runs;
             cmap.originalStddev = originalData.stddev;
             cmap.originalStddevPct = ((originalData.stddev / originalData.geomean) * 100).toFixed(2);
          }
          if (newSig) {
             var newData = newRawResultsMap[newSig];
             cmap.newGeoMean = newData.geomean;
             cmap.newRuns = newData.runs;
             cmap.newStddev = newData.stddev;
             cmap.newStddevPct = ((newData.stddev / newData.geomean) * 100).toFixed(2);
          }

          if ((cmap.originalRuns == 0 && cmap.newRuns == 0) ||
              (testName == 'tp5n summary opt')) {
            // We don't generate numbers for tp5n, just counters
            cmap.isEmpty = true;
          } else {
            cmap.delta = (cmap.newGeoMean - cmap.originalGeoMean).toFixed(2);
            cmap.deltaPercentage = (cmap.delta / cmap.originalGeoMean * 100).toFixed(2);
            if (cmap.deltaPercentage > 2.0) {
              cmap.isMinor = false;
              isReverseTest(testName) ? cmap.isImprovement = true : cmap.isRegression = true;
            } else if (cmap.deltaPercentage < -2.0) {
              cmap.isMinor = false;
              isReverseTest(testName) ? cmap.isRegression = true : cmap.isImprovement = true;
            }

            //TODO: do we need zoom?  can we have >1 highlighted revision?
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
            cmap.name = platform;
            compareResultsMap[counter++] = cmap;
          }
        });
      });
      $scope.compareResults = Object.keys(compareResultsMap).map(function(k) {
        return compareResultsMap[k];
      });
    }

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
