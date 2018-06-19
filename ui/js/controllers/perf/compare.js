import _ from 'lodash';
import metricsgraphics from 'metrics-graphics';

import perf from '../../perf';
import {
  phCompareDefaultOriginalRepo,
  phCompareDefaultNewRepo,
  phTimeRanges,
  phCompareBaseLineDefaultTimeRange,
} from '../../constants';

perf.controller('CompareChooserCtrl', [
    '$state', '$stateParams', '$scope', '$q', 'ThRepositoryModel', 'ThResultSetModel',
    'localStorageService',
    function CompareChooserCtrl($state, $stateParams, $scope, $q,
                                ThRepositoryModel, ThResultSetModel,
                                localStorageService) {
        ThRepositoryModel.get_list().then(({ data: projects }) => {
            $scope.projects = projects;
            $scope.originalTipList = [];
            $scope.newTipList = [];
            $scope.revisionComparison = false;

            const getParameter = function (paramName, defaultValue) {
                if ($stateParams[paramName]) {
                    return $stateParams[paramName];
                } else if (localStorageService.get(paramName)) {
                    return localStorageService.get(paramName);
                }
                return defaultValue;
            };

            $scope.originalProject = projects.find(project =>
                project.name === getParameter('originalProject', phCompareDefaultOriginalRepo),
            ) || projects[0];
            $scope.newProject = projects.find(project =>
                project.name === getParameter('newProject', phCompareDefaultNewRepo),
            ) || projects[0];

            $scope.originalRevision = getParameter('originalRevision', '');
            $scope.newRevision = getParameter('newRevision', '');

            const getRevisionTips = function (projectName, list) {
                // due to we push the revision data into list,
                // so we need clear the data before we push new data into it.
                list.splice(0, list.length);
                ThResultSetModel.getResultSets(projectName).then(function (response) {
                    const resultsets = response.data.results;
                    resultsets.forEach(function (revisionSet) {
                        list.push({
                            revision: revisionSet.revision,
                            author: revisionSet.author,
                        });
                    });
                });
            };

            $scope.updateOriginalRevisionTips = function () {
                getRevisionTips($scope.originalProject.name, $scope.originalTipList);
            };
            $scope.updateNewRevisionTips = function () {
                getRevisionTips($scope.newProject.name, $scope.newTipList);
            };
            $scope.updateOriginalRevisionTips();
            $scope.updateNewRevisionTips();

            $scope.getOriginalTipRevision = function (tip) {
                $scope.originalRevision = tip;
            };

            $scope.getNewTipRevision = function (tip) {
                $scope.newRevision = tip;
            };

            $scope.runCompare = function () {
                const revisionPromises = [];
                if ($scope.revisionComparison) {
                    revisionPromises.push(ThResultSetModel.getResultSetsFromRevision($scope.originalProject.name, $scope.originalRevision).then(
                        function () {
                            $scope.originalRevisionError = undefined;
                        },
                        function (error) {
                            $scope.originalRevisionError = error;
                        },
                    ));
                }

                revisionPromises.push(ThResultSetModel.getResultSetsFromRevision($scope.newProject.name, $scope.newRevision).then(
                    function () {
                        $scope.newRevisionError = undefined;
                    },
                    function (error) {
                        $scope.newRevisionError = error;
                    },
                ));

                $q.all(revisionPromises).then(function () {
                    localStorageService.set('originalProject', $scope.originalProject.name, 'sessionStorage');
                    localStorageService.set('originalRevision', $scope.originalRevision, 'sessionStorage');
                    localStorageService.set('newProject', $scope.newProject.name, 'sessionStorage');
                    localStorageService.set('newRevision', $scope.newRevision, 'sessionStorage');
                    if ($scope.originalRevisionError === undefined && $scope.newRevisionError === undefined) {
                        if ($scope.revisionComparison) {
                            $state.go('compare', {
                                originalProject: $scope.originalProject.name,
                                originalRevision: $scope.originalRevision,
                                newProject: $scope.newProject.name,
                                newRevision: $scope.newRevision,
                            });
                        } else {
                            $state.go('compare', {
                                originalProject: $scope.originalProject.name,
                                newProject: $scope.newProject.name,
                                newRevision: $scope.newRevision,
                                selectedTimeRange: phCompareBaseLineDefaultTimeRange,
                            });
                        }
                    }
                });
            };
        });
    }]);

