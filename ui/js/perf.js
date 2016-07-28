"use strict";

var perf = angular.module("perf", ['ui.router', 'ui.bootstrap', 'treeherder', 'angular-clipboard']);

treeherder.factory('PhSeries', ['$http', 'thServiceDomain', 'ThOptionCollectionModel', function($http, thServiceDomain, ThOptionCollectionModel) {

    var _getTestName = function(signatureProps, displayOptions) {
        var suiteName = signatureProps.suite;
        var testName = signatureProps.test;

        if (! (displayOptions && displayOptions.abbreviate)) {
            // "summary" may appear for non-abbreviated output
            testName = testName || "summary";
        }

        return suiteName === testName ? suiteName : suiteName + " " + testName;
    };

    var _getSeriesOptions = function(signatureProps, optionCollectionMap) {
        var options = [ optionCollectionMap[signatureProps.option_collection_hash] ];
        if (signatureProps.test_options) {
            options = options.concat(signatureProps.test_options);
        }
        return options;
    };

    var _getSeriesName = function(signatureProps, optionCollectionMap,
                                  displayOptions) {
        var platform = signatureProps.machine_platform;
        var name = _getTestName(signatureProps);

        if (displayOptions && displayOptions.includePlatformInName) {
            name = name + " " + platform;
        }
        var options = _getSeriesOptions(signatureProps, optionCollectionMap);
        return name + " " + options.join(" ");
    };

    var _getSeriesSummary = function(projectName, signature, signatureProps,
                                     optionCollectionMap) {
        var platform = signatureProps.machine_platform;
        var options = _getSeriesOptions(signatureProps, optionCollectionMap);

        return {
            id: signatureProps['id'],
            name: _getSeriesName(signatureProps, optionCollectionMap),
            testName: _getTestName(signatureProps), // unadorned with platform/option info
            suite: signatureProps['suite'],
            test: signatureProps['test'] || null,
            signature: signature,
            hasSubtests: signatureProps['has_subtests'] || false,
            parentSignature: signatureProps['parent_signature'] || null,
            projectName: projectName,
            platform: platform,
            options: options,
            frameworkId: signatureProps.framework_id,
            lowerIsBetter: (signatureProps.lower_is_better === undefined ||
                            signatureProps.lower_is_better)
        };
    };

    return {
        getTestName: _getTestName,
        getSeriesName: _getSeriesName,
        getSeriesList: function(projectName, params) {
            return ThOptionCollectionModel.getMap().then(function(optionCollectionMap) {
                return $http.get(thServiceDomain + '/api/project/' + projectName +
                                 '/performance/signatures/', { params: params }).then(function(response) {
                                     return _.map(response.data, function(signatureProps, signature) {
                                         return _getSeriesSummary(projectName, signature,
                                                                  signatureProps,
                                                                  optionCollectionMap);
                                     });
                                 });
            });
        },
        getPlatformList: function(projectName, params) {
            return $http.get(thServiceDomain + '/api/project/' + projectName +
                             '/performance/platforms/', { params: params }).then(
                                 function(response) {
                                     return response.data;
                                 });
        },
        getSeriesData: function(projectName, params) {
            return $http.get(thServiceDomain + '/api/project/' + projectName + '/performance/data/',
                             { params: params }).then(function(response) {
                                 if(response.data) {
                                     return response.data;
                                 } else {
                                     return $q.reject("No data been found for job id " +
                                                      jobId + " in project " + projectName);
                                 }
                             });
        }
    };
}]);

