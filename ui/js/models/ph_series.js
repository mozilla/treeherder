"use strict";

treeherder.factory('PhSeries', ['$http', 'thServiceDomain', function($http, thServiceDomain) {

    var _getSeriesSummary = function(projectName, signature, signatureProps,
                                     optionCollectionMap) {
        var platform = signatureProps.machine_platform;
        var testName = signatureProps.test;
        var subtestSignatures;
        if (testName === undefined) {
            testName = "summary";
            subtestSignatures = signatureProps.subtest_signatures;
        }
        var name = signatureProps.suite + " " + testName;
        var options = [ optionCollectionMap[signatureProps.option_collection_hash] ];
        if (signatureProps.test_options) {
            options = options.concat(signatureProps.test_options);
        }
        name = name + " " + options.join(" ");

        return { name: name, projectName: projectName, signature: signature,
                 platform: platform, options: options,
                 subtestSignatures: subtestSignatures };
    };

    var _getAllSeries = function(projectName, timeRange, optionMap) {
        var signatureURL = thServiceDomain + '/api/project/' + projectName +
            '/performance/signatures/?interval=' +
            timeRange;

        return $http.get(signatureURL).then(function(response) {
            var seriesList = [];
            var platformList = [];
            var testList = [];

            Object.keys(response.data).forEach(function(signature) {
                var seriesSummary = _getSeriesSummary(projectName, signature,
                                                      response.data[signature],
                                                      optionMap);

                seriesList.push(seriesSummary);

                // add test/platform to lists if not yet present
                if (!_.contains(platformList, seriesSummary.platform)) {
                    platformList.push(seriesSummary.platform);
                }
                if (!_.contains(testList, seriesSummary.name)) {
                    testList.push(seriesSummary.name);
                }
            });
            return {
                seriesList: seriesList,
                platformList: platformList,
                testList: testList
            };
        });
    };

    var _getPlatformList = function(projectName, timeRange) {
        var platformURL = thServiceDomain + '/api/project/' + projectName +
            '/performance/platforms/?interval=' +
            timeRange;
        return $http.get(platformURL).then(function(response) {
            return {
                platformList: response.data
            };
        });

    };

    var _getSeriesByPlatform = function(projectName, timeRange, platform, optionMap) {
        var specifyPlatformURL = thServiceDomain + '/api/project/' + projectName +
            '/performance/signatures/?interval=' +
            timeRange + '&platform=' + platform;

        return $http.get(specifyPlatformURL).then(function(response) {
            var seriesList = [];
            var testList = [];

            _.keys(response.data).forEach(function(signature){
                var seriesSummary = _getSeriesSummary(projectName, signature,
                    response.data[signature], optionMap);
                seriesList.push(seriesSummary);

                // add test/platform to lists if not yet present
                if (!_.contains(testList, seriesSummary.name)) {
                    testList.push(seriesSummary.name);
                }
            });

            return {
                platform: platform,
                seriesList: seriesList,
                testList: testList
            };
        });
    };

    var _getSeriesByJobId = function(projectName, jobId) {
        return $http.get(thServiceDomain + '/api/project/' + projectName +
            '/performance/data/?job_id=' + jobId).then(function(response) {
            if(response.data) {
                return response.data;
            } else {
                return $q.reject("No data been found for job id " +
                    jobId + " in project " + projectName);
            }
        });
    };


    return {
        getSeriesSummary: _getSeriesSummary,

        getSubtestSummaries: function(projectName, timeRange, optionMap, targetSignature) {
            return _getAllSeries(projectName, timeRange, optionMap).then(function(lists) {
                var seriesList = [];
                var platformList = [];
                var subtestSignatures = [];
                var suiteName;

                //Given a signature, find the series and get subtest signatures
                var series = _.find(lists.seriesList,
                                    function(series) {
                                        return series.signature == targetSignature;
                                    });

                if (series) {
                    // if it is not a summary series, then find the summary series
                    // corresponding to it (could be more than one) and use that
                    if (!series.subtestSignatures) {
                        series = _.filter(lists.seriesList,
                                          function(s) {
                                              return _.find(s.subtestSignatures, function(signature) {
                                                  return signature == targetSignature;
                                              });
                                          });
                    } else {
                        // make this a list of series to work with _.map below
                        series = [series];
                    }
                    subtestSignatures = _.union(_.map(series, 'subtestSignatures' ))[0];
                    suiteName = _.union(_.map(series, 'name'))[0];
                }

                //For each subtest, find the matching series in the list and store it
                subtestSignatures.forEach(function(signature) {
                    var seriesSubtest = _.find(lists.seriesList, function(series) {
                        return series.signature == signature;
                    });
                    seriesList.push(seriesSubtest);

                    // add platform to lists if not yet present
                    if (!_.contains(platformList, seriesSubtest.platform)) {
                        platformList.push(seriesSubtest.platform);
                    }
                });

                var testList = [];
                if (suiteName) {
                    testList = [suiteName];
                }

                return {
                    seriesList: seriesList,
                    platformList: platformList,
                    testList: testList
                };
            });
        },

        getAllSeries: function(projectName, timeRange, optionMap) {
            return _getAllSeries(projectName, timeRange, optionMap);
        },

        getSeriesSummaries: function(projectName, timeRange, optionMap, userOptions) {
            var seriesList = [];
            var platformList = [];
            var testList = [];

            return _getAllSeries(projectName, timeRange, optionMap).then(function(lists) {
                var allSubtestSignatures = _.flatten(_.map(lists.seriesList, function(series) {
                    return series.subtestSignatures ? series.subtestSignatures : [];
                }));
                lists.seriesList.forEach(function(series) {
                    // Filter out subtests with a summary signature
                    if (!series.subtestSignatures) {
                        if (_.contains(allSubtestSignatures, series.signature)) {
                            return;
                        }
                    }
                    // We don't generate number for tp5n, this is xperf and we collect counters
                    if (_.contains(series.name, "tp5n"))
                        return;

                    seriesList.push(series);

                    // add test/platform to lists if not yet present
                    if (!_.contains(platformList, series.platform)) {
                        platformList.push(series.platform);
                    }
                    if (!_.contains(testList, series.name)) {
                        testList.push(series.name);
                    }
                }); //lists.serieslist.forEach

                return {
                    seriesList: seriesList,
                    platformList: platformList,
                    testList: testList
                };
            }); //_getAllSeries
        },

        getPlatformList: function(projectName, timeRange) {
            return _getPlatformList(projectName, timeRange);
        },

        getSeriesByPlatform: function(prjectName, timeRange, platform, optionMap) {
            return _getSeriesByPlatform(prjectName, timeRange, platform, optionMap);
        },

        getSeriesByJobId: function(projectName, jobId) {
            return _getSeriesByJobId(projectName, jobId);
        },
    };
}]);
