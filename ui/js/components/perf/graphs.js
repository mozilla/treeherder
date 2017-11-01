'use strict';

treeherder.component('testDataChooser', {
    template: `
        <div class="modal fade" id="test-data-chooser-modal" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
              <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button>
                <h4 class="modal-title">Add test data</h4>
              </div>
              <div class="modal-body" ng-show="!loadingRelatedSignatures">
                  <p class="blink" >Getting related test information ...</p>
              </div>
              <div class="modal-body" ng-show="loadingRelatedSignatures">
                <div id="performance-test-chooser" class="test-chooser">
                  <div class="form-group">
                    <label>Framework</label>
                    <select class="form-control" ng-change="updateTestInput()" ng-model="selectedFramework" ng-options="framework.name for framework in frameworkList">
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Project</label>
                    <select class="form-control" ng-change="updateTestInput()" ng-model="selectedProject" ng-options="project.name for project in projects">
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Platform</label>
                    <p class="blink" ng-show="loadingPlatformList">Loading platform list...</p>
                    <select class="form-control" ng-hide="loadingPlatformList" ng-change="updateTestSelector()" ng-model="selectedPlatform" ng-options="platform for platform in platformList">
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Tests</label>
                    <div class="test-loading-placeholder" ng-show="loadingTestData">
                      <p class="blink">Loading series data...</p>
                    </div>
                    <input class="form-control input-sm" type="text" ng-model="testFilter" placeholder="Filter tests" ng-model-options="{debounce: 250}" ng-hide="loadingTestData"/>
                    <select ng-hide="loadingPlatformList || loadingTestData" multiple class="form-control choose-test-list" ng-model="selectedTestSignatures" ng-hide="loadingTestData">
                      <option value="{{::testElem.signature}}" ng-repeat="testElem in unselectedTestList| testNameContainsWords: testFilter track by testElem.signature" title="{{::testElem.name}}">
                        {{::testElem.name}}
                      </option>
                    </select>
                  </div>
                  <div class="checkbox">
                    <label>
                      <input type="checkbox" ng-model="includeSubtests" ng-change="updateTestSelector()">Include subtests</input>
                    </label>
                  </div>
                </div>
                <div class="btn-group-vertical">
                  <button id="unselect-test" ng-click="unselectTest()" type="button" class="btn btn-xs btn-default" ng-disabled="!testsToAdd.length">
                    <span class="glyphicon glyphicon-chevron-left"></span>
                  </button>
                  <button id="select-test" ng-click="selectTest()" type="button" class="btn btn-xs btn-default" ng-disabled="!unselectedTestList.length">
                    <span class="glyphicon glyphicon-chevron-right"></span>
                  </button>
                </div>
                <div class="test-list-container">
                  <div id="added-test-list" class="form-group">
                    <label>Tests to add</label>
                    <select multiple class="form-control" ng-model="selectedTestsToAdd">
                      <option value="{{testToAdd}}" ng-repeat="testToAdd in testsToAdd"
                              title="{{testToAdd.projectName}} {{testToAdd.platform}} {{testToAdd.name}}">
                         {{testToAdd.projectName}} {{testToAdd.platform}}
                         {{testToAdd.name}}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-primary" ng-click="addTestData()" ng-disabled="!testsToAdd.length" ng-model="rightList"><span class="glyphicon glyphicon-plus" aria-hidden="true"></span> Add</button>
              </div>
            </div>
          </div>
        </div>
    `,
    bindings: {
        initFunction: '<',
        successCallback: '<'
    },
    controller: ['$scope', '$http', 'thServiceDomain', 'thDefaultRepo', 'PhSeries',
        'PhFramework', '$q', 'thPerformanceBranches', 'phDefaultFramework',
        function ($scope, $http, thServiceDomain, thDefaultRepo, PhSeries,
            PhFramework, $q, thPerformanceBranches, phDefaultFramework) {

            const ctrl = this;
            let defaultFrameworkId, defaultProjectName, defaultPlatform, options, testsDisplayed;
            let series = [];
            let loadingExtraDataPromise = $q.defer();

            $('#test-data-chooser-modal').on('show.bs.modal', function (event) {
                let timeRange, projects;
                const target = $(event.relatedTarget); // Button that triggered the modal
                const option = target.data('option');
                const seriesSignature = target.data('series-signature');
                let initialValues = ctrl.initFunction(option, seriesSignature);

                ({ defaultFrameworkId, defaultProjectName, defaultPlatform,
                   projects, timeRange, testsDisplayed, options } = initialValues);

                $scope.timeRange = timeRange;
                $scope.projects = projects;
                $scope.selectedProject = _.find($scope.projects, {
                    name: defaultProjectName || thDefaultRepo
                });

                $scope.includeSubtests = false;
                $scope.loadingTestData = false;
                $scope.loadingRelatedSignatures = true;

                $scope.unselectedTestList = []; // tests in the "tests" list
                $scope.selectedTestSignatures = []; // tests in the "tests" list that have been selected by the user
                $scope.testsToAdd = []; // tests in the "tests to add" list
                $scope.selectedTestsToAdd = []; // tests in the "to add" test list that have been selected by the user

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
                    $scope.updateTestInput();
                });
            });

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
                ctrl.successCallback(series);
                $('#test-data-chooser-modal').modal('hide');
            };

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

        }]
});
