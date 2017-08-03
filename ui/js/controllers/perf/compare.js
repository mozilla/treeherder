"use strict";

perf.controller('CompareChooserCtrl', [
    '$state', '$stateParams', '$scope', '$q', 'ThRepositoryModel', 'ThResultSetModel',
    'phCompareDefaultNewRepo', 'phCompareDefaultOriginalRepo', 'JsonPushes',
    'thPerformanceBranches', 'localStorageService', 'compareBaseLineDefaultTimeRange',
    function CompareChooserCtrl($state, $stateParams, $scope, $q,
                                ThRepositoryModel, ThResultSetModel,
                                phCompareDefaultNewRepo,
                                phCompareDefaultOriginalRepo,
                                JsonPushes, thPerformanceBranches,
                                localStorageService,
                                compareBaseLineDefaultTimeRange) {
        ThRepositoryModel.get_list().success(function (projects) {
            $scope.projects = projects;
            $scope.originalTipList = [];
            $scope.newTipList = [];
            $scope.revisionComparison = false;

            var getParameter = function (paramName, defaultValue) {
                if ($stateParams[paramName])
                    return $stateParams[paramName];
                else if (localStorageService.get(paramName))
                    return localStorageService.get(paramName);
                return defaultValue;
            };

            $scope.originalProject = _.find(projects, {
                name: getParameter('originalProject', phCompareDefaultOriginalRepo)
            }) || projects[0];
            $scope.newProject = _.find(projects, {
                name: getParameter('newProject', phCompareDefaultNewRepo)
            }) || projects[0];

            $scope.originalRevision = getParameter('originalRevision', '');
            $scope.newRevision = getParameter('newRevision', '');

            var getRevisionTips = function (projectName, list) {
                // due to we push the revision data into list,
                // so we need clear the data before we push new data into it.
                list.splice(0, list.length);
                ThResultSetModel.getResultSets(projectName).then(function (response) {
                    var resultsets = response.data.results;
                    resultsets.forEach(function (revisionSet) {
                        list.push({
                            revision: revisionSet.revision,
                            author: revisionSet.author
                        });
                    });
                });
            };

            $scope.updateOriginalgRevisionTips = function () {
                getRevisionTips($scope.originalProject.name, $scope.originalTipList);
            };
            $scope.updateNewRevisionTips = function () {
                getRevisionTips($scope.newProject.name, $scope.newTipList);
            };
            $scope.updateOriginalgRevisionTips();
            $scope.updateNewRevisionTips();

            $scope.getOriginalTipRevision = function (tip) {
                $scope.originalRevision = tip;
            };

            $scope.getNewTipRevision = function (tip) {
                $scope.newRevision = tip;
            };

            $scope.getPreviousRevision = function () {
                $scope.proposedRevision = $scope.newRevisionError = null;

                // only check for a full revision
                if ($scope.newRevision.length < 12 || !$scope.revisionComparison) return;

                $scope.proposedRevisionLoading = true;

                var promise;
                if ($scope.newProject.name === "try") {
                    // try require some special logic
                    var iProjs = _.filter($scope.projects, function (proj) {
                        return _.includes(thPerformanceBranches,
                                          proj.name);
                    });
                    promise = JsonPushes.getPreviousRevisionFrom(
                        $scope.newProject,
                        $scope.newRevision,
                        iProjs
                    );
                } else {
                    // any other branch
                    promise = JsonPushes.getPreviousRevision(
                        $scope.newProject,
                        $scope.newRevision
                    ).then(function (revision) {
                        return {
                            revision:revision,
                            project: $scope.newProject
                        };
                    });
                }

                promise.then(
                    function (result) {
                        $scope.proposedRevision = {
                            revision: result.revision.slice(0, 12),
                            project: result.project
                        };
                    },
                    function (error) {
                        $scope.newRevisionError = error.toString();
                    }
                ).finally(function () {
                    $scope.proposedRevisionLoading = false;
                });
            };

            $scope.setProposedRevision = function () {
                var rev = $scope.proposedRevision;
                $scope.proposedRevision = null;
                $scope.originalProject = rev.project;
                $scope.originalRevision = rev.revision;
            };

            $scope.runCompare = function () {
                var revisionPromises = [];
                if ($scope.revisionComparison) {
                    revisionPromises.push(ThResultSetModel.getResultSetsFromRevision($scope.originalProject.name, $scope.originalRevision).then(
                        function () {
                            $scope.originalRevisionError = undefined;
                        },
                        function (error) {
                            $scope.originalRevisionError = error;
                        }
                    ));
                }

                revisionPromises.push(ThResultSetModel.getResultSetsFromRevision($scope.newProject.name, $scope.newRevision).then(
                    function () {
                        $scope.newRevisionError = undefined;
                    },
                    function (error) {
                        $scope.newRevisionError = error;
                    }
                ));

                $q.all(revisionPromises).then(function () {
                    localStorageService.set('originalProject', $scope.originalProject.name, "sessionStorage");
                    localStorageService.set('originalRevision', $scope.originalRevision, "sessionStorage");
                    localStorageService.set('newProject', $scope.newProject.name, "sessionStorage");
                    localStorageService.set('newRevision', $scope.newRevision, "sessionStorage");
                    if ($scope.originalRevisionError === undefined && $scope.newRevisionError === undefined) {
                        if ($scope.revisionComparison) {
                            $state.go('compare', {
                                originalProject: $scope.originalProject.name,
                                originalRevision: $scope.originalRevision,
                                newProject: $scope.newProject.name,
                                newRevision: $scope.newRevision
                            });
                        }
                        else {
                            $state.go('compare', {
                                originalProject: $scope.originalProject.name,
                                newProject: $scope.newProject.name,
                                newRevision: $scope.newRevision,
                                selectedTimeRange: compareBaseLineDefaultTimeRange
                            });
                        }
                    }
                });
                // if we have a try push prepopulated, automatically offer a new revision
                if ($scope.newRevision.length >= 12) {
                    $scope.updateNewRevisionTips();
                    $scope.getPreviousRevision();
                }
            };
        });
    }]);

