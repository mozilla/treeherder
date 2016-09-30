"use strict";

treeherder.factory('PhCompare', [
    '$q', '$http', '$httpParamSerializer', 'thServiceDomain', 'PhSeries', 'math', 'phTimeRanges',
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
                var phTimeRange = _.find(phTimeRanges, function(i) { return timeRange <= i.value; });
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
            },

            // Compares baseData and newData and returns object of results
            // The result object has the following properties:
            // - .isEmpty: true if no data for either side.
            // If both originalData/newData exist, comparison data:
            // - .newIsBetter              // is new result better or worse (even if unsure)
            // - .isImprovement            // is new result better + we're confident about it
            // - .isRegression             // is new result worse + we're confident about it
            // - .isBlocker                // new result matches "blocker" criteria
            // - .delta
            // - .deltaPercentage
            // - .isMeaningful             // for highlighting - bool over t-test threshold
            // And some data to help formatting of the comparison:
            // - .className
            // - .magnitude
            getTrendMap: function getDisplayLineData(testName, baseData, newData) {

                // Eventually the result object, after setting properties as required.
                var trendMap = { isEmpty: true };

                // It's possible to get an object with empty values, so check for that too.
                if (!baseData.delta && !newData.delta)
                    return trendMap; // No data for either side

                trendMap.isEmpty = false;
                trendMap.name = baseData.name;

                // Compare the sides
                trendMap.delta = (newData.delta - baseData.delta);
                trendMap.newIsBetter = (baseData.lowerIsBetter && trendMap.delta < 0) ||
                    (!baseData.lowerIsBetter && trendMap.delta > 0);

                // delta percentage (for display)
                trendMap.deltaPercentage = math.percentOf(trendMap.delta, baseData.delta);

                // is meaningful (show only important) if change is > 2%
                trendMap.isMeaningful = (Math.abs(trendMap.deltaPercentage)) > 2.0;

                // mark not confident if either base or new data results are not confident
                trendMap.isConfident = (baseData.isConfident === true && newData.isConfident === true);

                // mark is blocking if either base or new data resuls are maked as blocking
                trendMap.isBlocker = (baseData.isBlocker === true || newData.isBlocker === true);

                // arbitrary scale from 0-20% multiplied by 5, capped
                // at 100 (so 20% regression === 100% bad)
                trendMap.magnitude = Math.min(Math.abs(trendMap.deltaPercentage)*5, 100);

                return trendMap;
            }
        };
    }]);