perf.factory('PhCompare', [ '$q', '$http', '$httpParamSerializer', 'thServiceDomain', 'PhSeries',
                            'math', 'phTimeRanges',
                            function($q, $http, $httpParamSerializer, thServiceDomain, PhSeries, math, phTimeRanges) {

                                // Used for t_test: default stddev if both sets have only a single value - 15%.
                                // Should be rare case and it's unreliable, but at least have something.
                                var STDDEV_DEFAULT_FACTOR = 0.15;

                                var RATIO_CARE_MIN = 1.02; // We don't care about less than ~2% diff
                                var T_VALUE_CARE_MIN = 3; // Anything below this is "low" in confidence
                                var T_VALUE_CONFIDENT = 5; // Anything above this is "high" in confidence

                                function getClassName(newIsBetter, oldVal, newVal, abs_t_value) {
                                    // NOTE: we care about general ratio rather than how much is new compared
                                    // to old - this could end up with slightly higher or lower threshold
                                    // in practice than indicated by DIFF_CARE_MIN. E.g.:
                                    // - If old is 10 and new is 5, then new = old -50%
                                    // - If old is 5 and new is 10, then new = old + 100%
                                    // And if the threshold was 75% then one would matter and the other wouldn't.
                                    // Instead, we treat both cases as 2.0 (general ratio), and both would matter
                                    // if our threshold was 75% (i.e. DIFF_CARE_MIN = 1.75).
                                    if (!oldVal || !newVal) {
                                        // handle null case
                                        return "";
                                    }
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
                                        if (type === 'row' && cr.highlightedTest) return 'active subtest-highlighted';
                                        if (type === 'row') return '';
                                        if (type === 'bar' && cr.isRegression) return 'bar-regression';
                                        if (type === 'bar' && cr.isImprovement) return 'bar-improvement';
                                        if (type === 'bar') return '';
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
                                    // - .isBlocker                // new result matches "blocker" criteria
                                    // - .delta
                                    // - .deltaPercentage
                                    // - .confidence               // t-test value
                                    // - .confidenceText           // 'low'/'med'/'high'
                                    // - .confidenceTextLong       // more explanation on what confidenceText means
                                    // - .isMeaningful             // for highlighting - bool over t-test threshold
                                    // And some data to help formatting of the comparison:
                                    // - .className
                                    // - .magnitude
                                    // - .marginDirection
                                    getCounterMap: function getDisplayLineData(testName, originalData, newData, blockerCriteria) {

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

                                        // It's possible to get an object with empty values, so check for that too.
                                        var hasOrig = originalData && originalData.values.length;
                                        var hasNew = newData && newData.values.length;

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

                                        // keep the framework id so we can filter by that later, if necessary
                                        cmap.frameworkId = originalData.frameworkId;

                                        // Compare the sides.
                                        // Normally tests are "lower is better", can be over-ridden with a series option
                                        cmap.delta = (cmap.newValue - cmap.originalValue);
                                        cmap.newIsBetter = (originalData.lowerIsBetter && cmap.delta < 0) ||
                                            (!originalData.lowerIsBetter && cmap.delta > 0);

                                        // delta percentage (for display)
                                        cmap.deltaPercentage = math.percentOf(cmap.delta, cmap.originalValue);
                                        // arbitrary scale from 0-20% multiplied by 5, capped
                                        // at 100 (so 20% regression === 100% bad)
                                        cmap.magnitude = Math.min(Math.abs(cmap.deltaPercentage)*5, 100);

                                        var abs_t_value = Math.abs(math.t_test(originalData.values, newData.values, STDDEV_DEFAULT_FACTOR));
                                        cmap.className = getClassName(cmap.newIsBetter, cmap.originalValue, cmap.newValue, abs_t_value);
                                        cmap.confidence = abs_t_value;
                                        cmap.confidenceTextLong = "Result of running t-test on base versus new result distribution: ";
                                        if (abs_t_value < T_VALUE_CARE_MIN) {
                                            cmap.confidenceText = "low";
                                            cmap.confidenceTextLong += "A value of 'low' suggests less confidence that there is a sustained, significant change between the two revisions.";
                                        } else if (abs_t_value < T_VALUE_CONFIDENT) {
                                            cmap.confidenceText = "med";
                                            cmap.confidenceTextLong += "A value of 'med' indicates uncertainty that there is a significant change. If you haven't already, consider retriggering the job to be more sure.";
                                        } else {
                                            cmap.confidenceText = "high";
                                            cmap.confidenceTextLong += "A value of 'high' indicates more confidence that there is a significant change, however you should check the historical record for the test by looking at the graph to be more sure (some noisy tests can provide inconsistent results).";
                                        }
                                        cmap.isRegression = (cmap.className === 'compare-regression');
                                        cmap.isImprovement = (cmap.className === 'compare-improvement');
                                        if (!_.isUndefined(blockerCriteria) &&
                                            !_.isUndefined(blockerCriteria[testName]) &&
                                            cmap.isRegression &&
                                            cmap.deltaPercentage > blockerCriteria[testName]) {
                                            cmap.isBlocker = true;
                                        } else {
                                            cmap.isBlocker = false;
                                        }
                                        cmap.isMeaningful = (cmap.className !== "");
                                        cmap.isComplete = (cmap.originalRuns.length &&
                                                           cmap.newRuns.length);
                                        cmap.isConfident = ((cmap.originalRuns.length > 1 &&
                                                             cmap.newRuns.length > 1 &&
                                                             abs_t_value >= T_VALUE_CONFIDENT) ||
                                                            (cmap.originalRuns.length >= 6 &&
                                                             cmap.newRuns.length >= 6 &&
                                                             abs_t_value >= T_VALUE_CARE_MIN));
                                        cmap.needsMoreRuns = (cmap.isComplete && !cmap.isConfident &&
                                                              cmap.originalRuns.length < 6);

                                        return cmap;
                                    },

                                    getInterval: function(oldTimestamp, newTimestamp) {
                                        var now = (new Date()).getTime() / 1000;
                                        var timeRange = Math.min(oldTimestamp, newTimestamp);
                                        timeRange = Math.round(now - timeRange);

                                        //now figure out which predefined set of data we can query from
                                        phTimeRange = _.find(phTimeRanges, function(i) { return timeRange <= i.value; });
                                        return phTimeRange.value;
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
                                        var resultsMap = {};
                                        return $q.all(_.chunk(seriesList, 20).map(function(seriesChunk) {
                                            return PhSeries.getSeriesData(
                                                projectName, {
                                                    signatures: _.pluck(seriesChunk, 'signature'),
                                                    framework: _.uniq(_.pluck(seriesChunk, 'frameworkId')),
                                                    result_set_id: resultSetIds }
                                            ).then(function(seriesData) {
                                                resultSetIds.forEach(function(resultSetId) {
                                                    if (resultsMap[resultSetId] === undefined) {
                                                        resultsMap[resultSetId] = {};
                                                    }
                                                    _.forIn(seriesData, function(data, signature) {
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
                                                                lowerIsBetter: seriesData.lowerIsBetter,
                                                                frameworkId: seriesData.frameworkId,
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
                                    getGraphsLink: function(seriesList, resultSets) {
                                        var graphsLink = 'perf.html#/graphs?' + $httpParamSerializer({
                                            series: _.map(seriesList, function(series) {
                                                return [
                                                    series.projectName,
                                                    series.signature, 1,
                                                    series.frameworkId ];
                                            }),
                                            highlightedRevisions: _.map(resultSets, function(resultSet) {
                                                return resultSet.revision.slice(0, 12);
                                            })
                                        });

                                        if (resultSets) {
                                            graphsLink += '&timerange=' + _.max(
                                                _.map(resultSets,
                                                      function(resultSet) {
                                                          return _.find(
                                                              _.pluck(phTimeRanges, 'value'),
                                                              function(t) {
                                                                  return ((Date.now() / 1000.0) -
                                                                          resultSet.push_timestamp) < t;
                                                              });
                                                      }));
                                        }
                                        return graphsLink;
                                    }

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
        if (lenC === 1) {
            stddevC = valuesC[0] * stddevT / avgT;
        } else if (lenT === 1) {
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