perf.controller('CompareResultsCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$location',
    'thServiceDomain', 'ThRepositoryModel',
    'ThResultSetModel', '$http', '$httpParamSerializer', '$q', '$timeout', 'PhFramework', 'PhSeries',
    'math', 'phTimeRanges', 'PhCompare', 'compareBaseLineDefaultTimeRange',
    function CompareResultsCtrl($state, $stateParams, $scope,
                                $rootScope, $location,
                                thServiceDomain,
                                ThRepositoryModel, ThResultSetModel, $http, $httpParamSerializer,
                                $q, $timeout, PhFramework, PhSeries, math,
                                phTimeRanges,
                                PhCompare, compareBaseLineDefaultTimeRange) {
        function displayResults(rawResultsMap, newRawResultsMap) {
            $scope.compareResults = {};
            $scope.titles = {};
            if ($scope.originalRevision) {
                window.document.title = `Comparison between ${$scope.originalRevision} (${$scope.originalProject.name}) and ${$scope.newRevision} (${$scope.newProject.name})`;
            }
            else {
                window.document.title = `Comparison between ${$scope.originalProject.name} and ${$scope.newRevision} (${$scope.newProject.name})`;
            }

            $scope.testList.forEach(function (testName) {
                $scope.titles[testName] = testName.replace('summary ', '');
                $scope.platformList.forEach(function (platform) {
                    var oldSig = _.find(Object.keys(rawResultsMap), function (sig) {
                        return rawResultsMap[sig].name === testName && rawResultsMap[sig].platform === platform;
                    });
                    var newSig = _.find(Object.keys(newRawResultsMap), function (sig) {
                        return newRawResultsMap[sig].name === testName && newRawResultsMap[sig].platform === platform;
                    });

                    var cmap = PhCompare.getCounterMap(testName, rawResultsMap[oldSig], newRawResultsMap[newSig]);

                    if (cmap.isEmpty) {
                        return;
                    }

                    cmap.links = [];

                    if ($scope.originalRevision) {
                        if (testName.indexOf("summary") > 0) {
                            var detailsLink = 'perf.html#/comparesubtest?';
                            detailsLink += $httpParamSerializer({
                                originalProject: $scope.originalProject.name,
                                originalRevision: $scope.originalRevision,
                                newProject: $scope.newProject.name,
                                newRevision: $scope.newRevision,
                                originalSignature: oldSig,
                                newSignature: newSig,
                                framework: $scope.filterOptions.framework.id
                            });
                            cmap.links.push({
                                title: 'subtests',
                                href: detailsLink
                            });
                        }

                        cmap.links.push({
                            title: 'graph',
                            href: PhCompare.getGraphsLink(_.map(_.uniq(
                                [$scope.originalProject, $scope.newProject]), function (project) {
                                return {
                                    projectName: project.name,
                                    signature: oldSig,
                                    frameworkId: $scope.filterOptions.framework.id
                                };
                            }), [$scope.originalResultSet,
                                $scope.newResultSet])
                        });
                    }

                    else {
                        if (testName.indexOf("summary") > 0) {
                            var detailsLink = 'perf.html#/comparesubtest?';
                            detailsLink += $httpParamSerializer({
                                originalProject: $scope.originalProject.name,
                                newProject: $scope.newProject.name,
                                newRevision: $scope.newRevision,
                                originalSignature: oldSig,
                                newSignature: newSig,
                                framework: $scope.filterOptions.framework.id,
                                selectedTimeRange: $scope.selectedTimeRange.value
                            });
                            cmap.links.push({
                                title: 'subtests',
                                href: detailsLink
                            });
                        }

                        cmap.links.push({
                            title: 'graph',
                            href: PhCompare.getGraphsLink(_.map(_.uniq(
                                [$scope.originalProject, $scope.newProject]), function (project) {
                                return {
                                    projectName: project.name,
                                    signature: oldSig,
                                    frameworkId: $scope.filterOptions.framework.id
                                };
                            }), [$scope.newResultSet], $scope.selectedTimeRange.value)
                        });
                    }

                    cmap.name = platform;
                    if (Object.keys($scope.compareResults).indexOf(testName) < 0)
                        $scope.compareResults[testName] = [];
                    $scope.compareResults[testName].push(cmap);
                });
            });

            // Remove the tests with no data, report them as well; not needed for subtests
            $scope.testNoResults = _.difference($scope.testList, Object.keys($scope.compareResults))
                .map(function (name) { return ' ' + name.replace(' summary', ''); }).sort().join();
            $scope.testList = Object.keys($scope.compareResults).sort();
        }

        function load() {
            $scope.dataLoading = true;
            $scope.testList = [];
            $scope.platformList = [];

            if ($scope.originalRevision) {
                var timeRange = PhCompare.getInterval($scope.originalResultSet.push_timestamp, $scope.newResultSet.push_timestamp);
                var resultSetIds = [$scope.originalResultSet.id];

                // Optimization - if old/new branches are the same collect data in one pass
                if (_.isEqual($scope.originalProject, $scope.newProject)) {
                    resultSetIds = [$scope.originalResultSet.id, $scope.newResultSet.id];
                }

                PhSeries.getSeriesList(
                    $scope.originalProject.name,
                    {interval: timeRange, subtests: 0,
                        framework: $scope.filterOptions.framework.id
                    }).then(
                        function (originalSeriesList) {
                            $scope.platformList = _.uniq(
                                _.map(originalSeriesList, 'platform'));
                            $scope.testList = _.uniq(
                                _.map(originalSeriesList, 'name'));
                            return PhCompare.getResultsMap($scope.originalProject.name,
                                                        originalSeriesList,
                                                        {pushIDs: resultSetIds});
                        }).then(function (resultMaps) {
                            var originalResultsMap = resultMaps[$scope.originalResultSet.id];
                            var newResultsMap = resultMaps[$scope.newResultSet.id];

                            // Optimization - we collected all data in a single pass
                            if (newResultsMap) {
                                $scope.dataLoading = false;
                                displayResults(originalResultsMap, newResultsMap);
                                return;
                            }

                            PhSeries.getSeriesList(
                                $scope.newProject.name,
                                { interval: timeRange, subtests: 0,
                                    framework: $scope.filterOptions.framework.id }).then(
                                    function (newSeriesList) {
                                        $scope.platformList = _.union(
                                            $scope.platformList,
                                            _.uniq(_.map(newSeriesList, 'platform')));
                                        $scope.testList = _.union(
                                            $scope.testList,
                                            _.uniq(_.map(newSeriesList, 'name')));

                                        return PhCompare.getResultsMap($scope.newProject.name,
                                                                    newSeriesList,
                                                                    {pushIDs: [$scope.newResultSet.id]});
                                    }).then(function (resultMaps) {
                                        $scope.dataLoading = false;
                                        displayResults(originalResultsMap, resultMaps[$scope.newResultSet.id]);
                                    });
                        });
            }
            else {
                // using a range of data for baseline comparison
                var originalSeriesList;
                originalSeriesList = PhSeries.getSeriesList($scope.originalProject.name, {
                    interval: $scope.selectedTimeRange.value,
                    subtests: 0,
                    framework: $scope.filterOptions.framework.id
                });

                originalSeriesList.then(function (originalSeriesList) {
                    $scope.platformList = _.uniq(_.map(originalSeriesList, 'platform'));
                    $scope.testList = _.uniq(_.map(originalSeriesList, 'name'));
                    return PhCompare.getResultsMap($scope.originalProject.name,
                                                    originalSeriesList,
                                                    {interval: $scope.selectedTimeRange});
                }).then(function (resultsMap) {
                    var originalResultsMap = resultsMap;
                    PhSeries.getSeriesList(
                        $scope.newProject.name, {
                            interval: $scope.selectedTimeRange.value, subtests: 0,
                            framework: $scope.filterOptions.framework.id }).then(
                                function (newSeriesList) {
                                    $scope.platformList = _.union($scope.platformList,
                                        _.uniq(_.map(newSeriesList, 'platform')));
                                    $scope.testList = _.union($scope.testList,
                                        _.uniq(_.map(newSeriesList, 'name')));
                                    return PhCompare.getResultsMap($scope.newProject.name,
                                                            newSeriesList,
                                                            {pushIDs: [$scope.newResultSet.id]});
                                }).then(function (resultMaps) {
                                    var newResultsMap = resultMaps[$scope.newResultSet.id];
                                    $scope.dataLoading = false;
                                    displayResults(originalResultsMap, newResultsMap);
                                });
                });
            }
        }
        //TODO: duplicated in comparesubtestctrl
        function verifyRevision(project, revision, rsid) {
            return ThResultSetModel.getResultSetsFromRevision(project.name, revision).then(
                function (resultSets) {
                    var resultSet = resultSets[0];
                    //TODO: this is a bit hacky to pass in 'original' as a text string
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
            var params = {
                framework: $scope.filterOptions.framework.id,
                filter: $scope.filterOptions.filter,
                showOnlyImportant: $scope.filterOptions.showOnlyImportant ? undefined : 0,
                showOnlyConfident: $scope.filterOptions.showOnlyConfident ? 1 : undefined
            };

            if ($scope.originalRevision === undefined) {
                params.selectedTimeRange = $scope.selectedTimeRange.value;
            }

            $state.transitionTo('compare', params, {
                location: true,
                inherit: true,
                relative: $state.$current,
                notify: false
            });
        }
        $scope.timeRangeChanged = function (selectedTimeRange) {
                    //This function is used to alter
                    //$scope.selectedTimeRange for baseline comparison.
                    //selectedTimeRange is passed as parameter
                    //because angular assigns it to a different scope
            $scope.selectedTimeRange = selectedTimeRange;
            updateURL();
            load();
        };
        $scope.dataLoading = true;

        var loadRepositories = ThRepositoryModel.load();
        var loadFrameworks = PhFramework.getFrameworkList().then(
            function (frameworks) {
                $scope.frameworks = frameworks;
            });

        $q.all([loadRepositories, loadFrameworks]).then(function () {
            $scope.errors = [];
            //validation works only for revision to revision comparison
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
                framework: _.find($scope.frameworks, {
                    id: parseInt($stateParams.framework)
                }) || $scope.frameworks[0],
                filter: $stateParams.filter || "",
                showOnlyImportant: Boolean($stateParams.showOnlyImportant !== undefined &&
                                           parseInt($stateParams.showOnlyImportant)),
                showOnlyConfident: Boolean($stateParams.showOnlyConfident !== undefined &&
                                           parseInt($stateParams.showOnlyConfident))
            };

            $scope.originalProject = ThRepositoryModel.getRepo(
                $stateParams.originalProject);
            $scope.newProject = ThRepositoryModel.getRepo(
                $stateParams.newProject);
            $scope.newRevision = $stateParams.newRevision;

            // always need to verify the new revision, only sometimes the original
            let verifyPromises = [verifyRevision($scope.newProject, $scope.newRevision, "new")];
            if ($stateParams.originalRevision) {
                $scope.originalRevision = $stateParams.originalRevision;
                verifyPromises.push(verifyRevision($scope.originalProject, $scope.originalRevision, "original"));
            }
            else {
                $scope.timeRanges = phTimeRanges;
                $scope.selectedTimeRange = _.find($scope.timeRanges, {
                    value: ($stateParams.selectedTimeRange) ? parseInt($stateParams.selectedTimeRange) : compareBaseLineDefaultTimeRange
                });
            }
            $q.all(verifyPromises).then(function () {
                if ($scope.errors.length > 0) {
                    $scope.dataLoading = false;
                    return;
                }
                $scope.$watchGroup(['filterOptions.filter',
                    'filterOptions.showOnlyImportant',
                    'filterOptions.showOnlyConfident'],
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
    '$state', '$stateParams', '$scope', '$rootScope', '$location',
    'thServiceDomain', 'ThRepositoryModel',
    'ThResultSetModel', '$http', '$q', '$timeout', 'PhSeries', 'math',
    'PhCompare', 'phTimeRanges', 'compareBaseLineDefaultTimeRange', '$httpParamSerializer',
    function CompareSubtestResultsCtrl($state, $stateParams, $scope, $rootScope,
                                       $location, thServiceDomain,
                                       ThRepositoryModel, ThResultSetModel,
                                       $http, $q, $timeout, PhSeries, math,
                                       PhCompare, phTimeRanges, compareBaseLineDefaultTimeRange,
                                       $httpParamSerializer) {
         //TODO: duplicated from comparectrl
        function verifyRevision(project, revision, rsid) {
            return ThResultSetModel.getResultSetsFromRevision(project.name, revision).then(
               function (resultSets) {
                   var resultSet = resultSets[0];
                    //TODO: this is a bit hacky to pass in 'original' as a text string
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

            var testName = $scope.testList[0].replace('summary ', '');

            $scope.titles[testName] = $scope.platformList[0] + ': ' + testName;
            $scope.compareResults[testName] = [];

            window.document.title = $scope.subtestTitle = $scope.titles[testName];

            $scope.pageList.sort();
            $scope.pageList.forEach(function (page) {
                var mapsigs = [];
                [rawResultsMap, newRawResultsMap].forEach(function (resultsMap) {
                    var tempsig;
                    // If no data for a given platform, or test, display N/A in table
                    if (resultsMap) {
                        tempsig = _.find(Object.keys(resultsMap), function (sig) {
                            return resultsMap[sig].name === page;
                        });
                    } else {
                        tempsig = 'undefined';
                        resultsMap = {};
                        resultsMap[tempsig] = {};
                    }
                    mapsigs.push(tempsig);
                });
                var oldSig = mapsigs[0];
                var newSig = mapsigs[1];

                var cmap = PhCompare.getCounterMap(testName, rawResultsMap[oldSig], newRawResultsMap[newSig]);
                if (oldSig === $scope.originalSignature ||
                    oldSig === $scope.newSignature ||
                    newSig === $scope.originalSignature ||
                    newSig === $scope.newSignature) {
                    cmap.highlightedTest = true;
                }

                cmap.name = page;
                if ($scope.originalRevision) {
                    cmap.links = [{
                        title: 'graph',
                        href: PhCompare.getGraphsLink(_.map(_.uniq([
                            $scope.originalProject,
                            $scope.newProject
                        ]), function (project) {
                            return {
                                projectName: project.name,
                                signature: oldSig,
                                frameworkId: $scope.filterOptions.framework
                            };
                        }), [$scope.originalResultSet, $scope.newResultSet])
                    }];
                    //replicate distribution is added only for talos
                    if ($scope.filterOptions.framework === '1') {
                        cmap.links.push({
                            title: 'replicate',
                            href: 'perf.html#/comparesubtestdistribution?' + $httpParamSerializer({
                                originalProject: $scope.originalProject.name,
                                newProject: $scope.newProject.name,
                                originalRevision: $scope.originalRevision,
                                newRevision: $scope.newRevision,
                                originalSubtestSignature: oldSig,
                                newSubtestSignature: newSig
                            })
                        });
                    }
                }

                else {
                    cmap.links = [{
                        title: 'graph',
                        href: PhCompare.getGraphsLink(_.map(_.uniq([
                            $scope.originalProject,
                            $scope.newProject
                        ]), function (project) {
                            return {
                                projectName: project.name,
                                signature: oldSig,
                                frameworkId: $scope.filterOptions.framework
                            };
                        }), [$scope.newResultSet], $scope.selectedTimeRange.value)
                    }];
                }
                $scope.compareResults[testName].push(cmap);
            });
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
            let verifyPromises = [verifyRevision($scope.newProject, $scope.newRevision, "new")];
            if ($stateParams.originalRevision) {
                $scope.originalRevision = $stateParams.originalRevision;
                verifyPromises.push(verifyRevision($scope.originalProject, $scope.originalRevision, "original"));
            }
            else {
                $scope.timeRanges = phTimeRanges;
                $scope.selectedTimeRange = _.find($scope.timeRanges, {
                    value: ($stateParams.selectedTimeRange) ? parseInt($stateParams.selectedTimeRange) : compareBaseLineDefaultTimeRange
                });
            }

            $q.all(verifyPromises).then(function () {
                $scope.pageList = [];

                if ($scope.errors.length > 0) {
                    $scope.dataLoading = false;
                    return;
                }

                if ($scope.originalRevision) {
                    var resultSetIds = [$scope.originalResultSet.id];

                    // Optimization - if old/new branches are the same collect data in one pass
                    if ($scope.originalProject === $scope.newProject) {
                        resultSetIds = [$scope.originalResultSet.id, $scope.newResultSet.id];
                    }
                }

                $scope.filterOptions = {
                    framework: $stateParams.framework || 1, // 1 == talos
                    filter: $stateParams.filter || "",
                    showOnlyImportant: Boolean($stateParams.showOnlyImportant !== undefined &&
                                               parseInt($stateParams.showOnlyImportant)),
                    showOnlyConfident: Boolean($stateParams.showOnlyConfident !== undefined &&
                                               parseInt($stateParams.showOnlyConfident))
                };

                $scope.$watchGroup([
                    'filterOptions.filter',
                    'filterOptions.showOnlyImportant',
                    'filterOptions.showOnlyConfident'
                ], function () {
                    $state.transitionTo('comparesubtest', {
                        filter: $scope.filterOptions.filter,
                        showOnlyImportant: $scope.filterOptions.showOnlyImportant ? 1 : undefined,
                        showOnlyConfident: $scope.filterOptions.showOnlyConfident ? 1 : undefined
                    }, {
                        location: true,
                        inherit: true,
                        relative: $state.$current,
                        notify: false
                    });
                });

                $scope.timeRangeChanged = function (selectedTimeRange) {
                    //This function is used to alter
                    //$scope.selectedTimeRange for baseline comparison.
                    //selectedTimeRange is passed as parameter
                    //because angular assigns it to a different scope
                    $scope.selectedTimeRange = selectedTimeRange;
                    $state.go('comparesubtest', {
                        filter: $scope.filterOptions.filter,
                        showOnlyImportant: $scope.filterOptions.showOnlyImportant ? 1 : undefined,
                        showOnlyConfident: $scope.filterOptions.showOnlyConfident ? 1 : undefined,
                        selectedTimeRange: $scope.selectedTimeRange.value
                    });
                };
                if ($scope.originalRevision) {
                    $q.all([
                        PhSeries.getSeriesList(
                            $scope.originalProject.name, {
                                signature: $scope.originalSignature,
                                framework: $scope.filterOptions.framework
                            }).then(function (originalSeries) {
                                $scope.testList = [originalSeries[0].name];
                                return undefined;
                            }),
                        PhSeries.getSeriesList(
                            $scope.originalProject.name,
                            {
                                parent_signature: $scope.originalSignature,
                                framework: $scope.filterOptions.framework
                            }).then(function (originalSubtestList) {
                                $scope.pageList = _.map(originalSubtestList, 'name');
                                $scope.platformList = _.uniq(_.map(originalSubtestList, 'platform'));
                                return PhCompare.getResultsMap($scope.originalProject.name,
                                    originalSubtestList,
                                    {pushIDs: resultSetIds});
                            })
                    ]).then(function (results) {
                        var originalSeriesMap = results[1][$scope.originalResultSet.id];
                        var newSeriesMap = results[1][$scope.newResultSet.id];
                        [originalSeriesMap, newSeriesMap].forEach(function (seriesMap) {
                            // If there is no data for a given signature, handle it gracefully
                            if (seriesMap) {
                                Object.keys(seriesMap).forEach(function (series) {
                                    if (!_.includes($scope.pageList, seriesMap[series].name)) {
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
                                framework: $scope.filterOptions.framework
                            }).then(function (newSeriesList) {
                                $scope.platformList = _.uniq(_.union(
                                    $scope.platformList,
                                    _.map(newSeriesList, 'platform')));
                                $scope.testList = _.uniq(_.union(
                                    $scope.testList,
                                    _.map(newSeriesList, 'name')));

                                return PhCompare.getResultsMap($scope.newProject.name,
                                    newSeriesList,
                                    {pushIDs: [$scope.newResultSet.id]});
                            }).then(function (newSeriesMaps) {
                                var newSeriesMap = newSeriesMaps[$scope.newResultSet.id];
                                // There is a chance that we haven't received data for the given signature/resultSet yet
                                if (newSeriesMap) {
                                    Object.keys(newSeriesMap).forEach(function (series) {
                                        if (!_.includes($scope.pageList, newSeriesMap[series].name)) {
                                            $scope.pageList.push(newSeriesMap[series].name);
                                        }
                                    });
                                } else {
                                    newSeriesMap = {};
                                }
                                $scope.dataLoading = false;
                                displayResults(originalSeriesMap, newSeriesMap);
                            });
                        }
                        else {
                            $scope.dataLoading = false;
                            displayResults(originalSeriesMap, {});
                        }
                    });
                }
                else {
                    $q.all([
                        PhSeries.getSeriesList(
                            $scope.originalProject.name, {
                                signature: $scope.originalSignature,
                                framework: $scope.filterOptions.framework
                            }).then(function (originalSeries) {
                                $scope.testList = [originalSeries[0].name];
                                return undefined;
                            }),
                        PhSeries.getSeriesList(
                            $scope.originalProject.name,
                            {
                                parent_signature: $scope.originalSignature,
                                framework: $scope.filterOptions.framework
                            }).then(function (originalSubtestList) {
                                $scope.pageList = _.map(originalSubtestList, 'name');
                                $scope.platformList = _.uniq(_.map(originalSubtestList, 'platform'));
                                return PhCompare.getResultsMap($scope.originalProject.name,
                                    originalSubtestList,
                                    {interval: $scope.selectedTimeRange});
                            })
                    ]).then(
                        function (originalResults) {
                            var originalSeriesMap = originalResults[1];
                            if ($scope.newSignature) {
                                PhSeries.getSeriesList(
                                $scope.newProject.name, {
                                    parent_signature: $scope.newSignature,
                                    framework: $scope.filterOptions.framework
                                }).then(function (newSeriesList) {
                                    $scope.platformList = _.uniq(_.union(
                                        $scope.platformList,
                                        _.map(newSeriesList, 'platform')));
                                    $scope.testList = _.uniq(_.union(
                                        $scope.testList,
                                        _.map(newSeriesList, 'name')));

                                    return PhCompare.getResultsMap($scope.newProject.name,
                                        newSeriesList,
                                        {pushIDs: [$scope.newResultSet.id]});
                                }).then(function (newSeriesMaps) {
                                    var newSeriesMap = newSeriesMaps[$scope.newResultSet.id];
                                    // There is a chance that we haven't received data for the given signature/resultSet yet
                                    if (newSeriesMap) {
                                        Object.keys(newSeriesMap).forEach(function (series) {
                                            if (!_.includes($scope.pageList, newSeriesMap[series].name)) {
                                                $scope.pageList.push(newSeriesMap[series].name);
                                            }
                                        });
                                    } else {
                                        newSeriesMap = {};
                                    }
                                    $scope.dataLoading = false;
                                    displayResults(originalSeriesMap, newSeriesMap);
                                });
                            }
                            else {
                                $scope.dataLoading = false;
                                displayResults(originalSeriesMap, {});
                            }
                        });
                }
            });
        });
    }]);

perf.controller('CompareSubtestDistributionCtrl', ['$scope', '$stateParams', '$q', 'ThRepositoryModel',
    'PhSeries', 'ThResultSetModel', 'metricsgraphics',
    function CompareSubtestDistributionCtrl($scope, $stateParams, $q, ThRepositoryModel,
        PhSeries, ThResultSetModel, metricsgraphics) {
        $scope.originalRevision = $stateParams.originalRevision;
        $scope.newRevision = $stateParams.newRevision;
        $scope.originalSubtestSignature = $stateParams.originalSubtestSignature;
        $scope.newSubtestSignature = $stateParams.newSubtestSignature;
        $scope.dataLoading = true;
        let loadRepositories = ThRepositoryModel.load();
        const fetchAndDrawReplicateGraph = function (project, revision, subtestSignature, target) {
            let replicateData = {};
            return ThResultSetModel.getResultSetsFromRevision(project, revision).then(
                (revisionData) => {
                    replicateData.resultSet = revisionData[0];
                    return PhSeries.getSeriesData(project, {
                        signatures: subtestSignature,
                        push_id: replicateData.resultSet.id
                    });
                }).then((perfDatumList) => {
                    if (!perfDatumList[subtestSignature]) {
                        replicateData.replicateDataError = true;
                        return;
                    }
                    const numRuns = perfDatumList[subtestSignature].length;
                    let replicatePromises = perfDatumList[subtestSignature].map(
                        value => PhSeries.getReplicateData({job_id: value.job_id}));
                    return $q.all(replicatePromises).then((replicateData) => {
                        let replicateValues = replicateData.concat.apply([],
                                replicateData.map((data) => {
                                    let testSuite = data.suites.find(suite => suite.name === $scope.testSuite);
                                    let subtest = testSuite.subtests.find(subtest => subtest.name === $scope.subtest);
                                    return subtest.replicates;
                                })
                            );
                        //metrics-graphics doesn't accept "0" as x_accesor
                        replicateValues = replicateValues.map((value, index) => ({
                            "replicate": (index + 1).toString(),
                            "value": value
                        }));
                        metricsgraphics.data_graphic({
                            title: `${target} Replicates over ${numRuns} run${(numRuns > 1) ? 's' : ''}`,
                            chart_type: "bar",
                            data: replicateValues,
                            y_accessor: "value",
                            x_accessor: "replicate",
                            height: 275,
                            width: 1000,
                            target: `#${target}`
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
                            height: 275
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
            PhSeries.getSeriesList($scope.originalProject.name, {signature: $scope.originalSubtestSignature}).then(
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
                    if ($scope.originalReplicateError)
                        $scope.noResult = "base";
                    return fetchAndDrawReplicateGraph($scope.newProject.name,
                                              $scope.newRevision,
                                              $scope.newSubtestSignature,
                                              'New');
                }).then((result) => {
                    $scope.newResultSet = result.resultSet;
                    $scope.newReplicateError = result.replicateDataError;
                    if ($scope.newReplicateError)
                        $scope.noResult = "new";
                    window.document.title = `${$scope.platform}: ${$scope.testName}`;
                    $scope.dataLoading = false;
                });
        });
    }
]);
