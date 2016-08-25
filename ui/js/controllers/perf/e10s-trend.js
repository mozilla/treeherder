"use strict";

perf.value('defaultBaseDate', 604800);
perf.value('defaultNewDate', 0);
perf.value('defaultSampleSize', 604800);

perf.controller('e10sTrendCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$q', '$http', '$httpParamSerializer',
    'ThRepositoryModel', 'ThResultSetModel', 'PhSeries', 'PhCompare',
    'thServiceDomain', 'thDefaultRepo', 'phTimeRanges', 'defaultSampleSize',
    'phDatePoints', 'defaultBaseDate', 'defaultNewDate', 'phBlockers',
    function e10sTrendCtrl($state, $stateParams, $scope, $rootScope, $q, $http, $httpParamSerializer,
                      ThRepositoryModel, ThResultSetModel, PhSeries, PhCompare,
                      thServiceDomain, thDefaultRepo, phTimeRanges,
                      defaultSampleSize, phDatePoints, defaultBaseDate, defaultNewDate, phBlockers) {

        $scope.compareResults = {};
        $scope.titles = {};

        $scope.sampleSizes= phTimeRanges;
        $scope.datePoints = phDatePoints;
        $scope.selectedSampleSize = _.find($scope.sampleSizes, {
            value: ($stateParams.timerange) ? parseInt($stateParams.timerange) : defaultSampleSize
        });
        $scope.selectedBaseDate = _.find($scope.datePoints, {
            value: ($stateParams.basedate) ? parseInt($stateParams.basedate) : defaultBaseDate
        });
        $scope.selectedNewDate = _.find($scope.datePoints, {
            value: ($stateParams.newdate) ? parseInt($stateParams.newdate) : defaultNewDate
        });
        $scope.revision = $stateParams.revision;
        $scope.dataLoading = true;

        function displayResults(baseResults, newResults) {
            var match = {};

            $scope.compareResults = {};

            // create one object of common results
            Object.keys(baseResults).forEach(function(baseTestName) {
                baseResults[baseTestName].forEach(function(baseResult) {
                    if (newResults[baseTestName]) {
                        var newResult = newResults[baseTestName];
                        newResult = _.find(newResult, function(obj) { return obj.name === baseResult['name']; });
                        if (match) {
                            var trendResult = PhCompare.getTrendMap(baseTestName, baseResult, newResult);
                            if (!$scope.compareResults[baseTestName]) {
                                $scope.compareResults[baseTestName] = [{'baseResult': baseResult, 'newResult': newResult, 'trendResult': trendResult}];
                            } else {
                                $scope.compareResults[baseTestName].push({'baseResult': baseResult, 'newResult': newResult, 'trendResult': trendResult});
                            }
                        }
                    }
                });
            });

            $scope.testList = Object.keys($scope.compareResults);
        }

        function getDateRange(fromDateDelta, sampleSize) {
            // data start date is fromDateDelta (i.e. '1 week ago') minus sample size ('i.e. 'Last 7 days')
            // data end date is just the fromDateDelta (i.e. '1 week ago')
            var fromDateMs = Date.now() - (fromDateDelta * 1000);
            return {
                start: new Date(fromDateMs - (sampleSize * 1000)).toISOString().slice(0, -5),
                end: new Date(fromDateMs).toISOString().slice(0, -5)
            };
        }

        function getResults(dateRange, seriesList) {
            return new Promise(function(resolve) {
                var results = {};
                var platformList = [];
                var resultsMap = {
                    e10s: {},
                    base: {}
                };

                var seriesToMeasure = _.filter(seriesList, function(series) {
                    return series.options.indexOf('pgo') >= 0 ||
                        (series.platform === 'osx-10-10' &&
                         series.options.indexOf('opt') >= 0);
                });

                platformList = _.uniq(_.map(seriesToMeasure, 'platform'));
                // we just use the unadorned suite name to distinguish tests in this view
                // (so we can mash together pgo and opt)
                var testList = _.uniq(_.map(seriesToMeasure, 'testName'));

                $q.all(_.chunk(seriesToMeasure, 20).map(function(seriesChunk) {
                    var params = { signatures: _.map(seriesChunk, 'signature'),
                                   framework: 1,
                                   start_date: dateRange.start,
                                   end_date: dateRange.end };
                    return PhSeries.getSeriesData($scope.selectedRepo.name, params).then(function(seriesData) {
                        _.forIn(seriesData, function(data, signature) {
                            var series = _.find(seriesChunk, { signature: signature });
                            var type = (series.options.indexOf('e10s') >= 0) ? 'e10s' : 'base';
                            resultsMap[type][signature] = {
                                platform: series.platform,
                                name: series.testName,
                                lowerIsBetter: series.lowerIsBetter,
                                hasSubTests: series.hasSubtests,
                                option: series.options.indexOf('opt') >= 0 ? 'opt' : 'pgo',
                                values: _.map(data, 'value')
                            };
                        });
                    });
                })).then(function() {
                    testList.forEach(function(testName) {
                        $scope.titles[testName] = testName;
                        platformList.forEach(function(platform) {
                            var baseSig = _.find(Object.keys(resultsMap['base']), function(sig) {
                                return resultsMap['base'][sig].name === testName &&
                                    resultsMap['base'][sig].platform === platform;
                            });
                            var e10sSig = _.find(Object.keys(resultsMap['e10s']), function(sig) {
                                return resultsMap['e10s'][sig].name === testName &&
                                    resultsMap['e10s'][sig].platform === platform;
                            });
                            if (e10sSig && baseSig) {
                                var cmap = PhCompare.getCounterMap(
                                    testName, resultsMap['base'][baseSig],
                                    resultsMap['e10s'][e10sSig], phBlockers);
                                cmap.name = platform + ' ' + resultsMap['base'][baseSig].option;
                                if (resultsMap['base'][baseSig].hasSubTests) {
                                    var params = {
                                        repo: $scope.selectedRepo.name,
                                        basedate: $scope.selectedBaseDate.value,
                                        newdate: $scope.selectedNewDate.value,
                                        timerange: $scope.selectedSampleSize.value,
                                        baseSignature: baseSig,
                                        e10sSignature: e10sSig
                                    };
                                    cmap.links = [{
                                        title: 'subtests',
                                        href: 'perf.html#/e10s_trendsubtest?' + $httpParamSerializer(params)
                                    }];
                                    if (!results[testName]) {
                                        results[testName] = [cmap];
                                    } else {
                                        results[testName].push(cmap);
                                    }
                                }
                            }
                        });
                    });
                }).then(function() {
                    resolve(results);
                });
            });
        }

        function loadData() {
            $scope.dataLoading = true;

            // get the data ranges for both the 'base' and 'new' data sets
            var baseDateRange = getDateRange($scope.selectedBaseDate.value, $scope.selectedSampleSize.value);
            var newDateRange = getDateRange($scope.selectedNewDate.value, $scope.selectedSampleSize.value);

            var seriesInterval = $scope.selectedBaseDate.value > $scope.selectedNewDate.value ? $scope.selectedBaseDate.value :
                $scope.selectedNewDate.value;
            seriesInterval += $scope.selectedSampleSize.value;

            // get series list first
            PhSeries.getSeriesList(
                $scope.selectedRepo.name,
                { interval: seriesInterval,
                  subtests: 0,
                  framework: 1
                }).then(function(seriesList) {
                    // get test results for both data sets, and display
                    getResults(baseDateRange, seriesList).then(function(baseResults) {
                        getResults(newDateRange, seriesList).then(function(newResults) {
                            displayResults(baseResults, newResults);
                            $scope.dataLoading = false;
                            $scope.$apply();
                        });
                    });
                });
        }

        // set filter options
        $scope.filterOptions = {
            filter: $stateParams.filter || "",
            showOnlyImportant: Boolean($stateParams.showOnlyImportant !== undefined &&
                                       parseInt($stateParams.showOnlyImportant)),
            showOnlyConfident: Boolean($stateParams.showOnlyConfident !== undefined &&
                                       parseInt($stateParams.showOnlyConfident)),
            showOnlyBlockers: Boolean($stateParams.showOnlyBlockers !== undefined &&
                                      parseInt($stateParams.showOnlyBlockers))
        };

        function updateURL() {
            $state.transitionTo('e10s_trend', {
                filter: $scope.filterOptions.filter,
                showOnlyImportant: Boolean($scope.filterOptions.showOnlyImportant) ? 1 : undefined,
                showOnlyConfident: Boolean($scope.filterOptions.showOnlyConfident) ? 1 : undefined,
                showOnlyBlockers: Boolean($scope.filterOptions.showOnlyBlockers) ? 1 : undefined,
                repo: $scope.selectedRepo.name === thDefaultRepo ? undefined : $scope.selectedRepo.name,
                basedate: $scope.selectedBaseDate.value !== defaultBaseDate ? $scope.selectedBaseDate.value : undefined,
                newdate: $scope.selectedNewDate.value !== defaultNewDate ? $scope.selectedNewDate.value : undefined,
                timerange: ($scope.selectedSampleSize.value !== defaultSampleSize) ? $scope.selectedSampleSize.value : undefined
            }, {
                location: true,
                inherit: true,
                relative: $state.$current,
                notify: false
            });
        }

        ThRepositoryModel.load().then(function() {
            $scope.projects = $rootScope.repos;
            $scope.selectedRepo = _.findWhere($scope.projects, {
                name: $stateParams.repo ? $stateParams.repo : thDefaultRepo
            });

            $scope.$watchGroup(['filterOptions.filter',
                                'filterOptions.showOnlyImportant',
                                'filterOptions.showOnlyConfident',
                                'filterOptions.showOnlyBlockers'],
                               updateURL);

            $scope.globalOptionsChanged = function(selectedRepo, selectedBaseDate,
                selectedNewDate, selectedSampleSize) {
                // parameters because angular assigns them to a different
                // scope (*sigh*) and I don't know of any other workaround
                $scope.selectedRepo = selectedRepo;
                $scope.selectedBaseDate = selectedBaseDate;
                $scope.selectedNewDate = selectedNewDate;
                $scope.selectedSampleSize = selectedSampleSize;
                updateURL();
                loadData();
            };

            loadData();
        });
    }

]);

