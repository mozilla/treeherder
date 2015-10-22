"use strict";

var perf = angular.module("perf", ['ui.router', 'ui.bootstrap', 'treeherder']);

perf.factory('PhSeries', ['$http', 'thServiceDomain', function($http, thServiceDomain) {

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
    };
}]);

perf.factory('isReverseTest', [ function() {
    return function(testName) {
        var reverseTests = ['dromaeo_dom', 'dromaeo_css', 'v8_7', 'canvasmark'];
        var found = false;
        reverseTests.forEach(function(rt) {
            if (testName.indexOf(rt) >= 0) {
                found = true;
            }
        });
        return found;
    };
}]);


perf.factory('PhCompare', [ '$q', '$http', 'thServiceDomain', 'PhSeries',
                            'math', 'isReverseTest', 'phTimeRanges',
                            function($q, $http, thServiceDomain, PhSeries, math, isReverseTest, phTimeRanges) {

                                // Used for t_test: default stddev if both sets have only a single value - 15%.
                                // Should be rare case and it's unreliable, but at least have something.
                                var STDDEV_DEFAULT_FACTOR = 0.15;

                                var RATIO_CARE_MIN = 1.015; // We don't care about less than ~1.5% diff
                                var T_VALUE_CARE_MIN = 0.5; // Observations
                                var T_VALUE_CONFIDENT = 1; // Observations. Weirdly nice that ended up as 0.5 and 1...

                                function getClassName(newIsBetter, oldVal, newVal, abs_t_value) {
                                    // NOTE: we care about general ratio rather than how much is new compared
                                    // to old - this could end up with slightly higher or lower threshold
                                    // in practice than indicated by DIFF_CARE_MIN. E.g.:
                                    // - If old is 10 and new is 5, then new = old -50%
                                    // - If old is 5 and new is 10, then new = old + 100%
                                    // And if the threshold was 75% then one would matter and the other wouldn't.
                                    // Instead, we treat both cases as 2.0 (general ratio), and both would matter
                                    // if our threshold was 75% (i.e. DIFF_CARE_MIN = 1.75).
                                    var ratio = newVal / oldVal;
                                    if (ratio < 1) {
                                        ratio = 1 / ratio; // Direction agnostic and always >= 1.
                                    }

                                    if (ratio < RATIO_CARE_MIN || abs_t_value < T_VALUE_CARE_MIN) {
                                        return "";
                                    }

                                    if (abs_t_value < T_VALUE_CONFIDENT) {
                                        // Since we (currently) have only one return value to indicate uncertainty,
                                        // let's use it for regressions only. (Improvement would just not be marked).
                                        return newIsBetter ? "" : "compare-notsure";
                                    }

                                    return newIsBetter ? "compare-improvement" : "compare-regression";
                                }

                                return {
                                    getCompareClasses: function(cr, type) {
                                        if (cr.isEmpty) return 'subtest-empty';
                                        if (type == 'row' && cr.highlightedTest) return 'active subtest-highlighted';
                                        if (type == 'row') return '';
                                        if (type == 'bar' && cr.isRegression) return 'bar-regression';
                                        if (type == 'bar' && cr.isImprovement) return 'bar-improvement';
                                        if (type == 'bar') return '';
                                        return cr.className;
                                    },

                                    // Aggregates two sets of values into a "comparison object" which is later used
                                    // to display a single line of comparison.
                                    // The result object has the following properties:
                                    // - .isEmpty: true if no data for either side.
                                    // If !isEmpty, for originalData/newData (if the data exists)
                                    // - .[original|new]Value      // Average of the values
                                    // - .[original|new]Stddev     // stddev
                                    // - .[original|new]StddevPct  // stddev as percentage of the average
                                    // - .[original|new]Runs       // Display data: number of runs and their values
                                    // If both originalData/newData exist, comparison data:
                                    // - .newIsBetter              // is new result better or worse (even if unsure)
                                    // - .isImprovement            // is new result better + we're confident about it
                                    // - .isRegression             // is new result worse + we're confident about it
                                    // - .delta
                                    // - .deltaPercentage
                                    // - .confidence               // t-test value
                                    // - .confidenceText           // 'low'/'med'/'high'
                                    // - .isMeaningful             // for highlighting - bool over t-test threshold
                                    // And some data to help formatting of the comparison:
                                    // - .className
                                    // - .magnitude
                                    // - .marginDirection
                                    getCounterMap: function getDisplayLineData(testName, originalData, newData) {

                                        function removeZeroes(values) {
                                            return _.filter(values, function(v){
                                                return !!v;
                                            });
                                        }

                                        function numericCompare(a, b) {
                                            return a < b ? -1 : a > b ? 1 : 0;
                                        }

                                        // Some statistics for a single set of values
                                        function analyzeSet(values) {
                                            var average = math.average(values),
                                                stddev = math.stddev(values, average);

                                            return {
                                                average: average,
                                                stddev: stddev,
                                                stddevPct: math.percentOf(stddev, average),

                                                // We use slice to keep the original values at their original order
                                                // in case the order is important elsewhere.
                                                runs: values.slice().sort(numericCompare)
                                            };
                                        }

                                        // Eventually the result object, after setting properties as required.
                                        var cmap = { isEmpty: true };

                                        // Talos tests may output 0 as an indication of failure. Ignore those results.
                                        if (originalData) {
                                            originalData.values = removeZeroes(originalData.values);
                                        }
                                        if (newData) {
                                            newData.values = removeZeroes(newData.values);
                                        }

                                        // It's possible to get an object with empty values, so check for that too.
                                        var hasOrig = originalData && originalData.values.length;
                                        var hasNew  = newData && newData.values.length;

                                        if (!hasOrig && !hasNew)
                                            return cmap; // No data for either side

                                        cmap.isEmpty = false;

                                        if (hasOrig) {
                                            var orig = analyzeSet(originalData.values);
                                            cmap.originalValue = orig.average;
                                            cmap.originalRuns = orig.runs;
                                            cmap.originalStddev = orig.stddev;
                                            cmap.originalStddevPct = orig.stddevPct;
                                        } else {
                                            cmap.originalRuns = [];
                                        }
                                        if (hasNew) {
                                            var newd = analyzeSet(newData.values);
                                            cmap.newValue = newd.average;
                                            cmap.newRuns = newd.runs;
                                            cmap.newStddev = newd.stddev;
                                            cmap.newStddevPct = newd.stddevPct;
                                        } else {
                                            cmap.newRuns = [];
                                        }

                                        if (!hasOrig || !hasNew)
                                            return cmap; // No comparison, just display for one side.

                                        // Compare the sides.
                                        // "Normal" tests are "lower is better". Reversed is.. reversed.
                                        cmap.delta = (cmap.newValue - cmap.originalValue);
                                        var newIsBetter = cmap.delta < 0; // New value is lower than orig value
                                        if (isReverseTest(testName))
                                            newIsBetter = !newIsBetter;

                                        cmap.deltaPercentage = math.percentOf(cmap.delta, cmap.originalValue);

                                        // arbitrary scale from 0-20% multiplied by 5, capped
                                        // at 100 (so 20% regression == 100% bad)
                                        cmap.magnitude = Math.min(Math.abs(cmap.deltaPercentage)*5, 100);
                                        cmap.newIsBetter = newIsBetter;

                                        var abs_t_value = Math.abs(math.t_test(originalData.values, newData.values, STDDEV_DEFAULT_FACTOR));
                                        cmap.className = getClassName(newIsBetter, cmap.originalValue, cmap.newValue, abs_t_value);
                                        cmap.confidence = abs_t_value;
                                        cmap.confidenceText = abs_t_value < T_VALUE_CARE_MIN ? "low" :
                                            abs_t_value < T_VALUE_CONFIDENT ? "med" :
                                            "high";

                                        cmap.isRegression = (cmap.className == 'compare-regression');
                                        cmap.isImprovement = (cmap.className == 'compare-improvement');
                                        cmap.isMeaningful = (cmap.className != "");
                                        cmap.isComplete = (cmap.originalRuns.length &&
                                                           cmap.newRuns.length);
                                        cmap.isConfident = ((cmap.originalRuns.length > 1 &&
                                                             cmap.newRuns.length > 1 &&
                                                             cmap.confidenceText === 'high') ||
                                                            (cmap.originalRuns.length >= 6 &&
                                                             cmap.newRuns.length >= 6));

                                        return cmap;
                                    },

                                    getInterval: function(oldTimestamp, newTimestamp) {
                                        var now = (new Date()).getTime() / 1000;
                                        var timeRange = Math.min(oldTimestamp, newTimestamp);
                                        timeRange = Math.round(now - timeRange);

                                        //now figure out which predefined set of data we can query from
                                        var timeRange = _.find(phTimeRanges, function(i) { return timeRange <= i.value; });
                                        return timeRange.value;
                                    },

                                    validateInput: function(originalProject, newProject,
                                                            originalRevision, newRevision,
                                                            originalSignature, newSignature) {

                                        var errors = [];
                                        if (!originalProject) errors.push('Missing input: originalProject');
                                        if (!newProject) errors.push('Missing input: newProject');
                                        if (!originalRevision) errors.push('Missing input: originalRevision');
                                        if (!newRevision) errors.push('Missing input: newRevision');

                                        if (originalSignature && newSignature) {
                                            if (!originalSignature) errors.push('Missing input: originalSignature');
                                            if (!newSignature) errors.push('Missing input: newSignature');
                                        }

                                        $http.get(thServiceDomain + '/api/repository/').then(function(response) {
                                            if (!_.find(response.data, {'name': originalProject}))
                                                errors.push("Invalid project, doesn't exist: " + originalProject);

                                            if (!_.find(response.data, {'name': newProject}))
                                                errors.push("Invalid project, doesn't exist: " + newProject);
                                        });
                                        return errors;
                                    },

                                    getResultsMap: function(projectName, seriesList, resultSetIds) {
                                        var url = thServiceDomain + '/api/project/' +
                                            projectName + '/performance/' +
                                            'data/?';
                                        url += _.map(resultSetIds, function(resultSetId) {
                                            return 'result_set_id=' + resultSetId;
                                        }).join('&');
                                        var resultsMap = {};
                                        return $q.all(_.chunk(seriesList, 20).map(function(seriesChunk) {
                                            var signatures = "";
                                            seriesChunk.forEach(function(series) {
                                                signatures += "&signatures=" + series.signature;
                                            });
                                            return $http.get(url + signatures).then(
                                                function(response) {
                                                    resultSetIds.forEach(function(resultSetId) {
                                                        if (resultsMap[resultSetId] === undefined) {
                                                            resultsMap[resultSetId] = {};
                                                        }
                                                        _.forIn(response.data, function(data, signature) {
                                                            // Aggregates data from the server on a single group of values which
                                                            // will be compared later to another group. Ends up with an object
                                                            // with description (name/platform) and values.
                                                            // The values are later processed at getCounterMap as the data arguments.
                                                            var values = [];
                                                            _.where(data, { result_set_id: resultSetId }).forEach(function(pdata) {
                                                                values.push(pdata.value);
                                                            });
                                                            var seriesData = _.find(seriesList, {'signature': signature});
                                                            if (seriesData) {
                                                                resultsMap[resultSetId][signature] = {
                                                                    platform: seriesData.platform,
                                                                    name: seriesData.name,
                                                                    values: values
                                                                };
                                                            }
                                                        });
                                                    });
                                                });
                                        })).then(function() {
                                            return resultsMap;
                                        });
                                    },
                                };
                            }]);


