"use strict";

perf.controller('CompareChooserCtrl', [
    '$state', '$stateParams', '$scope', 'ThRepositoryModel', 'ThResultSetModel',
    'phCompareDefaultNewRepo', 'phCompareDefaultOriginalRepo', 'JsonPushes',
    'thPerformanceBranches',
    function CompareChooserCtrl($state, $stateParams, $scope,
                                ThRepositoryModel, ThResultSetModel,
                                phCompareDefaultNewRepo,
                                phCompareDefaultOriginalRepo,
                                JsonPushes, thPerformanceBranches) {
        ThRepositoryModel.get_list().success(function(projects) {
            $scope.projects = projects;
            $scope.originalTipList = [];
            $scope.newTipList = [];

            $scope.originalProject = _.findWhere(projects, {
                name: ($stateParams.originalProject ?
                       $stateParams.originalProject : phCompareDefaultOriginalRepo)
            }) || projects[0];
            $scope.newProject = _.findWhere(projects, {
                name: ($stateParams.newProject ?
                       $stateParams.newProject : phCompareDefaultNewRepo)
            }) || projects[0];

            $scope.originalRevision = ($stateParams.originalRevision ?
                                       $stateParams.originalRevision : '');
            $scope.newRevision = ($stateParams.newRevision ?
                                  $stateParams.newRevision : '');

            var getRevisionTips = function(projectName, list) {
                // due to we push the revision data into list,
                // so we need clear the data before we push new data into it.
                list.splice(0, list.length);
                ThResultSetModel.getResultSets(projectName).then(function(response) {
                    var resultsets = response.data.results;
                    resultsets.forEach(function(revisionSet) {
                        list.push({
                            revision: revisionSet.revision,
                            author: revisionSet.author
                        });
                    });
                });
            };

            $scope.updateOriginalgRevisionTips = function() {
                getRevisionTips($scope.originalProject.name, $scope.originalTipList);
            };
            $scope.updateNewRevisionTips = function() {
                getRevisionTips($scope.newProject.name, $scope.newTipList);
            };
            $scope.updateOriginalgRevisionTips();
            $scope.updateNewRevisionTips();

            $scope.getOriginalTipRevision = function(tip) {
                $scope.originalRevision = tip;
            };

            $scope.getNewTipRevision = function(tip) {
                $scope.newRevision = tip;
            };

            $scope.getPreviousRevision = function() {
                $scope.proposedRevision = $scope.newRevisionError = null;

                // only check for a full revision
                if ($scope.newRevision.length !== 12) return;

                $scope.proposedRevisionLoading = true;

                var promise;
                if ($scope.newProject.name === "try") {
                    // try require some special logic
                    var iProjs = _.filter($scope.projects, function(proj) {
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
                            project: $scope.newProject,
                        };
                    });
                }

                promise.then(
                    function(result) {
                        $scope.proposedRevision = {
                            revision: result.revision.slice(0, 12),
                            project: result.project
                        };
                    },
                    function(error) {
                        $scope.newRevisionError = error.toString();
                    }
                ).finally(function() {
                    $scope.proposedRevisionLoading = false;
                });
            };

            $scope.setProposedRevision = function() {
                var rev = $scope.proposedRevision;
                $scope.proposedRevision = null;
                $scope.originalProject = rev.project;
                $scope.originalRevision = rev.revision;
            };

            $scope.runCompare = function() {
                ThResultSetModel.getResultSetsFromRevision($scope.originalProject.name, $scope.originalRevision).then(
                    function(resultSets) {
                        $scope.originalRevisionError = undefined;
                    },
                    function(error) {
                        $scope.originalRevisionError = error;
                    }
                );

                ThResultSetModel.getResultSetsFromRevision($scope.newProject.name, $scope.newRevision).then(
                    function (resultSets) {
                        $scope.newRevisionError = undefined;
                        if ($scope.originalRevisionError === undefined && $scope.newRevisionError === undefined) {
                            $state.go('compare', {
                                originalProject: $scope.originalProject.name,
                                originalRevision: $scope.originalRevision,
                                newProject: $scope.newProject.name,
                                newRevision: $scope.newRevision
                            });
                        }
                    },
                    function (error) {
                        $scope.newRevisionError = error;
                    }
                );
            };

            // if we have a try push prepopulated, automatically offer a new revision
            if ($scope.newRevision.length === 12) {
                $scope.updateNewRevisionTips();
                $scope.getPreviousRevision();
            }
        });
    }]);

