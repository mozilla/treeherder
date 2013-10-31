"use strict";

treeherder.controller('JobsCtrl',
    function JobsCtrl($scope, $http, $rootScope, $routeParams, $log,
                      thUrl, thResultSets) {

        // set the default repo to mozilla-central if not specified
        if ($routeParams.hasOwnProperty("repo") &&
            $routeParams.repo !== "") {
            $rootScope.repo = $routeParams.repo;
        } else {
            $rootScope.repo = "mozilla-inbound";
        }

        $scope.offset = 0;
        $scope.result_sets = [];

        $scope.nextResultSets = function(count) {

            thResultSets.getResultSets($scope.offset, count).
                success(function(data) {
                    $scope.offset += count;
                    $scope.result_sets.push.apply($scope.result_sets, data);
                }).
                error(function(data, status, header, config) {
                    $scope.statusError("Error getting result sets and jobs from service");
                });

        };

        $scope.nextResultSets(3);

    }
);

treeherder.controller('ResultSetCtrl',
    function ResultSetCtrl($scope, $rootScope, $http, $log,
                      thResults, thUrl, thServiceDomain) {
        // whether or not revision list for a resultset is collapsed
        $scope.isCollapsedRevisions = true;
        $scope.isCollapsedResults = true;

        // get the jobs list for the current resultset
        thResults.getResults($scope.resultset, $scope);

        $scope.viewJob = function(job) {
            // set the selected job
            $rootScope.selectedJob = job;
        };

        $scope.viewLog = function(job_uri) {
            // open the logviewer for this job in a new window
            // currently, invoked by right-clicking a job.

            $http.get(thServiceDomain + job_uri).
                success(function(data) {
                    if (data.hasOwnProperty("artifacts")) {
                        data.artifacts.forEach(function(artifact) {
                            if (artifact.name === "Structured Log") {
                                window.open(thUrl.getLogViewerUrl(artifact.id));
                            }
                        });
                    } else {
                        $log.warn("Job had no artifacts: " + job_uri);
                    }
                });

        };
    }
);
