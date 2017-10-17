'use strict';

treeherder.component('testDataChooser', {
    templateUrl: 'partials/perf/testdatachooser.html',
    bindings: {
        projects: '<',
        timeRange: '<',
        testsDispayed: '<',
        defaultrameworkId: '<',
        defaultProjectName: '<',
        defaultPlatform: '<',
        options: '<',
        seriesList: '&',
    },
    controller: ['$scope', '$uibModalInstance', '$http',
    'projects', 'timeRange', 'thServiceDomain', 'thDefaultRepo', 'PhSeries',
    'PhFramework', 'defaultFrameworkId', 'defaultProjectName', 'defaultPlatform',
    '$q', 'testsDisplayed', 'options', 'thPerformanceBranches', 'phDefaultFramework',
    function ($scope, $uibModalInstance, $http, projects, timeRange, thServiceDomain,
        thDefaultRepo, PhSeries, PhFramework, defaultFrameworkId, defaultProjectName,
        defaultPlatform, $q, testsDisplayed, options, thPerformanceBranches,
        phDefaultFramework) {
        $scope.timeRange = timeRange;
        $scope.projects = projects;
        $scope.selectedProject = _.find(projects, {
            name: defaultProjectName || thDefaultRepo
        });
        $scope.includeSubtests = false;
        $scope.loadingTestData = false;
        $scope.loadingRelatedSignatures = true;
        var series = [];
        $scope.addTestData = function () {
            if (($scope.testsToAdd.length + testsDisplayed.length) > 6) {
                var a = window.confirm('WARNING: Displaying more than 6 graphs at the same time is not supported in the UI. Do it anyway?');
                if (a === true) {
                    addTestToGraph();
                }
            } else {
                addTestToGraph();
            }
        };

        var addTestToGraph = function () {
            $scope.selectedSeriesList = $scope.testsToAdd;
            $scope.selectedSeriesList.forEach(function (selectedSeries, i) {
                series[i] = _.clone(selectedSeries);
                series[i].projectName = selectedSeries.projectName;
            });
            $uibModalInstance.close(series);
        };

        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };

        $scope.unselectedTestList = []; // tests in the "tests" list
        $scope.selectedTestSignatures = []; // tests in the "tests" list that have been selected by the user
        $scope.testsToAdd = []; // tests in the "tests to add" list
        $scope.selectedTestsToAdd = []; // tests in the "to add" test list that have been selected by the user

        $scope.unselectTest = function () {
            $scope.selectedTestsToAdd.forEach(function (testValue) {
                // selectedTestsToAdd is stored in JSON format, need to convert
                // it back to an object and get the actual value
                var test = _.find($scope.testsToAdd, JSON.parse(testValue));

                // add test back to unselected test list if we're browsing for
                // the current project/platform, otherwise just discard it
                if (test.projectName === $scope.selectedProject.name &&
                    test.platform === $scope.selectedPlatform) {
                    $scope.unselectedTestList.push(test);
                }

                // unconditionally remove it from the current list
                _.remove($scope.testsToAdd, test);
            });
            // resort unselected test list
            $scope.unselectedTestList = _.sortBy($scope.unselectedTestList,
                'name');
        };

        $scope.selectTest = function () {
            $scope.selectedTestSignatures.forEach(function (signature) {
                // Add the selected tests to the selected test list
                $scope.testsToAdd.push(_.clone(
                    _.find($scope.unselectedTestList, { signature: signature })));

                // Remove the added tests from the unselected test list
                _.remove($scope.unselectedTestList, { signature: signature });
            });
        };

        var loadingExtraDataPromise = $q.defer();
        var addRelatedPlatforms = function (originalSeries) {
            PhSeries.getSeriesList(
                originalSeries.projectName, {
                    interval: $scope.timeRange,
                    framework: originalSeries.frameworkId
                }).then(function (seriesList) {
                    $scope.testsToAdd = _.clone(_.filter(seriesList, function (series) {
                        return series.platform !== originalSeries.platform &&
                            series.name === originalSeries.name &&
                            !_.some(testsDisplayed, {
                                projectName: series.projectName,
                                signature: series.signature
                            });
                    }));
                }).then(function () {
                    // resolve the testsToAdd's length after every thing was done
                    // so we don't need timeout here
                    loadingExtraDataPromise.resolve($scope.testsToAdd.length);
                });
        };

        var addRelatedBranches = function (originalSeries) {
            var branchList = [];
            thPerformanceBranches.forEach(function (branch) {
                if (branch !== originalSeries.projectName) {
                    branchList.push(_.find($scope.projects, { name: branch }));
                }
            });
            // get each project's series data from remote and use promise to
            // ensure each step will be executed after last on has finished
            $q.all(branchList.map(function (project) {
                return PhSeries.getSeriesList(project.name, {
                    interval: $scope.timeRange,
                    signature: originalSeries.signature,
                    framework: originalSeries.frameworkId
                });
            })).then(function (seriesList) {
                // we get a list of lists because we are getting the results
                // of multiple promises, filter that down to one flat list
                seriesList = _.flatten(seriesList);

                // filter out tests which are already displayed
                $scope.testsToAdd = _.filter(seriesList, function (series) {
                    return !_.some(testsDisplayed, {
                        projectName: series.projectName,
                        signature: series.signature
                    });
                });
            }).then(function () {
                loadingExtraDataPromise.resolve($scope.testsToAdd.length);
            });
        };

        var addRelatedConfigs = function (originalSeries) {
            PhSeries.getSeriesList(
                originalSeries.projectName, {
                    interval: $scope.timeRange,
                    framework: originalSeries.frameworkId
                }).then(function (seriesList) {
                    $scope.testsToAdd = _.clone(_.filter(seriesList, function (series) {
                        return series.platform === originalSeries.platform &&
                            series.testName === originalSeries.testName &&
                            series.name !== originalSeries.name;
                    }));
                }).then(function () {
                    // resolve the testsToAdd's length after every thing was done
                    // so we don't need timeout here
                    loadingExtraDataPromise.resolve($scope.testsToAdd.length);
                });
        };
        if (options.option !== undefined) {
            $scope.loadingRelatedSignatures = false;
            if (options.option === "addRelatedPlatform") {
                addRelatedPlatforms(options.relatedSeries);
            } else if (options.option === "addRelatedBranches") {
                addRelatedBranches(options.relatedSeries);
            } else if (options.option === "addRelatedConfigs") {
                addRelatedConfigs(options.relatedSeries);
            }
            loadingExtraDataPromise.promise.then(function (length) {
                if (length > 0) {
                    $scope.loadingRelatedSignatures = true;
                } else {
                    window.alert("Oops, no related platforms or branches have been found.");
                }
            });
        }

        PhFramework.getFrameworkList().then(function (frameworkList) {
            $scope.frameworkList = frameworkList;
            if (defaultFrameworkId) {
                $scope.selectedFramework = _.find($scope.frameworkList, {
                    id: defaultFrameworkId
                });
            } else {
                $scope.selectedFramework = _.find($scope.frameworkList, {
                    name: phDefaultFramework
                });
            }
            $scope.updateTestInput = function () {
                $scope.addTestDataDisabled = true;
                $scope.loadingTestData = true;
                $scope.loadingPlatformList = true;
                $scope.platformList = [];
                PhSeries.getPlatformList($scope.selectedProject.name, {
                    interval: $scope.timeRange,
                    framework: $scope.selectedFramework.id }).then(function (platformList) {
                        $scope.platformList = platformList;
                        $scope.platformList.sort();
                        if (_.includes($scope.platformList, defaultPlatform)) {
                            $scope.selectedPlatform = defaultPlatform;
                        } else {
                            $scope.selectedPlatform = $scope.platformList[0];
                        }
                        $scope.loadingPlatformList = false;
                        $scope.updateTestSelector();
                    });

                $scope.updateTestSelector = function () {
                    $scope.loadingTestData = true;
                    if ($scope.selectedPlatform) {
                        defaultPlatform = $scope.selectedPlatform;
                    }
                    PhSeries.getSeriesList(
                        $scope.selectedProject.name,
                        { interval: $scope.timeRange,
                            platform: $scope.selectedPlatform,
                            framework: $scope.selectedFramework.id,
                            subtests: $scope.includeSubtests ? 1 : 0 }).then(function (seriesList) {
                                $scope.unselectedTestList = _.sortBy(
                                    _.filter(seriesList,
                                    { platform: $scope.selectedPlatform }), 'name');
                                // filter out tests which are already displayed or are
                                // already selected
                                _.forEach(_.union(testsDisplayed, $scope.testsToAdd),
                                    function (test) {
                                        _.remove($scope.unselectedTestList, {
                                            projectName: test.projectName,
                                            signature: test.signature });
                                    });
                                $scope.loadingTestData = false;
                            });
                };

            };
            $uibModalInstance.updateTestInput = $scope.updateTestInput;
            $scope.updateTestInput();
        });
    }]
});