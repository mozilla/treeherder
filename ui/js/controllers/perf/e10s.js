"use strict";

perf.value('e10sDefaultTimeRange', 86400 * 2);

perf.controller('e10sCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$q', '$http',
    'ThRepositoryModel', 'ThOptionCollectionModel', 'PhSeries', 'PhCompare',
    'thServiceDomain', 'thDefaultRepo', 'phTimeRanges', 'e10sDefaultTimeRange',
    function e10sCtrl($state, $stateParams, $scope, $rootScope, $q, $http,
                      ThRepositoryModel, ThOptionCollectionModel, PhSeries,
                      PhCompare, thServiceDomain, thDefaultRepo, phTimeRanges,
                      e10sDefaultTimeRange) {
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

            ThOptionCollectionModel.getMap().then(function(optionCollectionMap) {
                PhSeries.getSeriesSummaries($scope.selectedRepo.name, $scope.selectedTimeRange.value, optionCollectionMap).then(function(seriesData) {

                    var seriesToMeasure = _.filter(seriesData.seriesList, function(series) {
                        return series.options.indexOf('pgo') >= 0 ||
                            (series.platform === 'osx-10-10' &&
                             series.options.indexOf('opt') >= 0);
                    });
                    $scope.platformList = seriesData.platformList;
                    // just use suite names as tests
                    $scope.testList = _.uniq(_.map(seriesToMeasure, function(series) {
                        return PhSeries.getTestName(series);
                    }));

                    $q.all(_.chunk(seriesToMeasure, 20).map(function(seriesChunk) {
                        var url = thServiceDomain + '/api/project/' + $scope.selectedRepo.name +
                            '/performance/data/?interval=' + $scope.selectedTimeRange.value +
                            _.map(seriesChunk, function(series) {
                                return "&signatures=" + series.signature;
                            }).join("");
                        return $http.get(url).then(function(response) {
                            _.forIn(response.data, function(data, signature) {
                                var series = _.find(seriesChunk, { signature: signature });
                                var type = (series.options.indexOf('e10s') >= 0) ? 'e10s' : 'base';
                                resultsMap[type][signature] = {
                                    platform: series.platform,
                                    suite: series.suite,
                                    name: PhSeries.getTestName(series),
                                    lowerIsBetter: series.lowerIsBetter,
                                    hasSubTests: !_.isUndefined(series.subtestSignatures),
                                    values: _.map(data, 'value')
                                };
                            });
                        });
                    })).then(function() {
                        $scope.dataLoading = false;
                        $scope.testList.forEach(function(testName) {
                            $scope.titles[testName] = testName;
                            $scope.platformList.forEach(function(platform) {
                                var baseSig = _.find(Object.keys(resultsMap['base']), function (sig) {
                                    return resultsMap['base'][sig].name === testName &&
                                        resultsMap['base'][sig].platform === platform;
                                });
                                var e10sSig = _.find(Object.keys(resultsMap['e10s']), function (sig) {
                                    return resultsMap['e10s'][sig].name === testName &&
                                        resultsMap['e10s'][sig].platform == platform;
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
    'ThRepositoryModel', 'ThOptionCollectionModel', 'PhSeries', 'PhCompare',
    'thServiceDomain', 'thDefaultRepo', 'phTimeRanges', 'e10sDefaultTimeRange',
    function($state, $stateParams, $scope, $rootScope, $q, $http,
             ThRepositoryModel, ThOptionCollectionModel, PhSeries, PhCompare, thServiceDomain,
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
            ThOptionCollectionModel.getMap().then(function(optionCollectionMap) {
                PhSeries.getAllSeries($scope.selectedRepo.name, $scope.selectedTimeRange.value, optionCollectionMap).then(function(seriesData) {
                    var baseSeries = _.find(seriesData.seriesList, { signature: baseSignature });
                    var e10sSeries = _.find(seriesData.seriesList, { signature: e10sSignature });
                    var subtestSignatures = baseSeries.subtestSignatures.concat(e10sSeries.subtestSignatures);
                    var summaryTestName = baseSeries.platform + ": " + PhSeries.getTestName(baseSeries);
                    $scope.testList = [summaryTestName];
                    $scope.titles[summaryTestName] = summaryTestName;

                    $q.all(_.chunk(subtestSignatures, 20).map(function(seriesChunk) {
                        var url = thServiceDomain + '/api/project/' + $scope.selectedRepo.name +
                            '/performance/data/?interval=' + $scope.selectedTimeRange.value +
                            _.map(seriesChunk, function(signature) {
                                return "&signatures=" + signature;
                            }).join("");
                        return $http.get(url).then(function(response) {
                            _.forIn(response.data, function(data, signature) {
                                var series = _.find(seriesData.seriesList, { signature: signature });
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

                        _.forEach(baseSeries.subtestSignatures, function(subtestSignature) {
                            // find the base series
                            var subtestSeries = _.find(seriesData.seriesList, {
                                signature: subtestSignature
                            });
                            var subtestName = PhSeries.getTestName(subtestSeries);
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
