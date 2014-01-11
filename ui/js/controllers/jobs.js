"use strict";

treeherder.controller('JobsCtrl',
    function JobsCtrl($scope, $http, $rootScope, $routeParams, $log, $cookies,
                      localStorageService, thUrl, thResultSets, thRepos, thSocket) {

        // set the default repo to mozilla-inbound if not specified
        if ($routeParams.hasOwnProperty("repo") &&
            $routeParams.repo !== "") {
            $rootScope.repoName = $routeParams.repo;
        } else {
            $rootScope.repoName = "mozilla-inbound";
        }

        // handle the most recent used repos
        $rootScope.update_mru_repos = function(repo){
            var max_mru_repos_length = 6;
            var curr_repo_index = $scope.mru_repos.indexOf($rootScope.repoName);
            if( curr_repo_index != -1){
                $scope.mru_repos.splice(curr_repo_index, 1);
            }
            $scope.mru_repos.unshift($rootScope.repoName);
            if($scope.mru_repos.length > max_mru_repos_length){
                var old_branch= $scope.mru_repos.pop();
                thSocket.emit('subscribe', old_branch+'.job_failure')
                $log.log("subscribing to "+old_branch+'.job_failure');
            }
            localStorageService.set("mru_repos", $scope.mru_repos);
        }

        $rootScope.update_mru_repos($rootScope.repoName)

        // stop receiving new failures for the current branch
        if($rootScope.new_failures.hasOwnProperty($rootScope.repoName)){
            delete $rootScope.new_failures[$rootScope.repoName];
        }

        $scope.offset = 0;
        $scope.result_sets = [];

        thRepos.load($scope.repoName);

        $scope.isLoadingRsBatch = false;

        $scope.nextResultSets = function(count) {

            $scope.isLoadingRsBatch = true;
            // mapping of job ids to job objects with resultset and platform
            $scope.jobMap = {};

            thResultSets.getResultSets($scope.offset, count).
                success(function(data) {
                    $scope.offset += count;
                    $scope.result_sets.push.apply($scope.result_sets, data);

                    // add all the jobs to the jobMap

                    // resultsets
                    for (var rs_i = 0; rs_i < data.length; rs_i++) {
                        var rs = data[rs_i];

                        // platforms
                        for (var pl_i = 0; pl_i < rs.platforms.length; pl_i++) {
                            var pl = rs.platforms[pl_i];

                            // groups
                            for (var gp_i = 0; gp_i < pl.groups.length; gp_i++) {
                                var gr = pl.groups[gp_i];
                                // jobs
                                for (var j_i = 0; j_i < gr.jobs.length; j_i++) {
                                    var job = gr.jobs[j_i];
                                    $scope.jobMap[job.job_id] = {
                                        job: job,
                                        resultset: rs,
                                        platform: pl,
                                        group: gr
                                    };

                                }
                            }
                        }

                    }
                    $scope.isLoadingRsBatch = false;
                    console.log("oldest: " + $scope.jobMapOldestId);
                }).
                error(function(data, status, header, config) {
                    $scope.statusError("Error getting result sets and jobs from service");
                    $scope.isLoadingRsBatch = false;
                });

        };

        $scope.nextResultSets(1);

//        $scope.nextTestJob = 0;
        $scope.findJob = function(job_id) {
//            var oldJob = $scope.testJobs[$scope.nextTestJob++];

            var oldJob = $scope.jobMap[job_id].job;
            return oldJob;
        };

        $scope.updateJob = function(newJob) {
            console.log("checking about update for " + newJob.job_id);
            var oldJob = $scope.findJob(newJob.job_id);
            if (oldJob) {
                console.warn("got one: " + newJob.job_id);
                console.log("was result: " + oldJob.result);
                console.log("now result: " + newJob.result);
                $.extend(oldJob, newJob);

//                @@@ This causes the job button to flash yellow for a second to
//                draw attention to the update.  Not sure if we want it or not.
//                var $job = $("th-job-button span[data-job-id='" + oldJob.job_id + "']");
//                $job.effect("highlight", {}, 1500);
            }
        };


        // Add a connect listener
        thSocket.on('connect',function() {
            thSocket.emit('subscribe', '*');
        });

//        thSocket.on("resultset", function(data) {
//            if (data.branch === $scope.repoName) {
//                $log.info("new resultset");
//                $log.info(data);
//            }
//        });
        thSocket.on("job", function(data) {
            if (data.branch === $scope.repoName) {
                if ($scope.jobMap[data.id]) {
                    console.log("updating job: " + data.id);
                    $http.get(thUrl.getProjectUrl("/jobs/" + data.id + "/")).
                        success($scope.updateJob);
                } else {
                    console.log("skipping job: " + data.id);
                }

            }
        });

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
