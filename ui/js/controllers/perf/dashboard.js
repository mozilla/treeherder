import _ from 'lodash';

import perf from '../../perf';
import { thDefaultRepo, phBlockers, phTimeRanges } from '../../constants';

const phDashboardValues = {
    /*
    Expected dashboard configs structure:
    <dashboard_name>: {
        baseTitle: string,
        defaultRepo: string,
        descP1: string,
        descP2: string,
        framework: integer,
        header: string,
        linkDesc: string,
        linkUrl: urlString,
        variantDataOpt: string,
        variantTitle: string
     }, ...
     */
};

perf.value('defaultTimeRange', 86400 * 2);

perf.controller('dashCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$q', '$httpParamSerializer',
    'ThRepositoryModel', 'ThResultSetModel', 'PhSeries', 'PhCompare',
    'defaultTimeRange',
    function dashCtrl($state, $stateParams, $scope, $rootScope, $q, $httpParamSerializer,
                      ThRepositoryModel, ThResultSetModel, PhSeries, PhCompare,
                      defaultTimeRange) {

        $scope.dataLoading = true;
        $scope.timeRanges = phTimeRanges;
        $scope.selectedTimeRange = _.find($scope.timeRanges, {
            value: ($stateParams.timerange) ? parseInt($stateParams.timerange) : defaultTimeRange,
        });
        $scope.revision = $stateParams.revision;
        $scope.topic = $stateParams.topic;

        // dashboard customization values
        ['variantDataOpt', 'framework', 'header', 'descP1', 'descP2',
            'linkUrl', 'linkDesc', 'baseTitle', 'variantTitle'].forEach(function (k) {
                try {
                    $scope[k] = phDashboardValues[$scope.topic][k];
                } catch (TypeError) {
                    // eslint-disable-next-line no-console
                    console.error(`"${k}" option not found in ${$scope.topic} dashboard config`);
                }
            });

        // custom series filters based on dashboard topic
        function filterSeriesByTopic(series) { // eslint-disable-line no-unused-vars
            return true;
        }

        function loadData() {
            const resultsMap = {
                variant: {},
                base: {},
            };
            $scope.testList = [];
            $scope.dataLoading = true;
            $scope.compareResults = {};
            $scope.titles = {};

            let getSeriesList;
            let resultSetId;
            if ($scope.revision) {
                getSeriesList = ThResultSetModel.getResultSetsFromRevision(
                    $scope.selectedRepo.name, $scope.revision).then(function (resultSets) {
                        resultSetId = resultSets[0].id;
                        return PhSeries.getSeriesList($scope.selectedRepo.name, {
                            push_id: resultSetId, subtests: 0 });
                    }, function () {
                        $scope.revisionNotFound = true;
                    });
            } else {
                getSeriesList = PhSeries.getSeriesList($scope.selectedRepo.name, {
                    interval: $scope.selectedTimeRange.value,
                    subtests: 0,
                    framework: $scope.framework }).then(function (seriesList) {
                        return seriesList.filter(series => filterSeriesByTopic(series));
                    });
            }

            getSeriesList.then(function (seriesToMeasure) {
                $scope.platformList = [...new Set(seriesToMeasure.map(serie => serie.platform))];
                // we just use the unadorned suite name to distinguish tests in this view
                // (so we can mash together pgo and opt)
                $scope.testList = [...new Set(seriesToMeasure.map(serie => serie.testName))];

                $q.all(_.chunk(seriesToMeasure, 40).map(function (seriesChunk) {
                    const params = {
                        signature_id: seriesChunk.map(serie => serie.id),
                        framework: $scope.framework,
                    };
                    if ($scope.revision) {
                        params.push_id = resultSetId;
                    } else {
                        params.interval = $scope.selectedTimeRange.value;
                    }

                    return PhSeries.getSeriesData($scope.selectedRepo.name, params).then(function (seriesData) {
                        _.forIn(seriesData, function (data, signature) {
                            const series = _.find(seriesChunk, { signature: signature });
                            const type = (series.options.indexOf($scope.variantDataOpt) >= 0) ? 'variant' : 'base';
                            resultsMap[type][signature] = {
                                platform: series.platform,
                                name: series.testName,
                                lowerIsBetter: series.lowerIsBetter,
                                hasSubTests: series.hasSubtests,
                                option: series.options.indexOf('opt') >= 0 ? 'opt' : 'pgo',
                                values: data.map(data => data.value)
                            };
                        });
                    });
                })).then(function () {
                    $scope.dataLoading = false;
                    $scope.testList.forEach(function (testName) {
                        $scope.titles[testName] = testName;
                        $scope.platformList.forEach(function (platform) {
                            const baseSig = _.find(Object.keys(resultsMap.base), function (sig) {
                                return resultsMap.base[sig].name === testName &&
                                    resultsMap.base[sig].platform === platform;
                            });
                            const variantSig = _.find(Object.keys(resultsMap.variant), function (sig) {
                                return resultsMap.variant[sig].name === testName &&
                                    resultsMap.variant[sig].platform === platform;
                            });
                            if (variantSig && baseSig) {
                                const cmap = PhCompare.getCounterMap(
                                    testName, resultsMap.base[baseSig],
                                    resultsMap.variant[variantSig], phBlockers);
                                cmap.name = platform + ' ' + resultsMap.base[baseSig].option;
                                cmap.links = [{
                                    title: 'graph',
                                    href: PhCompare.getGraphsLink(
                                        [baseSig, variantSig].map(function (sig) {
                                            return {
                                                projectName: $scope.selectedRepo.name,
                                                signature: sig,
                                                frameworkId: $scope.framework,
                                            };
                                        })),
                                }];
                                if (resultsMap.base[baseSig].hasSubTests) {
                                    const params = {
                                        topic: $stateParams.topic,
                                        baseSignature: baseSig,
                                        variantSignature: variantSig,
                                        repo: $scope.selectedRepo.name,
                                    };
                                    if ($scope.revision) {
                                        params.revision = $scope.revision;
                                    } else {
                                        params.timerange = $scope.selectedTimeRange.value;
                                    }
                                    cmap.links.push({
                                        title: 'subtests',
                                        href: 'perf.html#/dashboardsubtest?' + $httpParamSerializer(params),
                                    });
                                    if (!$scope.compareResults[testName]) {
                                        $scope.compareResults[testName] = [cmap];
                                    } else {
                                        $scope.compareResults[testName].push(cmap);
                                    }
                                }
                            }
                        });
                    });
                });
            });
        }

        // set filter options
        $scope.filterOptions = {
            filter: $stateParams.filter || '',
            showOnlyImportant: Boolean($stateParams.showOnlyImportant !== undefined &&
                                       parseInt($stateParams.showOnlyImportant)),
            showOnlyComparable: Boolean($stateParams.showOnlyComparable !== undefined &&
                                       parseInt($stateParams.showOnlyComparable)),
            showOnlyConfident: Boolean($stateParams.showOnlyConfident !== undefined &&
                                       parseInt($stateParams.showOnlyConfident)),
            showOnlyBlockers: Boolean($stateParams.showOnlyBlockers !== undefined &&
                                      parseInt($stateParams.showOnlyBlockers)),
        };

        function updateURL() {
            $state.transitionTo('dashboard', {
                topic: $scope.topic,
                filter: $scope.filterOptions.filter,
                showOnlyImportant: $scope.filterOptions.showOnlyImportant ? 1 : undefined,
                showOnlyComparable: $scope.filterOptions.showOnlyComparable ? 1 : undefined,
                showOnlyConfident: $scope.filterOptions.showOnlyConfident ? 1 : undefined,
                showOnlyBlockers: $scope.filterOptions.showOnlyBlockers ? 1 : undefined,
                repo: $scope.selectedRepo.name === thDefaultRepo ? undefined : $scope.selectedRepo.name,
                timerange: ($scope.selectedTimeRange.value !== defaultTimeRange) ? $scope.selectedTimeRange.value : undefined,
            }, {
                location: true,
                inherit: true,
                relative: $state.$current,
                notify: false,
            });
        }

        ThRepositoryModel.load().then(function () {
            $scope.projects = $rootScope.repos;
            $scope.selectedRepo = _.find($scope.projects, {
                name: $stateParams.repo ? $stateParams.repo : thDefaultRepo,
            });

            $scope.$watchGroup([
                'filterOptions.filter',
                'filterOptions.showOnlyImportant',
                'filterOptions.showOnlyComparable',
                'filterOptions.showOnlyConfident',
                'filterOptions.showOnlyBlockers',
            ], updateURL);

            $scope.globalOptionsChanged = function (selectedRepo, selectedTimeRange) {
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
    },

]);

perf.controller('dashSubtestCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$q',
    'ThRepositoryModel', 'ThResultSetModel', 'PhSeries', 'PhCompare',
    'defaultTimeRange',
    function ($state, $stateParams, $scope, $rootScope, $q,
             ThRepositoryModel, ThResultSetModel, PhSeries, PhCompare,
             defaultTimeRange) {

        const baseSignature = $stateParams.baseSignature;
        const variantSignature = $stateParams.variantSignature;

        $scope.dataLoading = true;
        $scope.timeRanges = phTimeRanges;
        $scope.selectedTimeRange = _.find(phTimeRanges, {
            value: ($stateParams.timerange) ? parseInt($stateParams.timerange) : defaultTimeRange,
        });
        $scope.revision = $stateParams.revision;
        $scope.topic = $stateParams.topic;

        // dashboard customization values
        ['variantDataOpt', 'framework', 'header', 'descP1', 'baseTitle',
            'variantTitle'].forEach(function (k) {
                $scope[k] = phDashboardValues[$scope.topic][k];
            });

        function loadData() {
            const resultsMap = {
                variant: {},
                base: {},
            };
            $scope.testList = [];
            $scope.dataLoading = true;
            $scope.compareResults = {};
            $scope.titles = {};

            let getSeriesList;
            let resultSetId;
            if ($scope.revision) {
                getSeriesList = ThResultSetModel.getResultSetsFromRevision(
                    $scope.selectedRepo.name, $scope.revision).then(function (resultSets) {
                        resultSetId = resultSets[0].id;
                        return PhSeries.getSeriesList($scope.selectedRepo.name, {
                            parent_signature: [baseSignature, variantSignature],
                            framework: $scope.framework,
                        });
                    });
            } else {
                getSeriesList = PhSeries.getSeriesList($scope.selectedRepo.name, {
                    parent_signature: [baseSignature, variantSignature],
                    framework: $scope.framework,
                });
            }

            // get base data
            getSeriesList.then(function (seriesList) {
                const summaryTestName = seriesList[0].platform + ': ' + seriesList[0].suite;
                $scope.testList = [summaryTestName];
                $scope.titles[summaryTestName] = summaryTestName;

                return $q.all(_.chunk(seriesList, 40).map(function (seriesChunk) {
                    const params = {
                        signature_id: seriesChunk.map(serie => serie.id),
                        framework: $scope.framework,
                    };
                    if ($scope.revision) {
                        params.push_id = resultSetId;
                    } else {
                        params.interval = $scope.selectedTimeRange.value;
                    }
                    return PhSeries.getSeriesData(
                        $scope.selectedRepo.name, params).then(function (seriesData) {
                            _.forIn(seriesData, function (data, signature) {
                                const series = _.find(seriesList, { signature: signature });
                                const type = (series.options.indexOf($scope.variantDataOpt) >= 0) ? 'variant' : 'base';
                                resultsMap[type][signature] = {
                                    platform: series.platform,
                                    suite: series.suite,
                                    name: PhSeries.getTestName(series),
                                    lowerIsBetter: series.lowerIsBetter,
                                    values: data.map(d => d.value)
                                };
                            });
                        });
                })).then(function () {
                    $scope.dataLoading = false;
                    const subtestNames = resultsMap.base.map(results => results.name);
                    subtestNames.forEach(function (subtestName) {
                        const baseSig = _.find(Object.keys(resultsMap.base), function (sig) {
                            return resultsMap.base[sig].name === subtestName;
                        });
                        const variantSig = _.find(Object.keys(resultsMap.variant), function (sig) {
                            return resultsMap.variant[sig].name === subtestName;
                        });
                        if (variantSig && baseSig) {
                            const cmap = PhCompare.getCounterMap(
                                subtestName, resultsMap.base[baseSig],
                                resultsMap.variant[variantSig]);
                            cmap.name = subtestName;
                            cmap.links = [{
                                title: 'graph',
                                href: PhCompare.getGraphsLink([baseSig, variantSig].map(sig => ({
                                    projectName: $scope.selectedRepo.name,
                                    signature: sig,
                                    frameworkId: $scope.framework,
                                })))
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
            filter: $stateParams.filter || '',
            showOnlyImportant: Boolean($stateParams.showOnlyImportant !== undefined &&
                                       parseInt($stateParams.showOnlyImportant)),
            showOnlyComparable: Boolean($stateParams.showOnlyComparable !== undefined &&
                                       parseInt($stateParams.showOnlyComparable)),
            showOnlyConfident: Boolean($stateParams.showOnlyConfident !== undefined &&
                                       parseInt($stateParams.showOnlyConfident)),
            showOnlyBlockers: Boolean($stateParams.showOnlyBlockers !== undefined &&
                                      parseInt($stateParams.showOnlyBlockers)),
        };
        function updateURL() {
            $state.transitionTo('dashboardsubtest', {
                topic: $scope.topic,
                filter: $scope.filterOptions.filter,
                showOnlyImportant: $scope.filterOptions.showOnlyImportant ? 1 : undefined,
                showOnlyComparable: $scope.filterOptions.showOnlyComparable ? 1 : undefined,
                showOnlyConfident: $scope.filterOptions.showOnlyConfident ? 1 : undefined,
                repo: $scope.selectedRepo.name === thDefaultRepo ? undefined : $scope.selectedRepo.name,
                timerange: ($scope.selectedTimeRange.value !== defaultTimeRange) ? $scope.selectedTimeRange.value : undefined,
            }, {
                location: true,
                inherit: true,
                relative: $state.$current,
                notify: false,
            });
        }

        ThRepositoryModel.load().then(function () {
            $scope.projects = $rootScope.repos;
            $scope.selectedRepo = _.find($scope.projects, {
                name: $stateParams.repo ? $stateParams.repo : thDefaultRepo,
            });

            $scope.$watchGroup([
                'filterOptions.filter',
                'filterOptions.showOnlyImportant',
                'filterOptions.showOnlyComparable',
                'filterOptions.showOnlyConfident',
            ], updateURL);

            $scope.globalOptionsChanged = function (selectedRepo, selectedTimeRange) {
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
    },
]);
