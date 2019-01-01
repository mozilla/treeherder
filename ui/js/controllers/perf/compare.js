// Remove the eslint-disable when rewriting this file during the React conversion.
/* eslint-disable func-names, object-shorthand, prefer-arrow-callback, prefer-destructuring, prefer-template, radix */
import difference from 'lodash/difference';
import metricsgraphics from 'metrics-graphics';

import perf from '../../perf';
import { endpoints } from '../../../perfherder/constants';
import {
  phTimeRanges,
  compareDefaultTimeRange,
} from '../../../helpers/constants';
import PushModel from '../../../models/push';
import RepositoryModel from '../../../models/repository';
import PerfSeriesModel from '../../../models/perfSeries';
import { getCounterMap, getInterval, validateQueryParams, getGraphsLink } from '../../../perfherder/helpers';
import { getApiUrl, createApiUrl, perfByRevisionEndpoint } from '../../../helpers/url';
import { getData } from '../../../helpers/http';


perf.controller('CompareResultsCtrl', [
    '$state', '$stateParams', '$scope',
    '$httpParamSerializer', '$q',
    function CompareResultsCtrl($state, $stateParams, $scope,
                                $httpParamSerializer, $q) {
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
                    const oldResults = rawResultsMap.find(sig =>
                        sig.name === testName && sig.platform === platform
                    );
                    const newResults = newRawResultsMap.find(sig =>
                        sig.name === testName && sig.platform === platform
                    );
                    const cmap = getCounterMap(testName, oldResults, newResults);
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
                    const hasSubtests = ((oldResults && oldResults.has_subtests) || (newResults && newResults.has_subtests));

                    if ($scope.originalRevision) {
                        if (hasSubtests) {
                            let detailsLink = 'perf.html#/comparesubtest?';
                            detailsLink += $httpParamSerializer({
                                originalProject: $scope.originalProject.name,
                                originalRevision: $scope.originalRevision,
                                newProject: $scope.newProject.name,
                                newRevision: $scope.newRevision,
                                originalSignature: oldResults ? oldResults.signature_hash : null,
                                newSignature: oldResults ? newResults.signature_hash : null,
                                framework: $scope.filterOptions.framework.id,
                            });
                            cmap.links.push({
                                title: 'subtests',
                                href: detailsLink,
                            });
                        }

                        cmap.links.push({
                            title: 'graph',
                            href: getGraphsLink([...new Set(
                                [$scope.originalProject, $scope.newProject])].map(project => ({
                                    projectName: project.name,
                                    signature: oldResults.signature_hash,
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
                                originalSignature: oldResults ? oldResults.signature_hash : null,
                                newSignature: newResults ? newResults.signature_hash : null,
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
                            href: getGraphsLink([...new Set(
                                [$scope.originalProject, $scope.newProject])].map(project => ({
                                    projectName: project.name,
                                    signature: oldResults.signature_hash,
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
                const cmap = getCounterMap(noiseMetricTestName, $scope.oldStddevVariance[platform], $scope.newStddevVariance[platform]);
                if (cmap.isEmpty) {
                    return;
                }
                cmap.name = platform;
                cmap.isNoiseMetric = true;
                $scope.compareResults[noiseMetricTestName].push(cmap);
            });

            // Remove the tests with no data, report them as well; not needed for subtests
            $scope.testNoResults = difference($scope.testList, Object.keys($scope.compareResults)).sort().join();
            $scope.testList = Object.keys($scope.compareResults).sort().concat([noiseMetricTestName]);
            $scope.titles[noiseMetricTestName] = noiseMetricTestName;

            // call $apply explicitly so we don't have to worry about when promises
            // get resolved (see bug 1470600)
            $scope.$apply();
        }

        const createQueryParams = (repository, interval) => ({
            repository,
            framework: $scope.filterOptions.framework.id,
            interval,
            no_subtests: true,
        });

        async function load() {
            $scope.dataLoading = true;
            $scope.testList = [];
            $scope.platformList = [];
            let originalParams;
            let interval;

            if ($scope.originalRevision) {
                interval = getInterval($scope.originalResultSet.push_timestamp, $scope.newResultSet.push_timestamp);
                originalParams = createQueryParams($scope.originalProject.name, interval);
                originalParams.revision = $scope.originalResultSet.id;
            } else {
                interval = $scope.selectedTimeRange.value;
                const startDateMs = ($scope.newResultSet.push_timestamp - interval) * 1000;
                const endDateMs = $scope.newResultSet.push_timestamp * 1000;
                
                originalParams = createQueryParams($scope.originalProject.name, interval);
                originalParams.startday = new Date(startDateMs).toISOString().slice(0, -5);
                originalParams.endday = new Date(endDateMs).toISOString().slice(0, -5);
            }

            const newParams = createQueryParams($scope.newProject.name, interval);
            newParams.revision = $scope.newResultSet.id;

            const [originalResults, newResults] = await Promise.all([getData(createApiUrl(perfByRevisionEndpoint, originalParams)),
                getData(createApiUrl(perfByRevisionEndpoint, newParams))]);
                
            $scope.dataLoading = false;

            const data = [...originalResults.data, ...newResults.data];
            $scope.platformList = [...new Set(data.map(item => item.platform))];
            $scope.testList = [...new Set(data.map(item => item.name))];

            return displayResults(originalResults.data, newResults.data);
            
        }
        // TODO: duplicated in comparesubtestctrl
        function verifyRevision(project, revision, rsid) {

            return PushModel.getList({ repo: project.name, revision })
                .then(async (resp) => {
                    if (resp.ok) {
                        const { results } = await resp.json();
                        const resultSet = results[0];
                        // TODO: this is a bit hacky to pass in 'original' as a text string
                        if (rsid === 'original') {
                            $scope.originalResultSet = resultSet;
                        } else {
                            $scope.newResultSet = resultSet;
                        }
                    } else {
                      const error = await resp.text();
                      $scope.errors.push(error);
                    }
                }).catch((error) => {
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

        const loadRepositories = RepositoryModel.getList();
        const loadFrameworks = getData(getApiUrl(endpoints.frameworks)).then(({ data: frameworks }) => {
                $scope.frameworks = frameworks;
            });

        $q.all([loadRepositories, loadFrameworks]).then(function ([repos]) {
            $scope.errors = [];
            // validation works only for revision to revision comparison
            if ($stateParams.originalRevision) {
                $scope.errors = validateQueryParams($stateParams);

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

            $scope.originalProject = RepositoryModel.getRepo(
                $stateParams.originalProject, repos);
            $scope.newProject = RepositoryModel.getRepo(
                $stateParams.newProject, repos);
            $scope.newRevision = $stateParams.newRevision;

            // always need to verify the new revision, only sometimes the original
            const verifyPromises = [verifyRevision($scope.newProject, $scope.newRevision, 'new')];
            if ($stateParams.originalRevision) {
                $scope.originalRevision = $stateParams.originalRevision;
                verifyPromises.push(verifyRevision($scope.originalProject, $scope.originalRevision, 'original'));
            } else {
                $scope.timeRanges = phTimeRanges;
                $scope.selectedTimeRange = $scope.timeRanges.find(timeRange =>
                    timeRange.value === ($stateParams.selectedTimeRange ? parseInt($stateParams.selectedTimeRange) : compareDefaultTimeRange),
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
    '$state', '$stateParams', '$scope', '$q',
    '$httpParamSerializer',
    function CompareSubtestResultsCtrl($state, $stateParams, $scope, $q,
                                       $httpParamSerializer) {
         // TODO: duplicated from comparectrl
        function verifyRevision(project, revision, rsid) {
            return PushModel.getList({ repo: project.name, revision })
                .then(async (resp) => {
                   const { results } = await resp.json();
                   const resultSet = results[0];
                    // TODO: this is a bit hacky to pass in 'original' as a text string
                   if (rsid === 'original') {
                       $scope.originalResultSet = resultSet;
                   } else {
                       $scope.newResultSet = resultSet;
                   }
                   $scope.$apply();
               },
                function (error) {
                    $scope.errors.push(error);
                });
        }

        function displayResults(rawResultsMap, newRawResultsMap) {

            $scope.compareResults = {};
            $scope.titles = {};

            const testName = $scope.subtestTitle;

            $scope.titles[testName] = `${$scope.platformList[0]}: ${testName}`;
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
                        tempsig = resultsMap.find(sig => sig.test === page);
                    } else {
                        tempsig = 'undefined';
                        resultsMap = {};
                        resultsMap[tempsig] = {};
                    }
                    mapsigs.push(tempsig);
                });
                const oldData = mapsigs[0];
                const newData = mapsigs[1];

                const cmap = getCounterMap(testName, oldData, newData);
                if (oldData.parent_signature === $scope.originalSignature ||
                    oldData.parent_signature === $scope.newSignature ||
                    newData.parent_signature === $scope.originalSignature ||
                    newData.parent_signature === $scope.newSignature) {
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
                        href: getGraphsLink([...new Set([
                            $scope.originalProject,
                            $scope.newProject,
                        ])].map(project => ({
                            projectName: project.name,
                            signature: oldData.signature_hash,
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
                                originalSubtestSignature: oldData.signature_hash,
                                newSubtestSignature: newData.signature_hash,
                            }),
                        });
                    }
                } else {
                    cmap.links = [{
                        title: 'graph',
                        href: getGraphsLink([...new Set([
                            $scope.originalProject,
                            $scope.newProject,
                        ])].map(project => ({
                            projectName: project.name,
                            signature: oldData.signature_hash,
                            frameworkId: $scope.filterOptions.framework,
                        })), [$scope.newResultSet], $scope.selectedTimeRange.value),
                    }];
                }
                $scope.compareResults[testName].push(cmap);
            });

            const noiseMetricTestName = 'Noise Metric';
            $scope.compareResults[noiseMetricTestName] = [];
            const cmap = getCounterMap(noiseMetricTestName, $scope.oldStddevVariance, $scope.newStddevVariance);
            if (!cmap.isEmpty) {
                cmap.name = testName;
                cmap.isNoiseMetric = true;
                $scope.compareResults[noiseMetricTestName].push(cmap);
            }
            $scope.titles[noiseMetricTestName] = $scope.platformList[0] + ': ' + testName + ' : ' + noiseMetricTestName;

            // call $apply explicitly so we don't have to worry about when promises
            // get resolved (see bug 1470600)
            $scope.$apply();
        }

        async function fetchData() {
            const createQueryParams = (parent_signature, repository) => ({
                parent_signature,
                framework: $scope.filterOptions.framework,
                repository,
            });
            
            const originalParams = createQueryParams($scope.originalSignature, $scope.originalProject.name);
            let results;
            let newResults;
            let originalResults;

            if ($scope.originalRevision) {
                originalParams.revision = $scope.originalResultSet.id;
            } else {
                // TODO create a helper for the startday and endday since this is also used in compare view
                const startDateMs = ($scope.newResultSet.push_timestamp -
                    $scope.selectedTimeRange.value) * 1000;
                const endDateMs = $scope.newResultSet.push_timestamp * 1000;

                originalParams.startday = new Date(startDateMs).toISOString().slice(0, -5);
                originalParams.endday = new Date(endDateMs).toISOString().slice(0, -5);
            }

            // Is there ever a use case where originalSignature is provided but newSignature isn't?
            if ($scope.newSignature) {
                const newParams = createQueryParams($scope.newSignature, $scope.newProject.name);
                newParams.revision = $scope.newResultSet.id;

                [{ data: originalResults}, { data: newResults }] = await Promise.all([getData(createApiUrl(perfByRevisionEndpoint, originalParams)),
                    getData(createApiUrl(perfByRevisionEndpoint, newParams))]);
                
                $scope.dataLoading = false;

                results = [...originalResults, ...newResults];    
            } else {
                ({ data: originalResults } = await getData(createApiUrl(perfByRevisionEndpoint, originalParams)));
                $scope.dataLoading = false;
                results = originalResults;
            }

            const subtestName = results[0].name.split(' ');
            subtestName.splice(1, 1);
            $scope.subtestTitle = subtestName.join(' ');

            $scope.pageList = [...new Set(results.map(subtest => subtest.test))];
            $scope.platformList = [...new Set(results.map(subtest => subtest.platform))];

            return displayResults(originalResults, newResults || {});
        }

        $scope.dataLoading = true;

        RepositoryModel.getList().then((repos) => {
            $scope.errors = [];
            if ($stateParams.originalRevision) {
                $scope.errors = validateQueryParams($stateParams);

                if ($scope.errors.length > 0) {
                    $scope.dataLoading = false;
                    return;
                }
            }

            $scope.originalProject = RepositoryModel.getRepo(
                $stateParams.originalProject, repos);
            $scope.newProject = RepositoryModel.getRepo(
                $stateParams.newProject, repos);
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
                    timeRange.value === ($stateParams.selectedTimeRange ? parseInt($stateParams.selectedTimeRange) : compareDefaultTimeRange),
                );
            }

            $q.all(verifyPromises).then(function () {
                $scope.pageList = [];

                if ($scope.errors.length > 0) {
                    $scope.dataLoading = false;
                    return;
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

                fetchData()
            });
        });
    }]);

perf.controller('CompareSubtestDistributionCtrl', ['$scope', '$stateParams', '$q',
    function CompareSubtestDistributionCtrl($scope, $stateParams, $q) {
        $scope.originalRevision = $stateParams.originalRevision;
        $scope.newRevision = $stateParams.newRevision;
        $scope.originalSubtestSignature = $stateParams.originalSubtestSignature;
        $scope.newSubtestSignature = $stateParams.newSubtestSignature;
        $scope.dataLoading = true;
        const loadRepositories = RepositoryModel.getList();
        const fetchAndDrawReplicateGraph = function (project, revision, subtestSignature, target) {
            const replicateData = {};

            return PushModel.getList({ repo: project, revision })
                .then(async (resp) => {
                    const { results } = await resp.json();
                    replicateData.resultSet = results[0];
                    return PerfSeriesModel.getSeriesData(project, {
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
                        value => PerfSeriesModel.getReplicateData({ job_id: value.job_id }));
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

        $q.all([loadRepositories]).then((results) => {
            const repos = results[0];
            $scope.originalProject = RepositoryModel.getRepo(
                $stateParams.originalProject, repos);
            $scope.newProject = RepositoryModel.getRepo(
                $stateParams.newProject, repos);
            PerfSeriesModel.getSeriesList($scope.originalProject.name, { signature: $scope.originalSubtestSignature }).then(
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
                    $scope.$apply();
                });
        });
    },
]);
