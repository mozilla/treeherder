"use strict";

perf.value('e10sDefaultTimeRange', 86400 * 2);

perf.controller('e10sCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$q', '$http',
    'ThRepositoryModel', 'PhSeries', 'PhCompare',
    'thServiceDomain', 'thDefaultRepo', 'phTimeRanges', 'e10sDefaultTimeRange',
    function e10sCtrl($state, $stateParams, $scope, $rootScope, $q, $http,
                      ThRepositoryModel, PhSeries, PhCompare, thServiceDomain,
                      thDefaultRepo, phTimeRanges, e10sDefaultTimeRange) {
        var blockers = {
            "cart summary": 2.0,
            "damp summary": 2.0,
            "dromaeo_css summary": 2.0,
            "dromaeo_dom summary": 2.0,
            "glterrain summary": 5.0,
            "kraken summary": 2.0,
            "sessionrestore": 5.0,
            "sessionrestore_no_auto_restore": 5.0,
            "tart summary": 5.0,
            "tcanvasmark summary": 5.0,
            "tp5o % Processor Time": 2.0,
            "tp5o Main_RSS": 2.0,
            "tp5o Modified Page List Bytes": 2.0,
            "tp5o Private Bytes": 2.0,
            "tp5o XRes": 2.0,
            "tp5o responsiveness": 2.0,
            "tp5o summary": 5.0,
            "tp5o_scroll summary": 2.0,
            "tpaint": 5.0,
            "tps summary": 5.0,
            "tresize": 5.0,
            "ts_paint": 2.0,
            "tscrollx": 2.0,
            "tsvgr_opacity summary": 5.0,
            "tsvgx summary": 5.0
        };

        $scope.dataLoading = true;
        $scope.timeRanges = phTimeRanges;
        $scope.selectedTimeRange = _.find($scope.timeRanges, {
            value: ($stateParams.timerange) ? parseInt($stateParams.timerange) : e10sDefaultTimeRange
        });

        function loadData() {
            var resultsMap = {
                e10s: {},
                base: {}
            };
            $scope.testList = [];
            $scope.dataLoading = true;
            $scope.compareResults = {};
            $scope.titles = {};

            PhSeries.getSeriesList(
                $scope.selectedRepo.name,
                { interval: $scope.selectedTimeRange.value, subtests: 0 }).then(function(seriesList) {
                    var seriesToMeasure = _.filter(seriesList, function(series) {
                        return series.options.indexOf('pgo') >= 0 ||
                            (series.platform === 'osx-10-10' &&
                             series.options.indexOf('opt') >= 0);
                    });
                    $scope.platformList = _.uniq(_.map(seriesToMeasure, 'platform'));
                    // we just use the unadorned suite name to distinguish tests in this view
                    // (so we can mash together pgo and opt)
                    $scope.testList = _.uniq(_.map(seriesToMeasure, 'testName'));

                    $q.all(_.chunk(seriesToMeasure, 20).map(function(seriesChunk) {
                        return PhSeries.getSeriesData($scope.selectedRepo.name, {
                            interval: $scope.selectedTimeRange.value,
                            signatures: _.map(seriesChunk, 'signature')
                        }).then(function(seriesData) {
                            _.forIn(seriesData, function(data, signature) {
                                var series = _.find(seriesChunk, { signature: signature });
                                var type = (series.options.indexOf('e10s') >= 0) ? 'e10s' : 'base';
                                resultsMap[type][signature] = {
                                    platform: series.platform,
                                    name: series.testName,
                                    lowerIsBetter: series.lowerIsBetter,
                                    hasSubTests: series.hasSubtests,
                                    values: _.map(data, 'value')
                                };
                            });
                        });
                    })).then(function() {
                        $scope.dataLoading = false;
                        $scope.testList.forEach(function(testName) {
                            $scope.titles[testName] = testName;
                            $scope.platformList.forEach(function(platform) {
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
                                        resultsMap['e10s'][e10sSig], blockers);
                                    cmap.name = platform + ' ' + (platform === 'osx-10-10' ? 'opt' : 'pgo');
                                    cmap.links = [{
                                        title: 'graph',
                                        href: 'perf.html#/graphs?' + _.map([baseSig, e10sSig],
                                                                           function(sig) {
                                                                               return 'series=[' + [ $scope.selectedRepo.name, sig, 1 ];
                                                                           }).join('&') + ']'
                                    }];
                                    if (resultsMap['base'][baseSig].hasSubTests) {
                                        var params = _.map([
                                            ['baseSignature', baseSig],
                                            ['e10sSignature', e10sSig],
                                            ['repo', $scope.selectedRepo.name],
                                            ['timerange', $scope.selectedTimeRange.value]
                                        ], function(kv) { return kv[0] + '=' + kv[1]; }).join('&');
                                        cmap.links.push({
                                            title: 'subtests',
                                            href: 'perf.html#/e10s_comparesubtest?' + params
                                        });
                                    }
                                    if (!$scope.compareResults[testName]) {
                                        $scope.compareResults[testName] = [cmap];
                                    } else {
                                        $scope.compareResults[testName].push(cmap);
                                    }
                                }
                            });
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
            $state.transitionTo('e10s', {
                filter: $scope.filterOptions.filter,
                showOnlyImportant: Boolean($scope.filterOptions.showOnlyImportant) ? 1 : undefined,
                showOnlyConfident: Boolean($scope.filterOptions.showOnlyConfident) ? 1 : undefined,
                showOnlyBlockers: Boolean($scope.filterOptions.showOnlyBlockers) ? 1 : undefined,
                repo: $scope.selectedRepo.name === thDefaultRepo ? undefined : $scope.selectedRepo.name,
                timerange: ($scope.selectedTimeRange.value !== e10sDefaultTimeRange) ? $scope.selectedTimeRange.value : undefined
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

            $scope.globalOptionsChanged = function(selectedRepo, selectedTimeRange) {
                // we pass `selectedRepo` and `selectedTimeRange` as
                // parameters, because angular assigns them to a different
                // scope (*sigh*) and I don't know of any other workaround
                $scope.selectedRepo = selectedRepo;
                $scope.selectedTimeRange = selectedTimeRange;
                updateURL();
                loadData();
            };

            loadData();
        });
    }

]);

perf.controller('e10sSubtestCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$q', '$http',
    'ThRepositoryModel', 'PhSeries', 'PhCompare',
    'thServiceDomain', 'thDefaultRepo', 'phTimeRanges', 'e10sDefaultTimeRange',
    function($state, $stateParams, $scope, $rootScope, $q, $http,
             ThRepositoryModel, PhSeries, PhCompare, thServiceDomain,
             thDefaultRepo, phTimeRanges, e10sDefaultTimeRange) {

        var baseSignature = $stateParams.baseSignature;
        var e10sSignature = $stateParams.e10sSignature;

        $scope.dataLoading = true;
        $scope.timeRanges = phTimeRanges;
        $scope.selectedTimeRange = _.find(phTimeRanges, {
            value: ($stateParams.timerange) ? parseInt($stateParams.timerange) : e10sDefaultTimeRange
        });

        function loadData() {
            $scope.testList = [];
            $scope.dataLoading = true;
            $scope.compareResults = {};
            $scope.titles = {};

            var resultsMap = {
                e10s: {},
                base: {}
            };

            // get base data
            PhSeries.getSeriesList($scope.selectedRepo.name, { signature: baseSignature }).then(function(seriesList) {
                var summaryTestName = seriesList[0].platform + ": " + seriesList[0].suite;
                $scope.testList = [summaryTestName];
                $scope.titles[summaryTestName] = summaryTestName;

                PhSeries.getSeriesList($scope.selectedRepo.name, {
                    interval: $scope.selectedTimeRange.value,
                    parent_signature: [ baseSignature, e10sSignature ]
                }).then(function(seriesList) {
                    return $q.all(_.chunk(seriesList, 20).map(function(seriesChunk) {
                        return PhSeries.getSeriesData($scope.selectedRepo.name, {
                            interval: $scope.selectedTimeRange.value,
                            signatures: _.map(seriesChunk, 'signature')
                        }).then(function(seriesData) {
                            _.forIn(seriesData, function(data, signature) {
                                var series = _.find(seriesList, { signature: signature });
                                var type = (series.options.indexOf('e10s') >= 0) ? 'e10s' : 'base';
                                resultsMap[type][signature] = {
                                    platform: series.platform,
                                    suite: series.suite,
                                    name: PhSeries.getTestName(series),
                                    lowerIsBetter: series.lowerIsBetter,
                                    values: _.map(data, 'value')
                                };
                            });
                        });
                    })).then(function() {
                        $scope.dataLoading = false;
                        var subtestNames = _.map(resultsMap['base'], function(results, signature) {
                            return results.name;
                        });
                        _.forEach(subtestNames, function(subtestName) {
                            var baseSig = _.find(Object.keys(resultsMap['base']), function (sig) {
                                return resultsMap['base'][sig].name === subtestName;
                            });
                            var e10sSig = _.find(Object.keys(resultsMap['e10s']), function (sig) {
                                return resultsMap['e10s'][sig].name === subtestName;
                            });
                            if (e10sSig && baseSig) {
                                var cmap = PhCompare.getCounterMap(
                                    subtestName, resultsMap['base'][baseSig],
                                    resultsMap['e10s'][e10sSig]);
                                cmap.name = subtestName;
                                cmap.links = [{
                                    title: 'graph',
                                    href: 'perf.html#/graphs?' + _.map([baseSig, e10sSig],
                                                                       function(sig) {
                                                                           return 'series=[' + [ $scope.selectedRepo.name, sig, 1 ];
                                                                       }).join('&') + ']'
                                }];
                                if (!$scope.compareResults[summaryTestName]) {
                                    $scope.compareResults[summaryTestName] = [cmap];
                                } else {
                                    $scope.compareResults[summaryTestName].push(cmap);
                                }
                            }
                        });
                    });
                });
            });
        }

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
            $state.transitionTo('e10s_comparesubtest', {
                filter: $scope.filterOptions.filter,
                showOnlyImportant: Boolean($scope.filterOptions.showOnlyImportant) ? 1 : undefined,
                showOnlyConfident: Boolean($scope.filterOptions.showOnlyConfident) ? 1 : undefined,
                repo: $scope.selectedRepo.name === thDefaultRepo ? undefined : $scope.selectedRepo.name,
                timerange: ($scope.selectedTimeRange.value !== e10sDefaultTimeRange) ? $scope.selectedTimeRange.value : undefined
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
                                'filterOptions.showOnlyConfident'],
                               updateURL);

            $scope.globalOptionsChanged = function(selectedRepo, selectedTimeRange) {
                // we pass `selectedRepo` and `selectedTimeRange` as
                // parameter, because angular assigns them to a different
                // scope (*sigh*) and I don't know of any other workaround
                $scope.selectedRepo = selectedRepo;
                $scope.selectedTimeRange = selectedTimeRange;
                updateURL();
                loadData();
            };

            loadData();
        });
    }
]);
