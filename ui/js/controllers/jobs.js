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

        // the primary data model
        thResultSetModelManager.init(60000, $scope.repoName);
        $scope.result_sets = thResultSetModelManager.getResultSetsArray();

        $rootScope.update_mru_repos($rootScope.repoName)

        // stop receiving new failures for the current branch
        if($rootScope.new_failures.hasOwnProperty($rootScope.repoName)){
            delete $rootScope.new_failures[$rootScope.repoName];
        }

        $scope.offset = 0;
        $scope.result_sets = [];
        $scope.isLoadingRsBatch = false;

        // load our initial set of resultsets
        thResultSetModelManager.fetchResultSets($scope.offset, 3);
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
                }).
                error(function(data, status, header, config) {
                    $scope.statusError("Error getting result sets and jobs from service");
                    $scope.isLoadingRsBatch = false;
                });

        };

        $scope.nextResultSets(1);

        /******
         * Build the Job and Resultset object mappings to make it faster and
         * easier to find and update jobs and resultsets
         *
         * @param data The array of resultsets to map.
         * @return The ids of the jobs that were just added.
         */
        var mapResultsets = function(data) {

            for (var rs_i = 0; rs_i < data.length; rs_i++) {
                var rs = data[rs_i];
                $scope.rsMap[rs.id] = {
                    rs_obj: rs,
                    platforms: {}
                };

                if (!$scope.rsMapOldestId || $scope.rsMapOldestId > rs.id) {
                    $scope.rsMapOldestId = rs.id;
                }

                // platforms
                for (var pl_i = 0; pl_i < rs.platforms.length; pl_i++) {
                    var pl = rs.platforms[pl_i];
                    $scope.rsMap[rs.id].platforms[pl.name] = {
                        pl_obj: pl,
                        groups: {}
                    };

                    // groups
                    for (var gp_i = 0; gp_i < pl.groups.length; gp_i++) {
                        var gr = pl.groups[gp_i];
                        $scope.rsMap[rs.id].platforms[pl.name].groups[gr.name] = {
                            grp_obj: gr
                        };

                        // jobs
                        for (var j_i = 0; j_i < gr.jobs.length; j_i++) {
                            var job = gr.jobs[j_i];
                            $scope.jobMap[job.job_id] = job;

                            if (!$scope.jobMapOldestId || $scope.jobMapOldestId > job.job_id) {
                                $scope.jobMapOldestId = job.job_id;
                            }
                        }
                    }
                }

            }
        };

        /******
         * Socket.io handling for new and updated jobs and resultsets
         *
         * First we fetch new resultsets.  These may contain some of the jobs
         * in the jobUpdateQueue.  So after getting the resultsets, we check
         * if any of the jobs in the queue were fetched and remove them from
         * the job queue before fetching them.
         *
         * Then we fetch the remaining jobs in a batch and add them to their
         * appropriate resultset.
         */
        var processUpdateQueues = function() {

            console.log("Processing update queue.  jobs: " +
                $scope.jobUpdateQueue.length +
                ", resultsets: " +
                $scope.rsUpdateQueue.length);
            // clear the ``jobUpdateQueue`` so we won't miss items that get
            // added while in the process of fetching the current queue items.
            var rsFetchList = $scope.rsUpdateQueue;
            $scope.rsUpdateQueue = [];
            var jobFetchList = $scope.jobUpdateQueue;
            $scope.jobUpdateQueue = [];

            if (rsFetchList.length > 0) {
                // fetch these resultsets in a batch and put them into the model
                console.log("processing the rsFetchList");
                $scope.fetchResultSets(rsFetchList.length, rsFetchList);
            }

            if (jobFetchList.length > 0) {
                console.log("processing jobFetchList");
                console.log(jobFetchList);

                // make an ajax call to get the job details

                thJobs.getJobs(0, jobFetchList.length, jobFetchList).
                    success($scope.updateJobs).
                    error(function(data) {
                        console.error("Error fetching jobUpdateQueue: " + data);
                    });
            }
        };
        setInterval(processUpdateQueues, updateQueueProcessInterval);

        /***
         * update resultsets and jobs with those that were in the update queue
         * @param jobList List of jobs to be placed in the data model and maps
         */
        $scope.updateJobs = function(jobList) {


        /*















            The query is not returning all the jobs that I submit IDs for.

            I think it was the limit.  should be fixed now


            I'm still not getting resultset events.















         */



            console.log("number of jobs returned for add/update: " + jobList.length);
            for (var i = 0; i < jobList.length; i++) {
                updateJob(jobList[i]);
            }
//            jobList.forEach(updateJob);

        };

        /******
         *
         * Add or update a new job.  Either we have it loaded already and the
         * status and info need to be updated.  Or we have the resultset, and
         * the job needs to be added to that resultset.
         *
         * Check the map, and update.  or add by finding the right place.
         *
         * Shape of the rsMap:
         * -------------------
         * rsMap = {
               <rs_id1>: {
                   rs_obj: rs_obj,
                   platforms: {
                       <pl_name1>: {
                           pl_obj: pl_obj,
                           groups: {
                               <grp_name1>: {
                                   grp_obj: grp_obj
                               },
                               <grp_name2>: {...}
                           }
                       },
                       <pl_name2>: {...}
                   },
               <rs_id2>: {...}
               }
           }
         *
         *
         * @param newJob The new job object that was just fetched which needs
         *               to be added or updated.
         */
        var updateJob = function(newJob) {
            var loadedJob = $scope.jobMap[newJob.job_id];
            if (loadedJob) {
                console.log("job already loaded, updating");
                $.extend(loadedJob, newJob);
            } else {
                // this job is not yet in the model or the map.  add it to both
                console.log("adding new job");
                var rsMapElement = $scope.rsMap[newJob.result_set_id];
                if (!rsMapElement) {
                    console.error("we should have added the resultset for this job already!");
                    console.error("Not added:");
                    console.error(newJob);
                    return;
                }

                var grpMapElement = getOrCreateGroup(newJob);

                // add the job to the datamodel
                grpMapElement.jobs.push(newJob);

                // add job to the jobmap
                $scope.jobMap[newJob.job_id] = newJob;

            }
        };

        /******
         * Ensure that the platform for ``newJob`` exists.  Create it if
         * necessary.  Add to the datamodel AND the map
         * @param newJob
         * @returns plMapElement
         */
        var getOrCreatePlatform = function(newJob) {
            var rsMapElement = $scope.rsMap[newJob.result_set_id];
            var plMapElement = rsMapElement.platforms[newJob.platform];
            if (!plMapElement) {
                // this platform wasn't in the resultset, so add it.
                console.log("adding new platform");

                var pl_obj = {
                    name: newJob.platform,
                    groups: []
                };

                // add the new platform to the datamodel
                rsMapElement.rs_obj.platforms.push(pl_obj);
                // @@@ sort here?

                // add the new platform to the resultset map
                rsMapElement.platforms[newJob.platform] = {
                    pl_obj: pl_obj,
                    groups: {}
                };
                plMapElement = rsMapElement.platforms[newJob.platform];
            }
            return plMapElement;
        };

        /******
         * Ensure that the group and platform for ``newJob`` exist.
         * Create it if necessary.  Add to the datamodel AND the map
         * @param newJob
         * @returns grpMapElement
         */
        var getOrCreateGroup = function(newJob) {
            var plMapElement = getOrCreatePlatform(newJob);
            var grpMapElement = plMapElement.groups[newJob.job_group_name];
            if (!grpMapElement) {
                console.log("adding new group");
                var grp_obj = {
                    symbol: newJob.job_group_symbol,
                    name: newJob.job_group_name,
                    jobs: []
                };

                // add the new group to the datamodel
                plMapElement.pl_obj.groups.push(grp_obj);

                // add the new group to the platform map
                plMapElement.groups[grp_obj.name] = grp_obj;

                grpMapElement = plMapElement.groups[newJob.job_group_name];
            }
            return grpMapElement;
        };

        /*
            socket.io update rules

            need in-memory object keyed off job id matched to every job.
            already have that for resultsets

            new resultset: check against list of resultsets, if not there, insert
            at appropriate place sorted by date

            new job: check against list of jobs.
              if it exists, update job data.
              If it doesn't, then must find the matching resultset, platform,
                and group to add it in.

            new job_failure:

         */
        // Add a connect listener
        thSocket.on('connect',function() {
            thSocket.emit('subscribe', '*');
        });

        thSocket.on("resultset", function(data) {
            console.log("seeing a resultset event: " + data.id);

            if (data.branch === $scope.repoName) {
                if (data.id > $scope.rsMapOldestId) {
                    console.log("adding resultset to queue: " + data.id);
                    $scope.rsUpdateQueue.push(data.id);
                } else {
                    console.log("skipping older resultset");
                }
            }
        });

        thSocket.on("job", function(data) {
            if (data.branch === $scope.repoName) {
                // only add jobs to queue if they are part of a resultset
                // we already have fetched.
                // if they are part of a resultset that we are queued to fetch
                // in rsUpdateQueue, then we will get that job anyway when we
                // get the resultset.
                // Otherwise, the job lies outside what the user wants to view
                // like it may be too old.
                if ($scope.rsMap[data.result_set_id]) {
                    console.log("adding job to queue");
                    $scope.jobUpdateQueue.push(data.id);
                } else {
                    console.log("skipping job from resultset not yet loaded.");
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