perf.controller('CompareResultsCtrl', [
    '$state', '$stateParams', '$scope',
    'ThRepositoryModel',
    'ThResultSetModel', '$httpParamSerializer', '$q', 'PhFramework', 'PhSeries',
    'PhCompare',
    function CompareResultsCtrl($state, $stateParams, $scope,
                                ThRepositoryModel, ThResultSetModel, $httpParamSerializer,
                                $q, PhFramework, PhSeries,
                                PhCompare) {
        function displayResults(rawResultsMap, newRawResultsMap) {
            $scope.compareResults = {};
            $scope.titles = {};
            if ($scope.originalRevision) {
                window.document.title = `Comparison between ${$scope.originalRevision} (${$scope.originalProject.name}) and ${$scope.newRevision} (${$scope.newProject.name})`;
            } else {
                window.document.title = `Comparison between ${$scope.originalProject.name} and ${$scope.newRevision} (${$scope.newProject.name})`;
            }

            $scope.oldStddevVariance = {};
            $scope.newStddevVariance = {};
            $scope.testsTooVariable = [{ platform: 'Platform', testname: 'Testname', baseStddev: 'Base Stddev', newStddev: 'New Stddev' }];

            $scope.testList.forEach(function (testName) {
                $scope.titles[testName] = testName;
                $scope.platformList.forEach(function (platform) {
                    if (Object.keys($scope.oldStddevVariance).indexOf(platform) < 0) {
                        $scope.oldStddevVariance[platform] = { values: [], lowerIsBetter: true, frameworkID: $scope.filterOptions.framework.id };
                    }
                    if (Object.keys($scope.newStddevVariance).indexOf(platform) < 0) {
                        $scope.newStddevVariance[platform] = { values: [], lowerIsBetter: true, frameworkID: $scope.filterOptions.framework.id };
                    }

                    const oldSig = Object.keys(rawResultsMap).find(sig =>
                        rawResultsMap[sig].name === testName && rawResultsMap[sig].platform === platform,
                    );
                    const newSig = Object.keys(newRawResultsMap).find(sig =>
                        newRawResultsMap[sig].name === testName && newRawResultsMap[sig].platform === platform,
                    );

                    const cmap = PhCompare.getCounterMap(testName, rawResultsMap[oldSig], newRawResultsMap[newSig]);
                    if (cmap.isEmpty) {
                        return;
                    }

                    // No results for one or both data points
                    if (cmap.originalStddevPct !== undefined && cmap.newStddevPct !== undefined) {
                        // TODO: ideally anything >10.0 is bad, but should we ignore anything?
                        if (cmap.originalStddevPct < 50.0 && cmap.newStddevPct < 50.0) {
                            $scope.oldStddevVariance[platform].values.push(Math.round(cmap.originalStddevPct * 100) / 100);
                            $scope.newStddevVariance[platform].values.push(Math.round(cmap.newStddevPct * 100) / 100);
                        } else {
                            $scope.testsTooVariable.push({ platform: platform, testname: testName, baseStddev: cmap.originalStddevPct, newStddev: cmap.newStddevPct });
                        }
                    }
                    cmap.links = [];

                    const hasSubtests = ((rawResultsMap[oldSig] && rawResultsMap[oldSig].hasSubtests) ||
                                         (newRawResultsMap[newSig] && newRawResultsMap[newSig].hasSubtests));

                    if ($scope.originalRevision) {
                        if (hasSubtests) {
                            let detailsLink = 'perf.html#/comparesubtest?';
                            detailsLink += $httpParamSerializer({
                                originalProject: $scope.originalProject.name,
                                originalRevision: $scope.originalRevision,
                                newProject: $scope.newProject.name,
                                newRevision: $scope.newRevision,
                                originalSignature: oldSig,
                                newSignature: newSig,
                                framework: $scope.filterOptions.framework.id,
                            });
                            cmap.links.push({
                                title: 'subtests',
                                href: detailsLink,
                            });
                        }

                        cmap.links.push({
                            title: 'graph',
                            href: PhCompare.getGraphsLink([...new Set(
                                [$scope.originalProject, $scope.newProject])].map(project => ({
                                    projectName: project.name,
                                    signature: oldSig,
                                    frameworkId: $scope.filterOptions.framework.id,
                                })),
                                [$scope.originalResultSet, $scope.newResultSet]),
                        });
                    } else {
                        if (hasSubtests) {
                            let detailsLink = 'perf.html#/comparesubtest?';
                            detailsLink += $httpParamSerializer({
                                originalProject: $scope.originalProject.name,
                                newProject: $scope.newProject.name,
                                newRevision: $scope.newRevision,
                                originalSignature: oldSig,
                                newSignature: newSig,
                                framework: $scope.filterOptions.framework.id,
                                selectedTimeRange: $scope.selectedTimeRange.value,
                            });
                            cmap.links.push({
                                title: 'subtests',
                                href: detailsLink,
                            });
                        }

                        cmap.links.push({
                            title: 'graph',
                            href: PhCompare.getGraphsLink([...new Set(
                                [$scope.originalProject, $scope.newProject])].map(project => ({
                                    projectName: project.name,
                                    signature: oldSig,
                                    frameworkId: $scope.filterOptions.framework.id,
                                })),
                                [$scope.newResultSet], $scope.selectedTimeRange.value),
                        });
                    }

                    cmap.name = platform;
                    if (Object.keys($scope.compareResults).indexOf(testName) < 0) {
                        $scope.compareResults[testName] = [];
                    }
                    $scope.compareResults[testName].push(cmap);
                });
            });

            const noiseMetricTestName = 'Noise Metric';
            $scope.compareResults[noiseMetricTestName] = [];
            $scope.platformList.forEach(function (platform) {
                const cmap = PhCompare.getCounterMap(noiseMetricTestName, $scope.oldStddevVariance[platform], $scope.newStddevVariance[platform]);
                if (cmap.isEmpty) {
                    return;
                }
                cmap.name = platform;
                cmap.isNoiseMetric = true;
                $scope.compareResults[noiseMetricTestName].push(cmap);
            });

            // Remove the tests with no data, report them as well; not needed for subtests
            $scope.testNoResults = _.difference($scope.testList, Object.keys($scope.compareResults)).sort().join();
            $scope.testList = Object.keys($scope.compareResults).sort().concat([noiseMetricTestName]);
            $scope.titles[noiseMetricTestName] = noiseMetricTestName;
        }

        function load() {
            $scope.dataLoading = true;
            $scope.testList = [];
            $scope.platformList = [];

            if ($scope.originalRevision) {
                const timeRange = PhCompare.getInterval($scope.originalResultSet.push_timestamp, $scope.newResultSet.push_timestamp);
                // Optimization - if old/new branches are the same collect data in one pass
                const resultSetIds = (_.isEqual($scope.originalProject, $scope.newProject)) ?
                      [$scope.originalResultSet.id, $scope.newResultSet.id] : [$scope.originalResultSet.id];

                PhSeries.getSeriesList($scope.originalProject.name, {
                    interval: timeRange,
                    subtests: 0,
                    framework: $scope.filterOptions.framework.id,
                }).then((originalSeriesList) => {
                    $scope.platformList = [...new Set(
                        originalSeriesList.map(series => series.platform))];
                    $scope.testList = [...new Set(
                        originalSeriesList.map(series => series.name))];
                    return PhCompare.getResultsMap($scope.originalProject.name,
                                                   originalSeriesList,
                                                   { push_id: resultSetIds });
                }).then((resultMaps) => {
                    const originalResultsMap = resultMaps[$scope.originalResultSet.id];
                    const newResultsMap = resultMaps[$scope.newResultSet.id];

                    // Optimization - we collected all data in a single pass
                    if (newResultsMap) {
                        $scope.dataLoading = false;
                        displayResults(originalResultsMap, newResultsMap);
                        return;
                    }

                    PhSeries.getSeriesList($scope.newProject.name, {
                        interval: timeRange,
                        subtests: 0,
                        framework: $scope.filterOptions.framework.id,
                    }).then((newSeriesList) => {
                        $scope.platformList = _.union(
                            $scope.platformList,
                            [...new Set(newSeriesList.map(series => series.platform))]);
                        $scope.testList = _.union(
                            $scope.testList,
                            [...new Set(newSeriesList.map(series => series.name))]);
                        return PhCompare.getResultsMap($scope.newProject.name,
                                                       newSeriesList,
                                                       { push_id: [$scope.newResultSet.id] });
                    }).then((resultMaps) => {
                        $scope.dataLoading = false;
                        displayResults(originalResultsMap, resultMaps[$scope.newResultSet.id]);
                    });
                });
            } else {
                // using a range of data for baseline comparison
                PhSeries.getSeriesList($scope.originalProject.name, {
                    interval: $scope.selectedTimeRange.value,
                    subtests: 0,
                    framework: $scope.filterOptions.framework.id,
                }).then((originalSeriesList) => {
                    $scope.platformList = [...new Set(originalSeriesList.map(series => series.platform))];
                    $scope.testList = [...new Set(originalSeriesList.map(series => series.name))];
                    const startDateMs = ($scope.newResultSet.push_timestamp -
                                         $scope.selectedTimeRange.value) * 1000;
                    const endDateMs = $scope.newResultSet.push_timestamp * 1000;
                    return PhCompare.getResultsMap(
                        $scope.originalProject.name, originalSeriesList, {
                            start_date: new Date(startDateMs).toISOString().slice(0, -5),
                            end_date: new Date(endDateMs).toISOString().slice(0, -5),
                        });
                }).then((originalResultsMap) => {
                    PhSeries.getSeriesList($scope.newProject.name, {
                        interval: $scope.selectedTimeRange.value,
                        subtests: 0,
                        framework: $scope.filterOptions.framework.id,
                    }).then((newSeriesList) => {
                        $scope.platformList = _.union(
                            $scope.platformList,
                            [...new Set(newSeriesList.map(series => series.platform))],
                        );
                        $scope.testList = _.union(
                            $scope.testList,
                            [...new Set(newSeriesList.map(series => series.name))],
                        );
                        return PhCompare.getResultsMap($scope.newProject.name,
                                                       newSeriesList,
                                                       { push_id: [$scope.newResultSet.id] });
                    }).then((resultMaps) => {
                        $scope.dataLoading = false;
                        displayResults(originalResultsMap, resultMaps[$scope.newResultSet.id]);
                    });
                });
            }
        }
        // TODO: duplicated in comparesubtestctrl
        function verifyRevision(project, revision, rsid) {
            return ThResultSetModel.getResultSetsFromRevision(project.name, revision).then(
                function (resultSets) {
                    const resultSet = resultSets[0];
                    // TODO: this is a bit hacky to pass in 'original' as a text string
                    if (rsid === 'original') {
                        $scope.originalResultSet = resultSet;
                    } else {
                        $scope.newResultSet = resultSet;
                    }
                },
                function (error) {
                    $scope.errors.push(error);
                });
        }

        function updateURL() {
            const params = {
                framework: $scope.filterOptions.framework.id,
                filter: $scope.filterOptions.filter,
                showOnlyImportant: $scope.filterOptions.showOnlyImportant ? 1 : undefined,
                showOnlyComparable: $scope.filterOptions.showOnlyComparable ? 1 : undefined,
                showOnlyConfident: $scope.filterOptions.showOnlyConfident ? 1 : undefined,
                showOnlyNoise: $scope.filterOptions.showOnlyNoise ? 1 : undefined,
            };

            if ($scope.originalRevision === undefined) {
                params.selectedTimeRange = $scope.selectedTimeRange.value;
            }

            $state.transitionTo('compare', params, {
                location: true,
                inherit: true,
                relative: $state.$current,
                notify: false,
            });
        }
        $scope.timeRangeChanged = function (selectedTimeRange) {
                    // This function is used to alter
                    // $scope.selectedTimeRange for baseline comparison.
                    // selectedTimeRange is passed as parameter
                    // because angular assigns it to a different scope
            $scope.selectedTimeRange = selectedTimeRange;
            updateURL();
            load();
        };
        $scope.dataLoading = true;

        const loadRepositories = ThRepositoryModel.load();
        const loadFrameworks = PhFramework.getFrameworkList().then(
            function (frameworks) {
                $scope.frameworks = frameworks;
            });

        $q.all([loadRepositories, loadFrameworks]).then(function () {
            $scope.errors = [];
            // validation works only for revision to revision comparison
            if ($stateParams.originalRevision) {
                $scope.errors = PhCompare.validateInput($stateParams.originalProject,
                                            $stateParams.newProject,
                                            $stateParams.originalRevision,
                                            $stateParams.newRevision);

                if ($scope.errors.length > 0) {
                    $scope.dataLoading = false;
                    return;
                }
            }
            $scope.filterOptions = {
                framework: $scope.frameworks.find(fw =>
                    fw.id === parseInt($stateParams.framework),
                ) || $scope.frameworks[0],
                filter: $stateParams.filter || '',
                showOnlyImportant: Boolean($stateParams.showOnlyImportant !== undefined &&
                                           parseInt($stateParams.showOnlyImportant)),
                showOnlyComparable: Boolean($stateParams.showOnlyComparable !== undefined &&
                                           parseInt($stateParams.showOnlyComparable)),
                showOnlyConfident: Boolean($stateParams.showOnlyConfident !== undefined &&
                                           parseInt($stateParams.showOnlyConfident)),
                showOnlyNoise: Boolean($stateParams.showOnlyNoise !== undefined &&
                                           parseInt($stateParams.showOnlyNoise)),
            };

            $scope.originalProject = ThRepositoryModel.getRepo(
                $stateParams.originalProject);
            $scope.newProject = ThRepositoryModel.getRepo(
                $stateParams.newProject);
            $scope.newRevision = $stateParams.newRevision;

            // always need to verify the new revision, only sometimes the original
            const verifyPromises = [verifyRevision($scope.newProject, $scope.newRevision, 'new')];
            if ($stateParams.originalRevision) {
                $scope.originalRevision = $stateParams.originalRevision;
                verifyPromises.push(verifyRevision($scope.originalProject, $scope.originalRevision, 'original'));
            } else {
                $scope.timeRanges = phTimeRanges;
                $scope.selectedTimeRange = $scope.timeRanges.find(timeRange =>
                    timeRange.value === ($stateParams.selectedTimeRange ? parseInt($stateParams.selectedTimeRange) : phCompareBaseLineDefaultTimeRange),
                );
            }
            $q.all(verifyPromises).then(function () {
                if ($scope.errors.length > 0) {
                    $scope.dataLoading = false;
                    return;
                }
                $scope.$watchGroup(['filterOptions.filter',
                    'filterOptions.showOnlyImportant',
                    'filterOptions.showOnlyComparable',
                    'filterOptions.showOnlyConfident',
                    'filterOptions.showOnlyNoise'],
                    updateURL);

                $scope.$watch('filterOptions.framework',
                          function (newValue, oldValue) {
                              if (newValue.id !== oldValue.id) {
                                  updateURL();
                                  load();
                              }
                          });
                load();
            });
        });
    }]);