perf.factory('math', [ function() {

    function percentOf(a, b) {
        return b ? 100 * a / b : 0;
    }

    function average(values) {
        if (values.length < 1) {
            return 0;
        }

        return _.sum(values) / values.length;

    }

    function stddev(values, avg) {
        if (values.length < 2) {
            return undefined;
        }

        if (!avg)
            avg = average(values);

        return Math.sqrt(
            values.map(function (v) { return Math.pow(v - avg, 2); })
                .reduce(function (a, b) { return a + b; }) / (values.length - 1));
    }

    // If a set has only one value, assume average-ish-plus sddev, which
    // will manifest as smaller t-value the less items there are at the group
    // (so quite small for 1 value). This default value is a parameter.
    // C/T mean control/test group (in our case original/new data).
    function t_test(valuesC, valuesT, stddev_default_factor) {
        var lenC = valuesC.length,
            lenT = valuesT.length;

        // We must have at least one value at each set
        if (lenC < 1 || lenT < 1) {
            return 0;
        }

        var avgC = average(valuesC);
        var avgT = average(valuesT);

        // Use actual stddev if possible, or stddev_default_factor if one sample
        var stddevC = (lenC > 1 ? stddev(valuesC, avgC) : stddev_default_factor * avgC),
            stddevT = (lenT > 1 ? stddev(valuesT, avgT) : stddev_default_factor * avgT);

        // If one of the sets has only a single sample, assume its stddev is
        // the same as that of the other set (in percentage). If both sets
        // have only one sample, both will use stddev_default_factor.
        if (lenC == 1) {
            stddevC = valuesC[0] * stddevT / avgT;
        } else if (lenT == 1) {
            stddevT = valuesT[0] * stddevC / avgC;
        }

        var delta = avgT - avgC;
        var stdDiffErr = (
            Math.sqrt(
                stddevC * stddevC / lenC // control-variance / control-size
                    +
                    stddevT * stddevT / lenT // ...
            )
        );

        return delta / stdDiffErr;
    }

    return {
        percentOf: percentOf,
        average: average,
        stddev: stddev,
        t_test: t_test
    }; // 'math'
}]);


perf.filter('displayPrecision', function() {
    return function(input) {
        if (isNaN(input)) {
            return "N/A";
        }

        return parseFloat(input).toFixed(2);
    };
});
