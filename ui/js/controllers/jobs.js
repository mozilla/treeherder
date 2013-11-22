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

        $scope.nextResultSets(10);

    }
);

treeherder.controller('ResultSetCtrl',
    function ResultSetCtrl($scope, $rootScope, $http, $log,
                           thUrl, thServiceDomain) {

        var SEVERITY = {
            "busted":     {
                level: 1,
                isCollapsedResults: false
            },
            "exception":  {
                level: 2,
                isCollapsedResults: false
            },
            "testfailed": {
                level: 3,
                isCollapsedResults: false
            },
            "usercancel":    {
                level: 4,
                isCollapsedResults: false
            },
            "retry":      {
                level: 5,
                isCollapsedResults: true
            },
            "success":    {
                level: 6,
                isCollapsedResults: true
            },
            "unknown":    {
                level: 100,
                isCollapsedResults: true
            }
        };

        // determine the greatest severity this resultset contains
        // so that the UI can show depict that
        var getSeverity = function(result_types) {

            var severity = "unknown",
                highest = SEVERITY.unknown;

            for (var i = 0; i < result_types.length; i++) {
                if (SEVERITY[result_types[i]]) {
                    if (SEVERITY[result_types[i]].level < highest.level) {
                        severity = result_types[i];
                        highest = SEVERITY[severity];
                    }
                } else {
                    console.warn("WARNING: Unidentified result_type: " + result_types[i]);
                }
            }
            return severity;
        };

        $scope.resultSeverity = getSeverity($scope.resultset.result_types);

        // whether or not revision list for a resultset is collapsed
        $scope.isCollapsedRevisions = true;
        $scope.isCollapsedResults = SEVERITY[$scope.resultSeverity].isCollapsedResults;

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
