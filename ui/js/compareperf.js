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


var comparePerf = angular.module("compareperf", ['ui.router', 'ui.bootstrap', 'treeherder']);

//TODO: make getSeriesSummary part of a common library
comparePerf.factory('getSeriesSummary', [ function() {
  return function(signature, signatureProps, optionCollectionMap, pgo, e10s) {
    var platform = signatureProps.machine_platform + " " +
      signatureProps.machine_architecture;
    var extra = "";
    if (signatureProps.job_group_symbol === "T-e10s") {
      extra = " e10s";
    }
    var testName = signatureProps.test;
    var subtestSignatures;
    if (testName === undefined) {
      testName = "summary";
      subtestSignatures = signatureProps.subtest_signatures;
    }
    var name = signatureProps.suite + " " + testName +
      " " + optionCollectionMap[signatureProps.option_collection_hash] + extra;

    //Only keep summary signatures, filter in/out e10s and pgo
    if (name.indexOf('summary') <= 0) {
        return null;
    }
    if (e10s && (name.indexOf('e10s') <= 0)) {
        return null;
    } else if (!e10s && (name.indexOf('e10s') > 0)) {
        return null;
    }

    //TODO: pgo is linux/windows only- what about osx and android
    if (pgo && (name.indexOf('pgo') <= 1)) {
        return null;
    } else if (!pgo && (name.indexOf('pgo') > 0)) {
        return null;
    }

    return { name: name, signature: signature, platform: platform,
             subtestSignatures: subtestSignatures };
  };
}]);

comparePerf.controller('CompareCtrl', [ '$state', '$stateParams', '$scope', '$rootScope', '$location',
                              'thServiceDomain', '$http', '$q', '$timeout', 'getSeriesSummary',
  function CompareCtrl($state, $stateParams, $scope, $rootScope, $location,
                    thServiceDomain, $http, $q, $timeout, getSeriesSummary) {

    function displayComparision() {
      //TODO: determine the dates of the two revisions and only grab what we need
      $scope.timeRange = 2592000; // last 30 days
      $scope.testList = [];
      $scope.platformList = [];

      var signatureURL = thServiceDomain + '/api/project/' + $scope.originalProject + 
          '/performance-data/0/get_performance_series_summary/?interval=' +
          $scope.timeRange;

      $http.get(signatureURL).then(
        function(response) {
          var seriesList = [];

          Object.keys(response.data).forEach(function(signature) {
            var seriesSummary = getSeriesSummary(signature,
                                                 response.data[signature],
                                                 optionCollectionMap,
                                                 $stateParams.pgo,
                                                 $stateParams.e10s);

            if (seriesSummary != null && seriesSummary.signature !== undefined) {
              seriesList.push(seriesSummary);

              if ($scope.platformList.indexOf(seriesSummary.platform) === -1) {
                $scope.platformList.push(seriesSummary.platform);
              }

              if ($scope.testList.indexOf(seriesSummary.name) === -1) {
                $scope.testList.push(seriesSummary.name);
              }
            }
          });

          // find summary results for all tests/platforms for the original rev
          var signatureURL = thServiceDomain + '/api/project/' +
              $scope.originalProject + '/performance-data/0/' +
              'get_performance_data/?interval_seconds=' + $scope.timeRange;

          // TODO: figure how how to reduce these maps
          var rawResultsMap = {};

          $q.all(seriesList.map(function(series) {
            return $http.get(signatureURL + "&signatures=" + series.signature).then(function(response) {
              response.data.forEach(function(data) {
                rawResultsMap[data.series_signature] = calculateStats(data.blob, $scope.originalResultSetID);
                rawResultsMap[data.series_signature].name = series.name;
                rawResultsMap[data.series_signature].platform = series.platform;
              });
            });
          })).then(function () {
            // find summary results for all tests/platforms for the original rev
            var signatureURL = thServiceDomain + '/api/project/' +
                           $scope.newProject + '/performance-data/0/' +
                           'get_performance_data/?interval_seconds=' + $scope.timeRange;

            //ok, now get the new revision
            var signatureListURL = thServiceDomain + '/api/project/' + $scope.newProject + 
              '/performance-data/0/get_performance_series_summary/?interval=' +
              $scope.timeRange;

            var newRawResultsMap = {};
            var newSeriesList = [];

            $http.get(signatureListURL).then(function(response) {
              Object.keys(response.data).forEach(function(signature) {
                var seriesSummary = getSeriesSummary(signature,
                                                     response.data[signature],
                                                     optionCollectionMap,
                                                     $stateParams.pgo,
                                                     $stateParams.e10s);

                if (seriesSummary != null && seriesSummary.signature !== undefined) {
                  newSeriesList.push(seriesSummary);

                  if ($scope.platformList.indexOf(seriesSummary.platform) === -1) {
                    $scope.platformList.push(seriesSummary.platform);
                  }

                  if ($scope.testList.indexOf(seriesSummary.name) === -1) {
                    $scope.testList.push(seriesSummary.name);
                  }
                }
              });
              $scope.testList.sort();
              $scope.platformList.sort();

              $q.all(newSeriesList.map(function(series) {
                return $http.get(signatureURL + "&signatures=" + series.signature).then(function(response) {
                  response.data.forEach(function(data) {
                    newRawResultsMap[data.series_signature] = calculateStats(data.blob, $scope.newResultSetID);
                    newRawResultsMap[data.series_signature].name = series.name;
                    newRawResultsMap[data.series_signature].platform = series.platform;
                  });
                });
              })).then(function () {
                $scope.dataLoading = false;
                displayResults(rawResultsMap, newRawResultsMap);
              });
            });
          });
        }
      );
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

    function updateURL() {
      $state.transitionTo('compare', { 'originalProject': $scope.originalProject,
                            'originalRevision': $scope.originalRevision,
                            'newProject': $scope.newProject,
                            'newRevision': $scope.newRevision},
                {location: true, inherit: true, notify: false, relative: $state.$current});
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


comparePerf.config(function($stateProvider, $urlRouterProvider) {
  $urlRouterProvider.deferIntercept(); // so we don't reload on url change

  $stateProvider.state('compare', {
    templateUrl: 'partials/perf/comparectrl.html',
    url: '/compare?originalProject&originalRevision&newProject&newRevision&hideMinorChanges&e10s&pgo',
    controller: 'CompareCtrl'
  });

  $urlRouterProvider.otherwise('/compare');
})
  // define the interception
  .run(function ($rootScope, $urlRouter, $location, $state) {
    $rootScope.$on('$locationChangeSuccess', function(e, newUrl, oldUrl) {
      // Prevent $urlRouter's default handler from firing
      e.preventDefault();
      if ($state.current.name !== 'compare') {
        // here for first time, synchronize
        $urlRouter.sync();
      }
    });

    // Configures $urlRouter's listener *after* custom listener
    $urlRouter.listen();
  })


