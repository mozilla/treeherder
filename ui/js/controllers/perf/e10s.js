"use strict";

perf.controller('e10sCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$q', '$http',
    'ThOptionCollectionModel', 'PhSeries', 'PhCompare', 'thServiceDomain',
    function e10sCtrl($state, $stateParams, $scope, $rootScope, $q, $http,
                      ThOptionCollectionModel, PhSeries, PhCompare, thServiceDomain) {
        var projectName = 'mozilla-inbound';
        var interval = 86400*2;
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

        $scope.testList = [];
        $scope.dataLoading = true;
        $scope.compareResults = {};
        $scope.titles = {};

        $scope.filterOptions = {
            filter: $stateParams.filter || "",
            showOnlyImportant: Boolean($stateParams.showOnlyImportant !== undefined &&
                                       parseInt($stateParams.showOnlyImportant)),
            showOnlyConfident: Boolean($stateParams.showOnlyConfident !== undefined &&
                                       parseInt($stateParams.showOnlyConfident)),
            showOnlyBlockers: Boolean($stateParams.showOnlyBlockers !== undefined &&
                                      parseInt($stateParams.showOnlyBlockers))
        };
        $scope.$watchGroup(['filterOptions.filter',
                            'filterOptions.showOnlyImportant',
                            'filterOptions.showOnlyConfident',
                            'filterOptions.showOnlyBlockers'],
                           function() {
                               $state.transitionTo('e10s', {
                                   filter: $scope.filterOptions.filter,
                                   showOnlyImportant: Boolean($scope.filterOptions.showOnlyImportant) ? 1 : undefined,
                                   showOnlyConfident: Boolean($scope.filterOptions.showOnlyConfident) ? 1 : undefined,
                                   showOnlyBlockers: Boolean($scope.filterOptions.showOnlyBlockers) ? 1 : undefined
                               }, {
                                   location: true,
                                   inherit: true,
                                   relative: $state.$current,
                                   notify: false
                               });
                           });

        var resultsMap = {
            e10s: {},
            base: {}
        };
        ThOptionCollectionModel.getMap().then(function(optionCollectionMap) {
            PhSeries.getSeriesSummaries(projectName, interval, optionCollectionMap).then(function(seriesData) {

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
                    var url = thServiceDomain + '/api/project/' + projectName +
                        '/performance/data/?interval=' + interval +
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
                                                                           return 'series=[' + [ projectName, sig, 1 ];
                                                                       }).join('&') + ']'
                                }];
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
]);
