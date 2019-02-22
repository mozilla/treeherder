// Remove the eslint-disable when rewriting this file during the React conversion.
/* eslint-disable func-names, prefer-template, radix */
import perf from '../../perf';
import { noiseMetricTitle } from '../../../perfherder/constants';
import {
  phTimeRanges,
  compareDefaultTimeRange,
} from '../../../helpers/constants';
import PushModel from '../../../models/push';
import RepositoryModel from '../../../models/repository';
import { getCounterMap, getGraphsLink, validateQueryParams  } from '../../../perfherder/helpers';
import {  createApiUrl, perfSummaryEndpoint } from '../../../helpers/url';
import { getData } from '../../../helpers/http';

const createNoiseMetric = (cmap, name, compareResults) => {
    cmap.name = name;
    cmap.isNoiseMetric = true;

    if (compareResults.has(noiseMetricTitle)) {
        compareResults.get(noiseMetricTitle).push(cmap);
    } else {
        compareResults.set(noiseMetricTitle, [cmap]);
    }
}

async function verifyRevision(project, revision, rsid, $scope) {
    const { data, failureStatus } = await PushModel.getList({ repo: project.name, commit_revision: revision })
    if (failureStatus) {
        return $scope.errors.push(data);
    }
    if (!data.results.length) {
        return $scope.errors.push('No results found for this revision');
    }
    const resultSet = data.results[0];
    // TODO: this is a bit hacky to pass in 'original' as a text string
    if (rsid === 'original') {
        $scope.originalResultSet = resultSet;
    } else {
        $scope.newResultSet = resultSet;
    }
}

perf.controller('CompareSubtestResultsCtrl', [
    '$state', '$stateParams', '$scope', '$q',
    '$httpParamSerializer',
    function CompareSubtestResultsCtrl($state, $stateParams, $scope, $q,
                                       $httpParamSerializer) {

        function displayResults(rawResultsMap, newRawResultsMap) {

            $scope.compareResults = new Map();
            $scope.titles = {};

            const testName = $scope.subtestTitle;

            $scope.titles[testName] = `${$scope.platformList[0]}: ${testName}`;

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
                if ((oldData && oldData.parent_signature === $scope.originalSignature) ||
                    (oldData && oldData.parent_signature === $scope.newSignature) ||
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
                            signature: !oldData ? newData.signature_id : oldData.signature_id,
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
                                originalSubtestSignature: oldData ? oldData.signature_id : null,
                                newSubtestSignature: newData ? newData.signature_id: null,
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
                            signature: !oldData ? newData.signature_id : oldData.signature_id,
                            frameworkId: $scope.filterOptions.framework,
                        })), [$scope.newResultSet], $scope.selectedTimeRange.value),
                    }];
                }
                if ($scope.compareResults.has(testName)) {
                    $scope.compareResults.get(testName).push(cmap);
                } else {
                    $scope.compareResults.set(testName, [cmap]);
                }

            });

            const cmap = getCounterMap(noiseMetricTitle, $scope.oldStddevVariance, $scope.newStddevVariance);
            if (!cmap.isEmpty) {
                createNoiseMetric(cmap, testName, $scope.compareResults)
            }

            // call $apply explicitly so we don't have to worry about when promises
            // get resolved (see bug 1470600)
            $scope.$apply();
        }

        $scope.updateNoiseAlert = function() {
            $scope.filterOptions.showOnlyNoise = !$scope.filterOptions.showOnlyNoise;
            $scope.$apply();
        }

        async function fetchData() {
            const createQueryParams = (parent_signature, repository) => ({
                parent_signature,
                framework: $scope.filterOptions.framework,
                repository,
            });
            
            const originalParams = createQueryParams($scope.originalSignature, $scope.originalProject.name);

            if ($scope.originalRevision) {
                originalParams.revision = $scope.originalResultSet.revision;
            } else {
                // TODO create a helper for the startday and endday since this is also used in compare view
                const startDateMs = ($scope.newResultSet.push_timestamp -
                    $scope.selectedTimeRange.value) * 1000;
                const endDateMs = $scope.newResultSet.push_timestamp * 1000;

                originalParams.startday = new Date(startDateMs).toISOString().slice(0, -5);
                originalParams.endday = new Date(endDateMs).toISOString().slice(0, -5);
            }

            const newParams = createQueryParams($scope.newSignature, $scope.newProject.name);
            newParams.revision = $scope.newResultSet.revision;

            const [originalResults, newResults] = await Promise.all([getData(createApiUrl(perfSummaryEndpoint, originalParams)),
                getData(createApiUrl(perfSummaryEndpoint, newParams))]);
            
            $scope.dataLoading = false;

            const results = [...originalResults.data, ...newResults.data];

            const subtestName = results[0].name.split(' ');
            subtestName.splice(1, 1);
            $scope.subtestTitle = subtestName.join(' ');

            $scope.pageList = [...new Set(results.map(subtest => subtest.test))].sort();
            $scope.platformList = [...new Set(results.map(subtest => subtest.platform))].sort();

            return displayResults(originalResults.data, newResults.data);
        }

        $scope.dataLoading = true;

        RepositoryModel.getList().then(async (repos) => {
            $scope.errors = [];
            if ($stateParams.originalRevision) {
                $scope.errors = await validateQueryParams($stateParams);

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
            const verifyPromises = [verifyRevision($scope.newProject, $scope.newRevision, 'new', $scope)];
            if ($stateParams.originalRevision) {
                $scope.originalRevision = $stateParams.originalRevision;
                verifyPromises.push(verifyRevision($scope.originalProject, $scope.originalRevision, 'original', $scope));
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