perf.controller('CompareSubtestResultsCtrl', [
    '$state', '$stateParams', '$scope',
    'ThRepositoryModel',
    'ThResultSetModel', '$q', 'PhSeries',
    'PhCompare', '$httpParamSerializer',
    function CompareSubtestResultsCtrl($state, $stateParams, $scope,
                                       ThRepositoryModel, ThResultSetModel,
                                       $q, PhSeries,
                                       PhCompare,
                                       $httpParamSerializer) {
         // TODO: duplicated from comparectrl
        function verifyRevision(project, revision, rsid) {
            return ThResultSetModel.getResultSetsFromRevision(project.name, revision).then(
               function (resultSets) {
                   const resultSet = resultSets[0];
                    // TODO: this is a bit hacky to pass in 'original' as a text string
                   if (rsid === 'original') {
                       $scope.originalResultSet = resultSet;
                   } else {
                       $scope.newResultSet = resultSet;
                   }
               },
                function (error) {
                    $scope.errors.push(error);
                });
        }

        function displayResults(rawResultsMap, newRawResultsMap) {
            $scope.compareResults = {};
            $scope.titles = {};

            const testName = $scope.testList[0];

            $scope.titles[testName] = $scope.platformList[0] + ': ' + testName;
            $scope.compareResults[testName] = [];

            $scope.subtestTitle = $scope.titles[testName];
            window.document.title = $scope.subtestTitle;

            $scope.oldStddevVariance = { values: [], lowerIsBetter: true, frameworkID: $scope.filterOptions.framework.id };
            $scope.newStddevVariance = { values: [], lowerIsBetter: true, frameworkID: $scope.filterOptions.framework.id };
            $scope.testsTooVariable = [{ testName: 'Testname', baseStddev: 'Base Stddev', newStddev: 'New Stddev' }];
            $scope.pageList.sort();
            $scope.pageList.forEach(function (page) {
                const mapsigs = [];
                [rawResultsMap, newRawResultsMap].forEach(function (resultsMap) {
                    let tempsig;
                    // If no data for a given platform, or test, display N/A in table
                    if (resultsMap) {
                        tempsig = Object.keys(resultsMap).find(sig =>
                            resultsMap[sig].name === page,
                        );
                    } else {
                        tempsig = 'undefined';
                        resultsMap = {};
                        resultsMap[tempsig] = {};
                    }
                    mapsigs.push(tempsig);
                });
                const oldSig = mapsigs[0];
                const newSig = mapsigs[1];

                const cmap = PhCompare.getCounterMap(testName, rawResultsMap[oldSig], newRawResultsMap[newSig]);
                if (oldSig === $scope.originalSignature ||
                    oldSig === $scope.newSignature ||
                    newSig === $scope.originalSignature ||
                    newSig === $scope.newSignature) {
                    cmap.highlightedTest = true;
                }

                // No results for one or both data points
                if (cmap.originalStddevPct !== undefined && cmap.newStddevPct !== undefined) {
                    // TODO: ideally anything >10.0 is bad, but should we ignore anything?
                    if (cmap.originalStddevPct < 50.0 && cmap.newStddevPct < 50.0) {
                        $scope.oldStddevVariance.values.push(Math.round(cmap.originalStddevPct * 100) / 100);
                        $scope.newStddevVariance.values.push(Math.round(cmap.newStddevPct * 100) / 100);
                    } else {
                        $scope.testsTooVariable.push({ testname: page, basStddev: cmap.originalStddevPct, newStddev: cmap.newStddevPct });
                    }
                }

                cmap.name = page;
                if ($scope.originalRevision) {
                    cmap.links = [{
                        title: 'graph',
                        href: PhCompare.getGraphsLink([...new Set([
                            $scope.originalProject,
                            $scope.newProject,
                        ])].map(project => ({
                            projectName: project.name,
                            signature: oldSig,
                            frameworkId: $scope.filterOptions.framework,
                        })), [$scope.originalResultSet, $scope.newResultSet]),
                    }];
                    // replicate distribution is added only for talos
                    if ($scope.filterOptions.framework === '1') {
                        cmap.links.push({
                            title: 'replicates',
                            href: 'perf.html#/comparesubtestdistribution?' + $httpParamSerializer({
                                originalProject: $scope.originalProject.name,
                                newProject: $scope.newProject.name,
                                originalRevision: $scope.originalRevision,
                                newRevision: $scope.newRevision,
                                originalSubtestSignature: oldSig,
                                newSubtestSignature: newSig,
                            }),
                        });
                    }
                } else {
                    cmap.links = [{
                        title: 'graph',
                        href: PhCompare.getGraphsLink([...new Set([
                            $scope.originalProject,
                            $scope.newProject,
                        ])].map(project => ({
                            projectName: project.name,
                            signature: oldSig,
                            frameworkId: $scope.filterOptions.framework,
                        })), [$scope.newResultSet], $scope.selectedTimeRange.value),
                    }];
                }
                $scope.compareResults[testName].push(cmap);
            });

            const noiseMetricTestName = 'Noise Metric';
            $scope.compareResults[noiseMetricTestName] = [];
            const cmap = PhCompare.getCounterMap(noiseMetricTestName, $scope.oldStddevVariance, $scope.newStddevVariance);
            if (!cmap.isEmpty) {
                cmap.name = testName;
                cmap.isNoiseMetric = true;
                $scope.compareResults[noiseMetricTestName].push(cmap);
            }
            $scope.titles[noiseMetricTestName] = $scope.platformList[0] + ': ' + testName + ' : ' + noiseMetricTestName;
        }

        $scope.dataLoading = true;

        ThRepositoryModel.load().then(function () {

            $scope.errors = [];
            if ($stateParams.originalRevision) {
                $scope.errors = PhCompare.validateInput($stateParams.originalProject,
                                                    $stateParams.newProject,
                                                    $stateParams.originalRevision,
                                                    $stateParams.newRevision,
                                                    $stateParams.originalSignature,
                                                    $stateParams.newSignature);

                if ($scope.errors.length > 0) {
                    $scope.dataLoading = false;
                    return;
                }
            }

            $scope.originalProject = ThRepositoryModel.getRepo(
                $stateParams.originalProject);
            $scope.newProject = ThRepositoryModel.getRepo(
                $stateParams.newProject);
            $scope.newRevision = $stateParams.newRevision;
            $scope.originalSignature = $stateParams.originalSignature;
            $scope.newSignature = $stateParams.newSignature;

            // always need to verify the new revision, only sometimes the original
            const verifyPromises = [verifyRevision($scope.newProject, $scope.newRevision, 'new')];
            if ($stateParams.originalRevision) {
                $scope.originalRevision = $stateParams.originalRevision;
                verifyPromises.push(verifyRevision($scope.originalProject, $scope.originalRevision, 'original'));
            } else {
                $scope.timeRanges = phTimeRanges;
                $scope.selectedTimeRange = $scope.timeRanges.find(timeRange =>
                    timeRange.value === ($stateParams.selectedTimeRange ? parseInt($stateParams.selectedTimeRange) : phCompareBaseLineDefaultTimeRange),
                );
            }

            $q.all(verifyPromises).then(function () {
                $scope.pageList = [];

                if ($scope.errors.length > 0) {
                    $scope.dataLoading = false;
                    return;
                }

                let resultSetIds;
                if ($scope.originalRevision) {
                    resultSetIds = [$scope.originalResultSet.id];

                    // Optimization - if old/new branches are the same collect data in one pass
                    if ($scope.originalProject === $scope.newProject) {
                        resultSetIds = [$scope.originalResultSet.id, $scope.newResultSet.id];
                    }
                }

                $scope.filterOptions = {
                    framework: $stateParams.framework || 1, // 1 == talos
                    filter: $stateParams.filter || '',
                    showOnlyImportant: Boolean($stateParams.showOnlyImportant !== undefined &&
                                               parseInt($stateParams.showOnlyImportant)),
                    showOnlyComparable: Boolean($stateParams.showOnlyComparable !== undefined &&
                                               parseInt($stateParams.showOnlyComparable)),
                    showOnlyConfident: Boolean($stateParams.showOnlyConfident !== undefined &&
                                               parseInt($stateParams.showOnlyConfident)),
                    showOnlyNoise: Boolean($stateParams.showOnlyNoise !== undefined &&
                                               parseInt($stateParams.showOnlyNoise)),
                };

                $scope.$watchGroup([
                    'filterOptions.filter',
                    'filterOptions.showOnlyImportant',
                    'filterOptions.showOnlyComparable',
                    'filterOptions.showOnlyConfident',
                    'filterOptions.showOnlyNoise',
                ], function () {
                    $state.transitionTo('comparesubtest', {
                        filter: $scope.filterOptions.filter,
                        showOnlyImportant: $scope.filterOptions.showOnlyImportant ? 1 : undefined,
                        showOnlyComparable: $scope.filterOptions.showOnlyComparable ? 1 : undefined,
                        showOnlyConfident: $scope.filterOptions.showOnlyConfident ? 1 : undefined,
                        showOnlyNoise: $scope.filterOptions.showOnlyNoise ? 1 : undefined,
                    }, {
                        location: true,
                        inherit: true,
                        relative: $state.$current,
                        notify: false,
                    });
                });

                $scope.timeRangeChanged = function (selectedTimeRange) {
                    // This function is used to alter
                    // $scope.selectedTimeRange for baseline comparison.
                    // selectedTimeRange is passed as parameter
                    // because angular assigns it to a different scope
                    $scope.selectedTimeRange = selectedTimeRange;
                    $state.go('comparesubtest', {
                        filter: $scope.filterOptions.filter,
                        showOnlyImportant: $scope.filterOptions.showOnlyImportant ? 1 : undefined,
                        showOnlyComparable: $scope.filterOptions.showOnlyComparable ? 1 : undefined,
                        showOnlyConfident: $scope.filterOptions.showOnlyConfident ? 1 : undefined,
                        selectedTimeRange: $scope.selectedTimeRange.value,
                    });
                };
                if ($scope.originalRevision) {
                    $q.all([
                        PhSeries.getSeriesList(
                            $scope.originalProject.name, {
                                signature: $scope.originalSignature,
                                framework: $scope.filterOptions.framework,
                            }).then(function (originalSeries) {
                                $scope.testList = [originalSeries[0].name];
                                return undefined;
                            }),
                        PhSeries.getSeriesList(
                            $scope.originalProject.name,
                            {
                                parent_signature: $scope.originalSignature,
                                framework: $scope.filterOptions.framework,
                            }).then(function (originalSubtestList) {
                                $scope.pageList = originalSubtestList.map(subtest => subtest.name);
                                $scope.platformList = [...new Set(originalSubtestList.map(subtest => subtest.platform))];
                                return PhCompare.getResultsMap($scope.originalProject.name,
                                    originalSubtestList,
                                    { push_id: resultSetIds });
                            }),
                    ]).then(function (results) {
                        const originalSeriesMap = results[1][$scope.originalResultSet.id];
                        const newSeriesMap = results[1][$scope.newResultSet.id];
                        [originalSeriesMap, newSeriesMap].forEach(function (seriesMap) {
                            // If there is no data for a given signature, handle it gracefully
                            if (seriesMap) {
                                Object.keys(seriesMap).forEach(function (series) {
                                    if ($scope.pageList.indexOf(seriesMap[series].name) === -1) {
                                        $scope.pageList.push(seriesMap[series].name);
                                    }
                                });
                            }
                        });

                        // Optimization- collect all data in a single pass
                        if (newSeriesMap) {
                            $scope.dataLoading = false;
                            displayResults(originalSeriesMap, newSeriesMap);
                            return;
                        }

                        if ($scope.newSignature) {
                            PhSeries.getSeriesList(
                            $scope.newProject.name, {
                                parent_signature: $scope.newSignature,
                                framework: $scope.filterOptions.framework,
                            }).then(function (newSeriesList) {
                                $scope.platformList = [...new Set(_.union(
                                    $scope.platformList,
                                    newSeriesList.map(series => series.platform)))];
                                $scope.testList = [...new Set(_.union(
                                    $scope.testList,
                                    newSeriesList.map(series => series.name)))];

                                return PhCompare.getResultsMap($scope.newProject.name,
                                    newSeriesList,
                                    { push_id: [$scope.newResultSet.id] });
                            }).then(function (newSeriesMaps) {
                                let newSeriesMap = newSeriesMaps[$scope.newResultSet.id];
                                // There is a chance that we haven't received data for the given signature/resultSet yet
                                if (newSeriesMap) {
                                    Object.keys(newSeriesMap).forEach(function (series) {
                                        if ($scope.pageList.indexOf(newSeriesMap[series].name) === -1) {
                                            $scope.pageList.push(newSeriesMap[series].name);
                                        }
                                    });
                                } else {
                                    newSeriesMap = {};
                                }
                                $scope.dataLoading = false;
                                displayResults(originalSeriesMap, newSeriesMap);
                            });
                        } else {
                            $scope.dataLoading = false;
                            displayResults(originalSeriesMap, {});
                        }
                    });
                } else {
                    $q.all([
                        PhSeries.getSeriesList(
                            $scope.originalProject.name, {
                                signature: $scope.originalSignature,
                                framework: $scope.filterOptions.framework,
                            }).then(function (originalSeries) {
                                $scope.testList = [originalSeries[0].name];
                                return undefined;
                            }),
                        PhSeries.getSeriesList(
                            $scope.originalProject.name,
                            {
                                parent_signature: $scope.originalSignature,
                                framework: $scope.filterOptions.framework,
                            }).then(function (originalSubtestList) {
                                $scope.pageList = originalSubtestList.map(subtest => subtest.name);
                                $scope.platformList = [...new Set(originalSubtestList.map(subtest => subtest.platform))];
                                const startDateMs = ($scope.newResultSet.push_timestamp -
                                                     $scope.selectedTimeRange.value) * 1000;
                                const endDateMs = $scope.newResultSet.push_timestamp * 1000;
                                return PhCompare.getResultsMap(
                                    $scope.originalProject.name,
                                    originalSubtestList, {
                                        start_date: new Date(startDateMs).toISOString().slice(0, -5),
                                        end_date: new Date(endDateMs).toISOString().slice(0, -5),
                                    });
                            }),
                    ]).then(
                        function (originalResults) {
                            const originalSeriesMap = originalResults[1];
                            if ($scope.newSignature) {
                                PhSeries.getSeriesList(
                                $scope.newProject.name, {
                                    parent_signature: $scope.newSignature,
                                    framework: $scope.filterOptions.framework,
                                }).then(function (newSeriesList) {
                                    $scope.platformList = [...new Set(_.union(
                                        $scope.platformList,
                                        newSeriesList.map(series => series.platform)))];
                                    $scope.testList = [...new Set(_.union(
                                        $scope.testList,
                                        newSeriesList.map(series => series.name)))];

                                    return PhCompare.getResultsMap($scope.newProject.name,
                                        newSeriesList,
                                        { push_id: [$scope.newResultSet.id] });
                                }).then(function (newSeriesMaps) {
                                    let newSeriesMap = newSeriesMaps[$scope.newResultSet.id];
                                    // There is a chance that we haven't received data for the given signature/resultSet yet
                                    if (newSeriesMap) {
                                        Object.keys(newSeriesMap).forEach(function (series) {
                                            if ($scope.pageList.indexOf(newSeriesMap[series].name) === -1) {
                                                $scope.pageList.push(newSeriesMap[series].name);
                                            }
                                        });
                                    } else {
                                        newSeriesMap = {};
                                    }
                                    $scope.dataLoading = false;
                                    displayResults(originalSeriesMap, newSeriesMap);
                                });
                            } else {
                                $scope.dataLoading = false;
                                displayResults(originalSeriesMap, {});
                            }
                        });
                }
            });
        });
    }]);