perf.controller('e10sTrendSubtestCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$q', '$http', '$httpParamSerializer',
    'ThRepositoryModel', 'ThResultSetModel', 'PhSeries', 'PhCompare',
    'thServiceDomain', 'thDefaultRepo', 'phTimeRanges', 'defaultSampleSize',
    'phDatePoints', 'defaultBaseDate', 'defaultNewDate', 'phBlockers',
    function e10sTrendCtrl($state, $stateParams, $scope, $rootScope, $q, $http, $httpParamSerializer,
                      ThRepositoryModel, ThResultSetModel, PhSeries, PhCompare,
                      thServiceDomain, thDefaultRepo, phTimeRanges,
                      defaultSampleSize, phDatePoints, defaultBaseDate, defaultNewDate) {

        var baseSignature = $stateParams.baseSignature;
        var e10sSignature = $stateParams.e10sSignature;

        $scope.compareResults = {};
        $scope.titles = {};

        $scope.sampleSizes= phTimeRanges;
        $scope.datePoints = phDatePoints;
        $scope.selectedSampleSize = _.find($scope.sampleSizes, {
            value: ($stateParams.timerange) ? parseInt($stateParams.timerange) : defaultSampleSize
        });
        $scope.selectedBaseDate = _.find($scope.datePoints, {
            value: ($stateParams.basedate) ? parseInt($stateParams.basedate) : defaultBaseDate
        });
        $scope.selectedNewDate = _.find($scope.datePoints, {
            value: ($stateParams.newdate) ? parseInt($stateParams.newdate) : defaultNewDate
        });
        $scope.revision = $stateParams.revision;
        $scope.dataLoading = true;

        function displayResults(baseResults, newResults) {
            var match = {};

            $scope.compareResults = {};

            // create one object of common results
            Object.keys(baseResults).forEach(function(baseTestName) {
                baseResults[baseTestName].forEach(function(baseResult) {
                    if (newResults[baseTestName]) {
                        var newResult = newResults[baseTestName];
                        newResult = _.find(newResult, function(obj) { return obj.name === baseResult['name']; });
                        if (match) {
                            var trendResult = PhCompare.getTrendMap(baseTestName, baseResult, newResult);
                            if (!$scope.compareResults[baseTestName]) {
                                $scope.compareResults[baseTestName] = [{'baseResult': baseResult, 'newResult': newResult, 'trendResult': trendResult}];
                            } else {
                                $scope.compareResults[baseTestName].push({'baseResult': baseResult, 'newResult': newResult, 'trendResult': trendResult});
                            }
                        }
                    }
                });
            });

            $scope.testList = Object.keys($scope.compareResults);
        }

        function getDateRange(fromDateDelta, sampleSize) {
            // data start date is fromDateDelta (i.e. '1 week ago') minus sample size ('i.e. 'Last 7 days')
            // data end date is just the fromDateDelta (i.e. '1 week ago')
            var fromDateMs = Date.now() - (fromDateDelta * 1000);
            return {
                start: new Date(fromDateMs - (sampleSize * 1000)).toISOString().slice(0, -5),
                end: new Date(fromDateMs).toISOString().slice(0, -5)
            };
        }

        function getResults(dateRange, seriesList) {
            return new Promise(function(resolve) {
                var results = {};
                var resultsMap = {
                    e10s: {},
                    base: {}
                };

                var summaryTestName = seriesList[0].platform + ": " + seriesList[0].suite;
                $scope.titles[summaryTestName] = summaryTestName;

                var seriesToMeasure = _.filter(seriesList, function(series) {
                    return series.options.indexOf('pgo') >= 0 ||
                        (series.platform === 'osx-10-10' &&
                         series.options.indexOf('opt') >= 0);
                });

                $q.all(_.chunk(seriesToMeasure, 20).map(function(seriesChunk) {
                    var params = { signatures: _.map(seriesChunk, 'signature'),
                                   framework: 1,
                                   start_date: dateRange.start,
                                   end_date: dateRange.end };
                    return PhSeries.getSeriesData($scope.selectedRepo.name, params).then(function(seriesData) {
                        _.forIn(seriesData, function(data, signature) {
                            var series = _.find(seriesChunk, { signature: signature });
                            var type = (series.options.indexOf('e10s') >= 0) ? 'e10s' : 'base';
                            resultsMap[type][signature] = {
                                platform: series.platform,
                                name: series.testName,
                                lowerIsBetter: series.lowerIsBetter,
                                hasSubTests: series.hasSubtests,
                                option: series.options.indexOf('opt') >= 0 ? 'opt' : 'pgo',
                                values: _.map(data, 'value')
                            };
                        });
                    });
                })).then(function() {
                    var subtestNames = _.map(resultsMap['base'],
                                             function(results) {
                                                 return results.name;
                                             });
                    _.forEach(subtestNames, function(subtestName) {
                        var baseSig = _.find(Object.keys(resultsMap['base']), function(sig) {
                            return resultsMap['base'][sig].name === subtestName;
                        });
                        var e10sSig = _.find(Object.keys(resultsMap['e10s']), function(sig) {
                            return resultsMap['e10s'][sig].name === subtestName;
                        });
                        if (e10sSig && baseSig) {
                            var cmap = PhCompare.getCounterMap(
                                subtestName, resultsMap['base'][baseSig],
                                resultsMap['e10s'][e10sSig]);
                            cmap.name = subtestName;
                            if (!results[summaryTestName]) {
                                results[summaryTestName] = [cmap];
                            } else {
                                results[summaryTestName].push(cmap);
                            }
                        }
                    });
                }).then(function() {
                    resolve(results);
                });
            });
        }

        function loadData() {
            $scope.dataLoading = true;

            // get the data ranges for both the 'base' and 'new' data sets
            var baseDateRange = getDateRange($scope.selectedBaseDate.value, $scope.selectedSampleSize.value);
            var newDateRange = getDateRange($scope.selectedNewDate.value, $scope.selectedSampleSize.value);

            var seriesInterval = $scope.selectedBaseDate.value > $scope.selectedNewDate.value ? $scope.selectedBaseDate.value :
                $scope.selectedNewDate.value;
            seriesInterval += $scope.selectedSampleSize.value;

            // get series list first
            PhSeries.getSeriesList(
                $scope.selectedRepo.name,
                { interval: seriesInterval,
                  parent_signature: [ baseSignature, e10sSignature ],
                  framework: 1
                }).then(function(seriesList) {
                    // get test results for both data sets, and display
                    getResults(baseDateRange, seriesList).then(function(baseResults) {
                        getResults(newDateRange, seriesList).then(function(newResults) {
                            displayResults(baseResults, newResults);
                            $scope.dataLoading = false;
                            $scope.$apply();
                        });
                    });
                });
        }

        // set filter options
        $scope.filterOptions = {
            filter: $stateParams.filter || "",
            showOnlyImportant: Boolean($stateParams.showOnlyImportant !== undefined &&
                                       parseInt($stateParams.showOnlyImportant)),
            showOnlyConfident: Boolean($stateParams.showOnlyConfident !== undefined &&
                                       parseInt($stateParams.showOnlyConfident)),
            showOnlyBlockers: Boolean($stateParams.showOnlyBlockers !== undefined &&
                                      parseInt($stateParams.showOnlyBlockers))
        };

        function updateURL() {
            $state.transitionTo('e10s_trendsubtest', {
                filter: $scope.filterOptions.filter,
                showOnlyImportant: Boolean($scope.filterOptions.showOnlyImportant) ? 1 : undefined,
                showOnlyConfident: Boolean($scope.filterOptions.showOnlyConfident) ? 1 : undefined,
                showOnlyBlockers: Boolean($scope.filterOptions.showOnlyBlockers) ? 1 : undefined,
                repo: $scope.selectedRepo.name === thDefaultRepo ? undefined : $scope.selectedRepo.name,
                basedate: $scope.selectedBaseDate.value !== defaultBaseDate ? $scope.selectedBaseDate.value : undefined,
                newdate: $scope.selectedNewDate.value !== defaultNewDate ? $scope.selectedNewDate.value : undefined,
                timerange: ($scope.selectedSampleSize.value !== defaultSampleSize) ? $scope.selectedSampleSize.value : undefined
            }, {
                location: true,
                inherit: true,
                relative: $state.$current,
                notify: false
            });
        }

        ThRepositoryModel.load().then(function() {
            $scope.projects = $rootScope.repos;
            $scope.selectedRepo = _.findWhere($scope.projects, {
                name: $stateParams.repo ? $stateParams.repo : thDefaultRepo
            });


            $scope.$watchGroup(['filterOptions.filter',
                                'filterOptions.showOnlyImportant',
                                'filterOptions.showOnlyConfident',
                                'filterOptions.showOnlyBlockers'],
                               updateURL);

            $scope.globalOptionsChanged = function(selectedRepo, selectedBaseDate,
                selectedNewDate, selectedSampleSize) {
                // parameters because angular assigns them to a different
                // scope (*sigh*) and I don't know of any other workaround
                $scope.selectedRepo = selectedRepo;
                $scope.selectedBaseDate = selectedBaseDate;
                $scope.selectedNewDate = selectedNewDate;
                $scope.selectedSampleSize = selectedSampleSize;
                updateURL();
                loadData();
            };

            loadData();
        });
    }

]);

