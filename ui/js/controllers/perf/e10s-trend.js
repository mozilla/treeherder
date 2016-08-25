"use strict";

perf.value('defaultBaseDate', 604800);
perf.value('defaultNewDate', 0);
perf.value('defaultSampleSize', 604800);

perf.controller('e10sTrendCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$q', '$http', '$httpParamSerializer',
    'ThRepositoryModel', 'ThResultSetModel', 'PhSeries', 'PhCompare',
    'thServiceDomain', 'thDefaultRepo', 'phSampleSizes', 'defaultSampleSize',
    'phDatePoints', 'defaultBaseDate', 'defaultNewDate',
    function e10sTrendCtrl($state, $stateParams, $scope, $rootScope, $q, $http, $httpParamSerializer,
                      ThRepositoryModel, ThResultSetModel, PhSeries, PhCompare,
                      thServiceDomain, thDefaultRepo, phSampleSizes,
                      defaultSampleSize, phDatePoints, defaultBaseDate, defaultNewDate) {
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
        $scope.sampleSizes= phSampleSizes;
        $scope.datePoints = phDatePoints;
        $scope.selectedSampleSize = _.find($scope.sampleSizes, {
            value: ($stateParams.samplesize) ? parseInt($stateParams.samplesize) : defaultSampleSize
        });
        $scope.selectedBaseDate = _.find($scope.datePoints, {
            value: ($stateParams.startdatapoint) ? parseInt($stateParams.startdatapoint) : defaultBaseDate
        });
        $scope.selectedNewDate = _.find($scope.datePoints, {
            value: ($stateParams.startdatapoint) ? parseInt($stateParams.startdatapoint) : defaultNewDate
        });
        $scope.revision = $stateParams.revision;

        function displayResults(baseResultsMap, newRawResultsMap) {
            var resultsMap = {
                newD: {},
                baseD: {}
            };
            var match = {};
            $scope.testList = [];
            $scope.dataLoading = true;
            $scope.compareResults = {};
            $scope.dataLoading = false;

            // create one object of common results
            Object.keys($scope.baseResults).forEach(function(baseTestName) {
                $scope.baseResults[baseTestName].forEach(function(baseResult) {
                    if ($scope.newResults[baseTestName]) {
                        var newResult = $scope.newResults[baseTestName];
                        newResult = _.find(newResult, function(obj) { return obj.name == baseResult['name'] });
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
            console.log('compareResults:');
            console.log($scope.compareResults);
        }

        function loadData() {
            var resultsMap = {
                e10s: {},
                base: {}
            };
            $scope.baseTestList = [];
            $scope.newTestList = [];
            $scope.dataLoading = true;
            $scope.baseResults = {};
            $scope.newResults = {};
            $scope.titles = {};

            // ** get dates for original base date (for the last x days back from the base date) **
            // selectedBaseDate and selectedNewDate are in SECONDS from today back i.e. 1 day ago, 1 week ago

            // calculate the actual base date itself, as a date not just x seconds back from today
            var today_epoch = Date.now();
            var base_date = today_epoch - ($scope.selectedBaseDate.value * 1000)  // want MS

            // start date for retrieving data is the base date minus sample size i.e. x days back from base date
            var data_start_date = base_date - ($scope.selectedSampleSize.value * 1000)  // want MS
            data_start_date = new Date(data_start_date);
            // must be in format 'YYYY-MM-DDT:HH:MM:SS' ie. 2016-09-10T1:1:1
            $scope.base_data_start_date = data_start_date.toISOString().slice(0, -5);

            // end date for retrieving data is the base date itself
            // must be in format 'YYYY-MM-DDT:HH:MM:SS' ie. 2016-09-10T1:1:1
            var data_end_date =  new Date(base_date);
            $scope.base_data_end_date = data_end_date.toISOString().slice(0, -5);

            // ** get dates for new date (for the last x days back from the new date) **
            // calculate the actual new date itself, as a date not just x seconds back from today
            var today_epoch = Date.now();
            var new_date = today_epoch - ($scope.selectedNewDate.value * 1000)  // want MS

            // start date for retrieving data is the new date minus sample size i.e. x days back from new date
            var data_start_date = new_date - ($scope.selectedSampleSize.value * 1000)  // want MS
            data_start_date = new Date(data_start_date);
            // must be in format 'YYYY-MM-DDT:HH:MM:SS' ie. 2016-09-10T1:1:1
            $scope.new_data_start_date = data_start_date.toISOString().slice(0, -5);

            // end date for retrieving data is the new date itself
            // must be in format 'YYYY-MM-DDT:HH:MM:SS' ie. 2016-09-10T1:1:1
            var data_end_date =  new Date(new_date);
            $scope.new_data_end_date = data_end_date.toISOString().slice(0, -5);

            PhSeries.getSeriesList(
                $scope.selectedRepo.name,
                { start_date: $scope.base_data_start_date,
                  end_date: $scope.base_data_end_date,
                  subtests: 0,
                  framework: 1
                }).then(
                    function(originalSeriesList) {
                        return _.filter(originalSeriesList, function(series) {
                            return series.options.indexOf('pgo') >= 0 ||
                                (series.platform === 'osx-10-10' &&
                                 series.options.indexOf('opt') >= 0);
                        });
                    }).then(
                        function(seriesToMeasure) {
                            $scope.basePlatformList = _.uniq(_.map(seriesToMeasure, 'platform'));
                            // we just use the unadorned suite name to distinguish tests in this view
                            // (so we can mash together pgo and opt)
                            $scope.baseTestList = _.uniq(_.map(seriesToMeasure, 'testName'));

                            $q.all(_.chunk(seriesToMeasure, 20).map(function(seriesChunk) {
                                var params = { signatures: _.map(seriesChunk, 'signature'),
                                               framework: 1,
                                               start_date: $scope.base_data_start_date,
                                               end_date: $scope.base_data_end_date };
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
                                $scope.dataLoading = false;
                                $scope.baseTestList.forEach(function(testName) {
                                    $scope.titles[testName] = testName;
                                    $scope.basePlatformList.forEach(function(platform) {
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
                                            cmap.name = platform + ' ' + resultsMap['base'][baseSig].option;
                                            cmap.links = [{
                                                title: 'graph',
                                                href: PhCompare.getGraphsLink(
                                                    _.map([baseSig, e10sSig], function(sig) {
                                                        return {
                                                            projectName: $scope.selectedRepo.name,
                                                            signature: sig,
                                                            frameworkId: 1
                                                        };
                                                    }))
                                            }];
                                            if (resultsMap['base'][baseSig].hasSubTests) {
                                                var params = {
                                                    baseSignature: baseSig,
                                                    e10sSignature: e10sSig,
                                                    repo: $scope.selectedRepo.name
                                                };
                                                if ($scope.revision) {
                                                    params.revision = $scope.revision;
                                                } else {
                                                    params.timerange = $scope.selectedSampleSize.value;
                                                }
                                                cmap.links.push({
                                                    title: 'subtests',
                                                    href: 'perf.html#/e10s_comparesubtest?' + $httpParamSerializer(params)
                                                });
                                                if (!$scope.baseResults[testName]) {
                                                    $scope.baseResults[testName] = [cmap];
                                                } else {
                                                    $scope.baseResults[testName].push(cmap);
                                                }
                                            }
                                        }
                                    });
                                });
                            }).then(function(){
                                resultsMap = {
                                    e10s: {},
                                    base: {}
                                };
                                $scope.newTestList = [];
                                $scope.dataLoading = true;
                                $scope.titles = {};

                                PhSeries.getSeriesList(
                                    $scope.selectedRepo.name,
                                    { start_date: $scope.new_data_start_date,
                                      end_date: $scope.new_data_end_date,
                                      subtests: 0,
                                      framework: 1
                                    }).then(
                                        function(originalSeriesList) {
                                            return _.filter(originalSeriesList, function(series) {
                                                return series.options.indexOf('pgo') >= 0 ||
                                                    (series.platform === 'osx-10-10' &&
                                                     series.options.indexOf('opt') >= 0);
                                            });
                                        }).then(
                                            function(seriesToMeasure) {
                                                $scope.newPlatformList = _.uniq(_.map(seriesToMeasure, 'platform'));
                                                // we just use the unadorned suite name to distinguish tests in this view
                                                // (so we can mash together pgo and opt)
                                                $scope.newTestList = _.uniq(_.map(seriesToMeasure, 'testName'));

                                                $q.all(_.chunk(seriesToMeasure, 20).map(function(seriesChunk) {
                                                    var params = { signatures: _.map(seriesChunk, 'signature'),
                                                                   framework: 1,
                                                                   start_date: $scope.base_data_start_date,
                                                                   end_date: $scope.base_data_end_date };
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
                                                    $scope.dataLoading = false;
                                                    $scope.newTestList.forEach(function(testName) {
                                                        $scope.titles[testName] = testName;
                                                        $scope.newPlatformList.forEach(function(platform) {
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
                                                                cmap.name = platform + ' ' + resultsMap['base'][baseSig].option;
                                                                cmap.links = [{
                                                                    title: 'graph',
                                                                    href: PhCompare.getGraphsLink(
                                                                        _.map([baseSig, e10sSig], function(sig) {
                                                                            return {
                                                                                projectName: $scope.selectedRepo.name,
                                                                                signature: sig,
                                                                                frameworkId: 1
                                                                            };
                                                                        }))
                                                                }];
                                                                if (resultsMap['base'][baseSig].hasSubTests) {
                                                                    var params = {
                                                                        baseSignature: baseSig,
                                                                        e10sSignature: e10sSig,
                                                                        repo: $scope.selectedRepo.name
                                                                    };
                                                                    if ($scope.revision) {
                                                                        params.revision = $scope.revision;
                                                                    } else {
                                                                        params.timerange = $scope.selectedSampleSize.value;
                                                                    }
                                                                    cmap.links.push({
                                                                        title: 'subtests',
                                                                        href: 'perf.html#/e10s_comparesubtest?' + $httpParamSerializer(params)
                                                                    });
                                                                    if (!$scope.newResults[testName]) {
                                                                        $scope.newResults[testName] = [cmap];
                                                                    } else {
                                                                        $scope.newResults[testName].push(cmap);
                                                                    }
                                                                }
                                                            }
                                                        });
                                                    });
                                                }).then(function(){
                                                    console.log('baseResults:');
                                                    console.log($scope.baseResults);
                                                    console.log('newResults:');
                                                    console.log($scope.newResults);
                                                    displayResults($scope.baseResults, $scope.newResults);
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
            $state.transitionTo('e10s_trend', {
                filter: $scope.filterOptions.filter,
                showOnlyImportant: Boolean($scope.filterOptions.showOnlyImportant) ? 1 : undefined,
                showOnlyConfident: Boolean($scope.filterOptions.showOnlyConfident) ? 1 : undefined,
                showOnlyBlockers: Boolean($scope.filterOptions.showOnlyBlockers) ? 1 : undefined,
                repo: $scope.selectedRepo.name === thDefaultRepo ? undefined : $scope.selectedRepo.name,
                basedate: $scope.selectedBaseDate.value === defaultBaseDate ? undefined: $scope.selectedBaseDate.value,
                newdate: $scope.selectedNewDate.value === defaultNewDate ? undefined: $scope.selectedNewDate.value,
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
                console.log($scope.selectedBaseDate);
                console.log($scope.selectedNewDate);
                console.log($scope.selectedSampleSize);
                updateURL();
                loadData();
            };

            loadData();

        });
    }

]);

perf.controller('e10sSubtestCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$q', '$http',
    'ThRepositoryModel', 'ThResultSetModel', 'PhSeries', 'PhCompare',
    'thServiceDomain', 'thDefaultRepo', 'phTimeRanges', 'defaultSampleSize',
    function($state, $stateParams, $scope, $rootScope, $q, $http,
             ThRepositoryModel, ThResultSetModel, PhSeries, PhCompare,
             thServiceDomain, thDefaultRepo, phTimeRanges,
             defaultSampleSize) {

        var baseSignature = $stateParams.baseSignature;
        var e10sSignature = $stateParams.e10sSignature;

        $scope.dataLoading = true;
        $scope.timeRanges = phTimeRanges;
        $scope.selectedSampleSize = _.find(phTimeRanges, {
            value: ($stateParams.timerange) ? parseInt($stateParams.timerange) : defaultSampleSize
        });
        $scope.revision = $stateParams.revision;

        function loadData() {
            var resultsMap = {
                e10s: {},
                base: {}
            };
            $scope.testList = [];
            $scope.dataLoading = true;
            $scope.compareResults = {};
            $scope.titles = {};

            var getSeriesList, resultSetId;
            if ($scope.revision) {
                getSeriesList = ThResultSetModel.getResultSetsFromRevision(
                    $scope.selectedRepo.name, $scope.revision).then(function(resultSets) {
                        resultSetId = resultSets[0].id;
                        return PhSeries.getSeriesList($scope.selectedRepo.name, {
                            parent_signature: [ baseSignature, e10sSignature ],
                            framework: 1
                        });
                    });
            } else {
                getSeriesList = PhSeries.getSeriesList($scope.selectedRepo.name, {
                    parent_signature: [ baseSignature, e10sSignature ],
                    framework: 1
                });
            }

            // get base data
            getSeriesList.then(function(seriesList) {
                var summaryTestName = seriesList[0].platform + ": " + seriesList[0].suite;
                $scope.testList = [summaryTestName];
                $scope.titles[summaryTestName] = summaryTestName;

                return $q.all(_.chunk(seriesList, 20).map(function(seriesChunk) {
                    var params = { signatures: _.map(seriesChunk, 'signature'),
                                   framework: 1 };
                    if ($scope.revision) {
                        params.result_set_id = resultSetId;
                    } else {
                        params.interval = $scope.selectedSampleSize.value;
                    }
                    return PhSeries.getSeriesData(
                        $scope.selectedRepo.name, params).then(function(seriesData) {
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
                    var subtestNames = _.map(resultsMap['base'],
                                             function(results, signature) {
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
                                href: PhCompare.getGraphsLink(
                                        _.map([baseSig, e10sSig], function(sig) {
                                            return {
                                                projectName: $scope.selectedRepo.name,
                                                signature: sig,
                                                frameworkId: 1
                                            };
                                        }))
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
                                'filterOptions.showOnlyConfident'],
                               updateURL);

            $scope.globalOptionsChanged = function(selectedRepo, selectedSampleSize) {
                // we pass `selectedRepo` and `selectedSampleSize` as
                // parameter, because angular assigns them to a different
                // scope (*sigh*) and I don't know of any other workaround
                $scope.selectedRepo = selectedRepo;
                $scope.selectedSampleSize = selectedSampleSize;
                updateURL();
                loadData();
            };

            loadData();
        });
    }
]);