perf.controller('CompareSubtestDistributionCtrl', ['$scope', '$stateParams', '$q', 'ThRepositoryModel',
    'PhSeries', 'ThResultSetModel',
    function CompareSubtestDistributionCtrl($scope, $stateParams, $q, ThRepositoryModel,
        PhSeries, ThResultSetModel) {
        $scope.originalRevision = $stateParams.originalRevision;
        $scope.newRevision = $stateParams.newRevision;
        $scope.originalSubtestSignature = $stateParams.originalSubtestSignature;
        $scope.newSubtestSignature = $stateParams.newSubtestSignature;
        $scope.dataLoading = true;
        const loadRepositories = ThRepositoryModel.load();
        const fetchAndDrawReplicateGraph = function (project, revision, subtestSignature, target) {
            const replicateData = {};
            return ThResultSetModel.getResultSetsFromRevision(project, revision).then(
                (revisionData) => {
                    replicateData.resultSet = revisionData[0];
                    return PhSeries.getSeriesData(project, {
                        signatures: subtestSignature,
                        push_id: replicateData.resultSet.id,
                    });
                }).then((perfDatumList) => {
                    if (!perfDatumList[subtestSignature]) {
                        replicateData.replicateDataError = true;
                        return;
                    }
                    const numRuns = perfDatumList[subtestSignature].length;
                    const replicatePromises = perfDatumList[subtestSignature].map(
                        value => PhSeries.getReplicateData({ job_id: value.job_id }));
                    return $q.all(replicatePromises).then((replicateData) => {
                        let replicateValues = replicateData.concat.apply([],
                                replicateData.map((data) => {
                                    const testSuite = data.suites.find(suite => suite.name === $scope.testSuite);
                                    const subtest = testSuite.subtests.find(subtest => subtest.name === $scope.subtest);
                                    return subtest.replicates;
                                }),
                            );
                        // metrics-graphics doesn't accept "0" as x_accesor
                        replicateValues = replicateValues.map((value, index) => ({
                            replicate: (index + 1).toString(),
                            value: value,
                        }));
                        metricsgraphics.data_graphic({
                            title: `${target} replicates over ${numRuns} run${(numRuns > 1) ? 's' : ''}`,
                            chart_type: 'bar',
                            data: replicateValues,
                            y_accessor: 'value',
                            x_accessor: 'replicate',
                            height: 275,
                            width: 1000,
                            target: `#${target}`,
                        });
                    },
                    () => {
                        replicateData.replicateDataError = true;
                    });
                }).then(() => {
                    if (replicateData.replicateDataError) {
                        metricsgraphics.data_graphic({
                            title: `${target} Replicates`,
                            chart_type: 'missing-data',
                            missing_text: 'No Data Found',
                            target: `#${target}`,
                            width: 1000,
                            height: 275,
                        });
                    }
                    return replicateData;
                });
        };

        $q.all([loadRepositories]).then(() => {
            $scope.originalProject = ThRepositoryModel.getRepo(
                $stateParams.originalProject);
            $scope.newProject = ThRepositoryModel.getRepo(
                $stateParams.newProject);
            PhSeries.getSeriesList($scope.originalProject.name, { signature: $scope.originalSubtestSignature }).then(
                (seriesData) => {
                    $scope.testSuite = seriesData[0].suite;
                    $scope.subtest = seriesData[0].test;
                    $scope.testName = seriesData[0].name;
                    $scope.platform = seriesData[0].platform;
                    return fetchAndDrawReplicateGraph($scope.originalProject.name,
                                              $scope.originalRevision,
                                              $scope.originalSubtestSignature,
                                              'Base');
                }).then((result) => {
                    $scope.originalResultSet = result.resultSet;
                    $scope.originalReplicateError = result.replicateDataError;
                    return fetchAndDrawReplicateGraph($scope.newProject.name,
                                              $scope.newRevision,
                                              $scope.newSubtestSignature,
                                              'New');
                }).then((result) => {
                    $scope.newResultSet = result.resultSet;
                    $scope.newReplicateError = result.replicateDataError;
                    window.document.title = `${$scope.platform}: ${$scope.testName}`;
                    $scope.dataLoading = false;
                });
        });
    },
]);
