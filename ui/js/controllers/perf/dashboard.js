"use strict";

perf.value('defaultTimeRange', 86400 * 2);

perf.controller('dashCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$q', '$http', '$httpParamSerializer',
    'ThRepositoryModel', 'ThResultSetModel', 'PhSeries', 'PhCompare', 'thServiceDomain',
    'thDefaultRepo', 'phTimeRanges', 'defaultTimeRange', 'phBlockers', 'phDashboardValues',
    function dashCtrl($state, $stateParams, $scope, $rootScope, $q, $http, $httpParamSerializer,
                      ThRepositoryModel, ThResultSetModel, PhSeries, PhCompare,
                      thServiceDomain, thDefaultRepo, phTimeRanges,
                      defaultTimeRange, phBlockers, phDashboardValues) {

        $scope.dataLoading = true;
        $scope.timeRanges = phTimeRanges;
        $scope.selectedTimeRange = _.find($scope.timeRanges, {
            value: ($stateParams.timerange) ? parseInt($stateParams.timerange) : defaultTimeRange
        });
        $scope.revision = $stateParams.revision;
        $scope.topic = $stateParams.topic;

        // dashboard customization values
        ['variantDataOpt', 'framework', 'header', 'descP1', 'descP2',
         'linkUrl', 'linkDesc', 'baseTitle', 'variantTitle'].forEach(function(k) {
             $scope[k] = phDashboardValues[$scope.topic][k];
         });

        // custom series filters based on dashboard topic
        function filterSeriesByTopic(series) {
            if ($scope.topic === "e10s") {
                return series.options.indexOf('pgo') >= 0 ||
                       (series.platform === 'osx-10-10' && series.options.indexOf('opt') >= 0);
            }
            if ($scope.topic === "hasal") {
                return series.options.indexOf('firefox') >= 0 ||
                       series.options.indexOf('chrome') >= 0;
            }
        }

        function loadData() {
            var resultsMap = {
                variant: {},
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
                            push_id: resultSetId, subtests: 0 });
                    }, function() {
                        $scope.revisionNotFound = true;
                    });
            } else {
                getSeriesList = PhSeries.getSeriesList($scope.selectedRepo.name, {
                    interval: $scope.selectedTimeRange.value,
                    subtests: 0,
                    framework: $scope.framework}).then(function(seriesList) {
                        return _.filter(seriesList, function(series) {
                            return filterSeriesByTopic(series);
                        });
                    });
            }

            getSeriesList.then(function(seriesToMeasure) {
                $scope.platformList = _.uniq(_.map(seriesToMeasure, 'platform'));
                // we just use the unadorned suite name to distinguish tests in this view
                // (so we can mash together pgo and opt)
                $scope.testList = _.uniq(_.map(seriesToMeasure, 'testName'));

                $q.all(_.chunk(seriesToMeasure, 20).map(function(seriesChunk) {
                    var params = { signatures: _.map(seriesChunk, 'signature'),
                                   framework: $scope.framework };
                    if ($scope.revision) {
                        params.push_id = resultSetId;
                    } else {
                        params.interval = $scope.selectedTimeRange.value;
                    }

                    return PhSeries.getSeriesData($scope.selectedRepo.name, params).then(function(seriesData) {
                        _.forIn(seriesData, function(data, signature) {
                            var series = _.find(seriesChunk, { signature: signature });
                            var type = (series.options.indexOf($scope.variantDataOpt) >= 0) ? 'variant' : 'base';
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
                    $scope.testList.forEach(function(testName) {
                        $scope.titles[testName] = testName;
                        $scope.platformList.forEach(function(platform) {
                            var baseSig = _.find(Object.keys(resultsMap['base']), function(sig) {
                                return resultsMap['base'][sig].name === testName &&
                                    resultsMap['base'][sig].platform === platform;
                            });
                            var variantSig = _.find(Object.keys(resultsMap['variant']), function(sig) {
                                return resultsMap['variant'][sig].name === testName &&
                                    resultsMap['variant'][sig].platform === platform;
                            });
                            if (variantSig && baseSig) {
                                var cmap = PhCompare.getCounterMap(
                                    testName, resultsMap['base'][baseSig],
                                    resultsMap['variant'][variantSig], phBlockers);
                                cmap.name = platform + ' ' + resultsMap['base'][baseSig].option;
                                cmap.links = [{
                                    title: 'graph',
                                    href: PhCompare.getGraphsLink(
                                        _.map([baseSig, variantSig], function(sig) {
                                            return {
                                                projectName: $scope.selectedRepo.name,
                                                signature: sig,
                                                frameworkId: $scope.framework
                                            };
                                        }))
                                }];
                                if (resultsMap['base'][baseSig].hasSubTests) {
                                    var params = {
                                        topic: $stateParams.topic,
                                        baseSignature: baseSig,
                                        variantSignature: variantSig,
                                        repo: $scope.selectedRepo.name
                                    };
                                    if ($scope.revision) {
                                        params.revision = $scope.revision;
                                    } else {
                                        params.timerange = $scope.selectedTimeRange.value;
                                    }
                                    cmap.links.push({
                                        title: 'subtests',
                                        href: 'perf.html#/dashboardsubtest?' + $httpParamSerializer(params)
                                    });
                                    if (!$scope.compareResults[testName]) {
                                        $scope.compareResults[testName] = [cmap];
                                    } else {
                                        $scope.compareResults[testName].push(cmap);
                                    }
                                }
                            }});
                    });
                });
            });
        }

        // set filter options
        $scope.filterOptions = {
            filter: $stateParams.filter || "",
            showOnlyImportant: $stateParams.showOnlyImportant !== undefined &&
                                       parseInt($stateParams.showOnlyImportant),
            showOnlyConfident: $stateParams.showOnlyConfident !== undefined &&
                                       parseInt($stateParams.showOnlyConfident),
            showOnlyBlockers: $stateParams.showOnlyBlockers !== undefined &&
                                      parseInt($stateParams.showOnlyBlockers)
        };

        function updateURL() {
            $state.transitionTo('dashboard', {
                topic: $scope.topic,
                filter: $scope.filterOptions.filter,
                showOnlyImportant: $scope.filterOptions.showOnlyImportant ? 1 : undefined,
                showOnlyConfident: $scope.filterOptions.showOnlyConfident ? 1 : undefined,
                showOnlyBlockers: $scope.filterOptions.showOnlyBlockers ? 1 : undefined,
                repo: $scope.selectedRepo.name === thDefaultRepo ? undefined : $scope.selectedRepo.name,
                timerange: ($scope.selectedTimeRange.value !== defaultTimeRange) ? $scope.selectedTimeRange.value : undefined
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

perf.controller('dashSubtestCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$q', '$http',
    'ThRepositoryModel', 'ThResultSetModel', 'PhSeries', 'PhCompare', 'thServiceDomain',
    'thDefaultRepo', 'phTimeRanges', 'defaultTimeRange', 'phDashboardValues',
    function($state, $stateParams, $scope, $rootScope, $q, $http,
             ThRepositoryModel, ThResultSetModel, PhSeries, PhCompare,
             thServiceDomain, thDefaultRepo, phTimeRanges, defaultTimeRange,
             phDashboardValues) {

        var baseSignature = $stateParams.baseSignature;
        var variantSignature = $stateParams.variantSignature;

        $scope.dataLoading = true;
        $scope.timeRanges = phTimeRanges;
        $scope.selectedTimeRange = _.find(phTimeRanges, {
            value: ($stateParams.timerange) ? parseInt($stateParams.timerange) : defaultTimeRange
        });
        $scope.revision = $stateParams.revision;
        $scope.topic = $stateParams.topic;

        // dashboard customization values
        ['variantDataOpt', 'framework', 'header', 'descP1', 'baseTitle',
         'variantTitle'].forEach(function(k) {
             $scope[k] = phDashboardValues[$scope.topic][k];
         });

        function loadData() {
            var resultsMap = {
                variant: {},
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
                            parent_signature: [ baseSignature, variantSignature ],
                            framework: $scope.framework
                        });
                    });
            } else {
                getSeriesList = PhSeries.getSeriesList($scope.selectedRepo.name, {
                    parent_signature: [ baseSignature, variantSignature ],
                    framework: $scope.framework
                });
            }

            // get base data
            getSeriesList.then(function(seriesList) {
                var summaryTestName = seriesList[0].platform + ": " + seriesList[0].suite;
                $scope.testList = [summaryTestName];
                $scope.titles[summaryTestName] = summaryTestName;

                return $q.all(_.chunk(seriesList, 20).map(function(seriesChunk) {
                    var params = { signatures: _.map(seriesChunk, 'signature'),
                                   framework: $scope.framework };
                    if ($scope.revision) {
                        params.push_id = resultSetId;
                    } else {
                        params.interval = $scope.selectedTimeRange.value;
                    }
                    return PhSeries.getSeriesData(
                        $scope.selectedRepo.name, params).then(function(seriesData) {
                            _.forIn(seriesData, function(data, signature) {
                                var series = _.find(seriesList, { signature: signature });
                                var type = (series.options.indexOf($scope.variantDataOpt) >= 0) ? 'variant' : 'base';
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
                                             function(results) {
                                                 return results.name;
                                             });
                    _.forEach(subtestNames, function(subtestName) {
                        var baseSig = _.find(Object.keys(resultsMap['base']), function (sig) {
                            return resultsMap['base'][sig].name === subtestName;
                        });
                        var variantSig = _.find(Object.keys(resultsMap['variant']), function (sig) {
                            return resultsMap['variant'][sig].name === subtestName;
                        });
                        if (variantSig && baseSig) {
                            var cmap = PhCompare.getCounterMap(
                                subtestName, resultsMap['base'][baseSig],
                                resultsMap['variant'][variantSig]);
                            cmap.name = subtestName;
                            cmap.links = [{
                                title: 'graph',
                                href: PhCompare.getGraphsLink(
                                        _.map([baseSig, variantSig], function(sig) {
                                            return {
                                                projectName: $scope.selectedRepo.name,
                                                signature: sig,
                                                frameworkId: $scope.framework
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
            showOnlyImportant: $stateParams.showOnlyImportant !== undefined &&
                                       parseInt($stateParams.showOnlyImportant),
            showOnlyConfident: $stateParams.showOnlyConfident !== undefined &&
                                       parseInt($stateParams.showOnlyConfident),
            showOnlyBlockers: $stateParams.showOnlyBlockers !== undefined &&
                                      parseInt($stateParams.showOnlyBlockers)
        };
        function updateURL() {
            $state.transitionTo('dashboardsubtest', {
                topic: $scope.topic,
                filter: $scope.filterOptions.filter,
                showOnlyImportant: $scope.filterOptions.showOnlyImportant ? 1 : undefined,
                showOnlyConfident: $scope.filterOptions.showOnlyConfident ? 1 : undefined,
                repo: $scope.selectedRepo.name === thDefaultRepo ? undefined : $scope.selectedRepo.name,
                timerange: ($scope.selectedTimeRange.value !== defaultTimeRange) ? $scope.selectedTimeRange.value : undefined
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