perf.controller('CompareResultsCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$location',
    'thServiceDomain', 'ThRepositoryModel',
    'ThResultSetModel', '$http', '$q', '$timeout', 'PhFramework', 'PhSeries',
    'math', 'phTimeRanges', 'PhCompare',
    function CompareResultsCtrl($state, $stateParams, $scope,
                                $rootScope, $location,
                                thServiceDomain,
                                ThRepositoryModel, ThResultSetModel, $http,
                                $q, $timeout, PhFramework, PhSeries, math,
                                phTimeRanges,
                                PhCompare) {
        function displayResults(rawResultsMap, newRawResultsMap) {
            $scope.compareResults = {};
            $scope.titles = {};
            window.document.title = ("Comparison between " + $scope.originalRevision +
                                     " (" + $scope.originalProject.name + ") " +
                                     "and " + $scope.newRevision + " (" + $scope.newProject.name + ")");

            $scope.testList.forEach(function(testName) {
                $scope.titles[testName] = testName.replace('summary ', '');
                $scope.platformList.forEach(function(platform) {
                    var oldSig = _.find(Object.keys(rawResultsMap), function(sig) {
                        return rawResultsMap[sig].name === testName && rawResultsMap[sig].platform === platform;
                    });
                    var newSig = _.find(Object.keys(newRawResultsMap), function(sig) {
                        return newRawResultsMap[sig].name === testName && newRawResultsMap[sig].platform === platform;
                    });

                    var cmap = PhCompare.getCounterMap(testName, rawResultsMap[oldSig], newRawResultsMap[newSig]);

                    if (cmap.isEmpty) {
                        return;
                    }

                    cmap.links = [];

                    if (testName.indexOf("summary") > 0) {
                        var detailsLink = 'perf.html#/comparesubtest?';
                        detailsLink += _.map(_.pairs({
                            originalProject: $scope.originalProject.name,
                            originalRevision: $scope.originalRevision,
                            newProject: $scope.newProject.name,
                            newRevision: $scope.newRevision,
                            originalSignature: oldSig,
                            newSignature: newSig,
                            framework: $scope.filterOptions.framework.id
                        }), function(kv) { return kv[0]+"="+kv[1]; }).join("&");
                        cmap.links.push({
                            title: 'subtests',
                            href: detailsLink
                        });
                    }

                    var graphsLink = PhCompare.getGraphsLink(
                        $scope.originalProject, $scope.newProject, oldSig,
                        $scope.originalResultSet, $scope.newResultSet);
                    if (graphsLink) {
                        cmap.links.push({
                            title: 'graph',
                            href: graphsLink
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
                .map(function(name) { return ' ' + name.replace(' summary', ''); }).sort().join();
            $scope.testList = Object.keys($scope.compareResults).sort();
        }

        function load() {
            $scope.dataLoading = true;
            $scope.testList = [];
            $scope.platformList = [];

            var timeRange = PhCompare.getInterval($scope.originalResultSet.push_timestamp, $scope.newResultSet.push_timestamp);
            var resultSetIds = [$scope.originalResultSet.id];

            // Optimization - if old/new branches are the same collect data in one pass
            if (_.isEqual($scope.originalProject, $scope.newProject)) {
                resultSetIds = [$scope.originalResultSet.id, $scope.newResultSet.id];
            }

            PhSeries.getSeriesList(
                $scope.originalProject.name,
                { interval: timeRange, subtests: 0,
                  framework: $scope.filterOptions.framework.id
                }).then(
                    function(originalSeriesList) {
                        $scope.platformList = _.uniq(
                            _.map(originalSeriesList, 'platform'));
                        $scope.testList = _.uniq(
                            _.map(originalSeriesList, 'name'));
                        return PhCompare.getResultsMap($scope.originalProject.name,
                                                       originalSeriesList,
                                                       resultSetIds);
                    }).then(function(resultMaps) {
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
                                function(newSeriesList) {
                                    $scope.platformList = _.union(
                                        $scope.platformList,
                                        _.uniq(_.map(newSeriesList, 'platform')));
                                    $scope.testList = _.union(
                                        $scope.testList,
                                        _.uniq(_.map(newSeriesList, 'name')));
                                    return PhCompare.getResultsMap($scope.newProject.name,
                                                                   newSeriesList,
                                                                   [$scope.newResultSet.id]);
                                }).then(function(resultMaps) {
                                    var newResultsMap = resultMaps[$scope.newResultSet.id];
                                    $scope.dataLoading = false;
                                    displayResults(originalResultsMap, newResultsMap);
                                });
                    });
        }

        //TODO: duplicated in comparesubtestctrl
        function verifyRevision(project, revision, rsid) {
            return ThResultSetModel.getResultSetsFromRevision(project.name, revision).then(
                function(resultSets) {
                    var resultSet = resultSets[0];
                    //TODO: this is a bit hacky to pass in 'original' as a text string
                    if (rsid === 'original') {
                        $scope.originalResultSet = resultSet;
                    } else {
                        $scope.newResultSet = resultSet;
                    }
                },
                function(error) {
                    $scope.errors.push(error);
                });
        }

        $scope.dataLoading = true;
        $scope.getCompareClasses = PhCompare.getCompareClasses;

        var loadRepositories = ThRepositoryModel.load();
        var loadFrameworks = PhFramework.getFrameworkList().then(
            function(frameworks) {
                $scope.frameworks = frameworks;
            });
        $q.all([loadRepositories, loadFrameworks]).then(function() {
            $scope.errors = PhCompare.validateInput($stateParams.originalProject,
                                                    $stateParams.newProject,
                                                    $stateParams.originalRevision,
                                                    $stateParams.originalProject);

            if ($scope.errors.length > 0) {
                $scope.dataLoading = false;
                return;
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

            function updateURL() {
                $state.transitionTo('compare', {
                    framework: $scope.filterOptions.framework.id,
                    filter: $scope.filterOptions.filter,
                    showOnlyImportant: Boolean($scope.filterOptions.showOnlyImportant) ? undefined : 0,
                    showOnlyConfident: Boolean($scope.filterOptions.showOnlyConfident) ? 1 : undefined
                }, {
                    location: true,
                    inherit: true,
                    relative: $state.$current,
                    notify: false
                });
            }


            $scope.originalProject = ThRepositoryModel.getRepo(
                $stateParams.originalProject);
            $scope.newProject = ThRepositoryModel.getRepo(
                $stateParams.newProject);
            $scope.newRevision = $stateParams.newRevision;
            $scope.originalRevision = $stateParams.originalRevision;

            verifyRevision($scope.originalProject, $scope.originalRevision, "original").then(function () {
                verifyRevision($scope.newProject, $scope.newRevision, "new").then(function () {
                    if ($scope.errors.length > 0) {
                        $scope.dataLoading = false;
                        return;
                    }
                    $scope.$watchGroup(['filterOptions.filter',
                                        'filterOptions.showOnlyImportant',
                                        'filterOptions.showOnlyConfident'],
                                       updateURL);

                    $scope.$watch('filterOptions.framework',
                                  function(newValue, oldValue) {
                                      if (newValue.id !== oldValue.id) {
                                          updateURL();
                                          load();
                                      }
                                  });
                    load();
                });
            });
        });
    }]);

perf.controller('CompareSubtestResultsCtrl', [
    '$state', '$stateParams', '$scope', '$rootScope', '$location',
    'thServiceDomain', 'ThRepositoryModel',
    'ThResultSetModel', '$http', '$q', '$timeout', 'PhSeries', 'math',
    'PhCompare',
    function CompareSubtestResultsCtrl($state, $stateParams, $scope, $rootScope,
                                       $location, thServiceDomain,
                                       ThRepositoryModel, ThResultSetModel,
                                       $http, $q, $timeout, PhSeries, math,
                                       PhCompare) {
        //TODO: duplicated from comparectrl
        function verifyRevision(project, revision, rsid) {
            return ThResultSetModel.getResultSetsFromRevision(project.name, revision).then(
                function(resultSets) {
                    var resultSet = resultSets[0];
                    //TODO: this is a bit hacky to pass in 'original' as a text string
                    if (rsid === 'original') {
                        $scope.originalResultSet = resultSet;
                    } else {
                        $scope.newResultSet = resultSet;
                    }
                },
                function(error) {
                    $scope.errors.push(error);
                });
        }

        function displayResults(rawResultsMap, newRawResultsMap) {
            $scope.compareResults = {};
            $scope.titles = {};

            $scope.subtestTitle = ($scope.platformList[0].split(' ')[0] + " " +
                                   $scope.testList[0].split(' ')[0]);
            window.document.title = $scope.subtestTitle + " subtest comparison";

            var testName = $scope.testList[0].replace('summary ', '');

            $scope.titles[testName] = $scope.platformList[0] + ': ' + testName;
            $scope.compareResults[testName] = [];

            $scope.pageList.sort();
            $scope.pageList.forEach(function(page) {
                var mapsigs = [];
                [rawResultsMap, newRawResultsMap].forEach(function(resultsMap) {
                    // If no data for a given platform, or test, display N/A in table
                    if (resultsMap) {
                        var tempsig = _.find(Object.keys(resultsMap), function (sig) {
                            return resultsMap[sig].name === page;
                        });
                    } else {
                        var tempsig = 'undefined';
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

                var graphsLink = PhCompare.getGraphsLink(
                    $scope.originalProject, $scope.newProject, oldSig,
                    $scope.originalResultSet, $scope.newResultSet);
                if (graphsLink) {
                    cmap.links = [{
                        title: 'graph',
                        href: graphsLink
                    }];
                }


                $scope.compareResults[testName].push(cmap);
            });
        }

        $scope.dataLoading = true;
        $scope.getCompareClasses = PhCompare.getCompareClasses;

        ThRepositoryModel.load().then(function() {
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

            $scope.originalProject = ThRepositoryModel.getRepo(
                $stateParams.originalProject);
            $scope.newProject = ThRepositoryModel.getRepo(
                $stateParams.newProject);
            $scope.newRevision = $stateParams.newRevision;
            $scope.originalRevision = $stateParams.originalRevision;
            $scope.originalSignature = $stateParams.originalSignature;
            $scope.newSignature = $stateParams.newSignature;

            verifyRevision($scope.originalProject, $scope.originalRevision, "original").then(function () {
                verifyRevision($scope.newProject, $scope.newRevision, "new").then(function () {
                    $scope.pageList = [];

                    if ($scope.errors.length > 0) {
                        $scope.dataLoading = false;
                        return;
                    }

                    var timeRange = PhCompare.getInterval($scope.originalResultSet.push_timestamp, $scope.newResultSet.push_timestamp);
                    var resultSetIds = [$scope.originalResultSet.id];

                    $scope.filterOptions = {
                        framework: $stateParams.framework || 1, // 1 == talos
                        filter: $stateParams.filter || "",
                        showOnlyImportant: Boolean($stateParams.showOnlyImportant !== undefined &&
                                                   parseInt($stateParams.showOnlyImportant)),
                        showOnlyConfident: Boolean($stateParams.showOnlyConfident !== undefined &&
                                                   parseInt($stateParams.showOnlyConfident))
                    };

                    $scope.$watchGroup(['filterOptions.filter',
                                        'filterOptions.showOnlyImportant',
                                        'filterOptions.showOnlyConfident'],
                                       function() {
                                           $state.transitionTo('comparesubtest', {
                                               filter: $scope.filterOptions.filter,
                                               showOnlyImportant: Boolean($scope.filterOptions.showOnlyImportant) ? 1 : undefined,
                                               showOnlyConfident: Boolean($scope.filterOptions.showOnlyConfident) ? 1 : undefined
                                           }, {
                                               location: true,
                                               inherit: true,
                                               relative: $state.$current,
                                               notify: false
                                           });
                                       });

                    // Optimization - if old/new branches are the same collect data in one pass
                    if ($scope.originalProject === $scope.newProject) {
                        resultSetIds = [$scope.originalResultSet.id, $scope.newResultSet.id];
                    }

                    $q.all([PhSeries.getSeriesList(
                        $scope.originalProject.name,
                        { signature: $scope.originalSignature,
                          framework: $scope.filterOptions.framework }).then(function(originalSeries) {
                              $scope.testList = [originalSeries[0].name];
                              return undefined;
                          }),
                            PhSeries.getSeriesList(
                                $scope.originalProject.name,
                                { parent_signature: $scope.originalSignature,
                                  framework: $scope.filterOptions.framework }).then(function(originalSubtestList) {
                                      $scope.pageList = _.map(originalSubtestList, 'name');
                                      $scope.platformList = _.uniq(_.map(originalSubtestList, 'platform'));
                                      return PhCompare.getResultsMap($scope.originalProject.name,
                                                                     originalSubtestList,
                                                                     resultSetIds);
                                  })
                           ]).then(function(results) {
                               var originalSeriesMap = results[1][$scope.originalResultSet.id];
                               var newSeriesMap = results[1][$scope.newResultSet.id];
                               [originalSeriesMap, newSeriesMap].forEach(function(seriesMap) {
                                   // If there is no data for a given signature, handle it gracefully
                                   if (seriesMap) {
                                       Object.keys(seriesMap).forEach(function(series) {
                                           if (!_.contains($scope.pageList, seriesMap[series].name)) {
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

                               PhSeries.getSeriesList(
                                   $scope.newProject.name, { parent_signature: $scope.newSignature }).then(function(newSeriesList) {
                                       $scope.platformList = _.uniq(_.union(
                                           $scope.platformList,
                                           _.map(newSeriesList, 'platform')));
                                       $scope.testList = _.uniq(_.union(
                                           $scope.testList,
                                           _.map(newSeriesList, 'name')));

                                       return PhCompare.getResultsMap($scope.newProject.name,
                                                                      newSeriesList,
                                                                      [$scope.newResultSet.id]);
                                   }).then(function(newSeriesMaps) {
                                       var newSeriesMap = newSeriesMaps[$scope.newResultSet.id];
                                       // There is a chance that we haven't received data for the given signature/resultSet yet
                                       if (newSeriesMap) {
                                           Object.keys(newSeriesMap).forEach(function(series) {
                                               if (!_.contains($scope.pageList, newSeriesMap[series].name)) {
                                                   $scope.pageList.push(newSeriesMap[series].name);
                                               }
                                           });
                                       } else {
                                           newSeriesMap = {};
                                       }
                                       $scope.dataLoading = false;
                                       displayResults(originalSeriesMap, newSeriesMap);
                                   });
                           });
                });
            });
        });
    }]);
