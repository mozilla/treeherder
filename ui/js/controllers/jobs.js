"use strict";

treeherder.controller('JobsCtrl',
    function JobsCtrl($scope, $http, $rootScope, $routeParams, $log,
                      thUrl, thResultSets, thRepos) {

        // set the default repo to mozilla-inbound if not specified
        if ($routeParams.hasOwnProperty("repo") &&
            $routeParams.repo !== "") {
            $rootScope.repoName = $routeParams.repo;
        } else {
            $rootScope.repoName = "mozilla-inbound";
        }

        thRepos.load($scope.repoName);

        $scope.offset = 0;
        $scope.result_sets = [];
        $scope.isLoadingRsBatch = false;

        $scope.nextResultSets = function(count) {

            $scope.isLoadingRsBatch = true;

            thResultSets.getResultSets($scope.offset, count).
                success(function(data) {
                    $scope.offset += count;
                    $scope.result_sets.push.apply($scope.result_sets, data);
                    $scope.isLoadingRsBatch = false;
                }).
                error(function(data, status, header, config) {
                    $scope.statusError("Error getting result sets and jobs from service");
                    $scope.isLoadingRsBatch = false;
                });

        };

        $scope.nextResultSets(10);

    }
);

treeherder.controller('ResultSetCtrl',
    function ResultSetCtrl($scope, $rootScope, $http, $log,
                           thUrl, thServiceDomain, thResultStatusInfo) {

        // determine the greatest severity this resultset contains
        // so that the UI can depict that
        var getMostSevereResultStatus = function(result_types) {

            var status = "pending",
                rsInfo = thResultStatusInfo(status);

            for (var i = 0; i < result_types.length; i++) {
                var res = thResultStatusInfo(result_types[i]);
                if (res.severity < rsInfo.severity) {
                    status = result_types[i];
                    rsInfo = res;
                }
            }
            return {status: status, isCollapsedResults: rsInfo.isCollapsedResults};
        };

        var severeResultStatus = getMostSevereResultStatus($scope.resultset.result_types);
        $scope.resultSeverity = severeResultStatus.status;
        $scope.isCollapsedResults = severeResultStatus.isCollapsedResults;

        // whether or not revision list for a resultset is collapsed
        $scope.isCollapsedRevisions = true;

        // convert the platform names to human-readable using the TBPL
        // Config.js file
        for(var i = 0; i < $scope.resultset.platforms.length; i++) {
            var platform = $scope.resultset.platforms[i];
            var re = /(.+)(opt|debug|asan|pgo)$/i;
            var platformArr = re.exec(platform.name);

            if (platformArr) {
                var newName = Config.OSNames[platformArr[1].trim()];
                if (newName) {
                    platform.name = newName + " " + platformArr[2];
                }
            }
        }

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
