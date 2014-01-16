'use strict';

treeherder.factory('thResultSets',
                   ['$http', 'thUrl',
                   function($http, thUrl) {

    // get the resultsets for this repo
    return {
        getResultSets: function(offset, count, resultsetlist) {
            offset = typeof offset === 'undefined'?  0: offset;
            count = typeof count === 'undefined'?  10: count;
            var params = {
                offset: offset,
                count: count,
                format: "json"
            };
            if (resultsetlist) {
                $.extend(params, {
                    offset: 0,
                    count: resultsetlist.length,
                    resultsetlist: resultsetlist.join()
                })
            }
            return $http.get(thUrl.getProjectUrl("/resultset/"),
                             {params: params}
            );
        }
    }
}]);

treeherder.factory('thResultSetModelManager',
                   ['$log', '$rootScope', 'thResultSets', 'thSocket', 'thJobs',
                   function($log, $rootScope, thResultSets, thSocket, thJobs) {

   /******
    * Handle updating the resultset datamodel based on a queue of jobs
    * and resultsets.
    *
    * manages:
    *     resultset array
    *     socket messages
    *     resultset queue
    *     resultset map
    *     job queue
    *     job map
    */

    // the primary data model
    var result_sets,
        updateQueueInterval,
        rsOffset,

        repoName,

    // queues of updates that have come over socket.io.  Processed at intervals
        jobUpdateQueue,
        rsUpdateQueue,

    // maps to help finding objects to update/add
        rsMap,
        jobMap,
        jobMapOldestId,
        rsMapOldestId;

    /******
     * Build the Job and Resultset object mappings to make it faster and
     * easier to find and update jobs and resultsets
     *
     * @param data The array of resultsets to map.
     */
    var mapResultSets = function(data) {

        for (var rs_i = 0; rs_i < data.length; rs_i++) {
            var rs = data[rs_i];
            rsMap[rs.id] = {
                rs_obj: rs,
                platforms: {}
            };

            if (!rsMapOldestId || rsMapOldestId > rs.id) {
                rsMapOldestId = rs.id;
            }

            // platforms
            for (var pl_i = 0; pl_i < rs.platforms.length; pl_i++) {
                var pl = rs.platforms[pl_i];
                rsMap[rs.id].platforms[pl.name] = {
                    pl_obj: pl,
                    groups: {}
                };

                // groups
                for (var gp_i = 0; gp_i < pl.groups.length; gp_i++) {
                    var gr = pl.groups[gp_i];
                    rsMap[rs.id].platforms[pl.name].groups[gr.name] = {
                        grp_obj: gr
                    };

                    // jobs
                    for (var j_i = 0; j_i < gr.jobs.length; j_i++) {
                        var job = gr.jobs[j_i];
                        jobMap[job.id] = job;

                        if (!jobMapOldestId || jobMapOldestId > job.id) {
                            jobMapOldestId = job.id;
                        }
                    }
                }
            }
        }
        $log.debug("done mapping:");
        $log.debug(rsMap);
    };

    /******
     * Ensure that the platform for ``newJob`` exists.  Create it if
     * necessary.  Add to the datamodel AND the map
     * @param newJob
     * @returns plMapElement
     */
    var getOrCreatePlatform = function(newJob) {
        var rsMapElement = rsMap[newJob.result_set_id];
        var plMapElement = rsMapElement.platforms[newJob.platform];
        if (!plMapElement) {
            // this platform wasn't in the resultset, so add it.
            $log.debug("adding new platform");

            var pl_obj = {
                name: newJob.platform,
                option: newJob.platform_opt,
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
            $log.debug("adding new group");
            var grp_obj = {
                symbol: newJob.job_group_symbol,
                name: newJob.job_group_name,
                jobs: []
            };

            // add the new group to the datamodel
            plMapElement.pl_obj.groups.push(grp_obj);

            // add the new group to the platform map
            // note: while the map didn't NEED to have ``grp_obj: grp_obj``
            // here (it could have just been ``grp_obj``)
            // I did this to maintain consistency with the other map
            // objects.
            plMapElement.groups[grp_obj.name] = {grp_obj: grp_obj};

            grpMapElement = plMapElement.groups[newJob.job_group_name];
        }
        return grpMapElement;
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

        $log.debug("Processing update queue.  jobs: " +
            jobUpdateQueue.length +
            ", resultsets: " +
            rsUpdateQueue.length);
        // clear the ``jobUpdateQueue`` so we won't miss items that get
        // added while in the process of fetching the current queue items.
        var rsFetchList = rsUpdateQueue;
        rsUpdateQueue = [];
        var jobFetchList = jobUpdateQueue;
        jobUpdateQueue = [];

        if (rsFetchList.length > 0) {
            // fetch these resultsets in a batch and put them into the model
            $log.debug("processing the rsFetchList");
            api.fetchNewResultSets(rsFetchList);
        }

        if (jobFetchList.length > 0) {
            $log.debug("processing jobFetchList");
            $log.debug(jobFetchList);

            // make an ajax call to get the job details

            thJobs.getJobs(0, jobFetchList.length, jobFetchList).
                success(updateJobs).
                error(function(data) {
                    $log.error("Error fetching jobUpdateQueue: " + data);
                });
        }
    };

    /***
     * update resultsets and jobs with those that were in the update queue
     * @param jobList List of jobs to be placed in the data model and maps
     */
    var updateJobs = function(jobList) {
        $log.debug("number of jobs returned for add/update: " + jobList.length);
        jobList.forEach(updateJob);

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
        var loadedJob = jobMap[newJob.id];
        if (loadedJob) {
            $log.debug("updating existing job");
            $.extend(loadedJob, newJob);
        } else {
            // this job is not yet in the model or the map.  add it to both
            $log.debug("adding new job");
            var rsMapElement = rsMap[newJob.result_set_id];
            if (!rsMapElement) {
                $log.error("we should have added the resultset for this job already!");
                return;
            }

            var grpMapElement = getOrCreateGroup(newJob);

            // add the job to the datamodel
            grpMapElement.grp_obj.jobs.push(newJob);

            // add job to the jobmap
            jobMap[newJob.id] = newJob;

        }
    };

    var prependResultSets = function(data) {
        // prepend the resultsets because they'll be newer.

        for (var i = data.length - 1; i > -1; i--) {
            $log.debug("prepending resultset: " + data[i].id);
            result_sets.unshift(data[i]);
        }

        mapResultSets(data);

        api.loadingStatus.prepending = false;
    };

    var appendResultSets = function(data) {
        rsOffset += data.length;
        result_sets.push.apply(result_sets, data);

        mapResultSets(data);

        api.loadingStatus.appending = false;
    };

    var api = {

        init: function(interval, repo) {
            $log.debug("new resultset model manager");
            if (interval) {
                updateQueueInterval = interval;
            }

            repoName = repo;
            rsOffset = 0;
            jobUpdateQueue = [];
            rsUpdateQueue = [];
            rsMap = {};
            jobMap = {};
            jobMapOldestId = null;
            rsMapOldestId = null;
            result_sets = [];

            setInterval(processUpdateQueues, updateQueueInterval);
            /*
                socket.io update rules

                new resultset: when a job comes in, check the resultset id.  If
                    its newer than the oldest resultset in memory, then add it to the
                    update queue.  It will be added to the beginning of the resultsets
                    array.

                new job: check against list of jobs.
                    if it exists, update job data.
                    if it is part of the resultset update queue, then don't queue
                        it for update, we will get it with the resultset.
                    If it belongs to an existing resultset, but we don't have it to
                        be updated, then add it to the queue.

             */
            // Add a connect listener
            thSocket.on('connect',function() {
                thSocket.emit('subscribe', $rootScope.repoName + '.job');
                $log.debug("listening for new events.  interval: " + updateQueueInterval +
                    " for repo: " + repoName);
            });

            /******
             * Process a new ``job`` event notification.
             * Check the job's ``result_set_id``.  If the id belongs to a resulset
             * we already have in memory, add it to the ``jobUpdateQueue``.  If
             * not, then check if the ``resultset_id`` is newer or older than the
             * oldest rs_id we have in memory.  If it's newer, then add the
             * ``resultset_id`` to ``rsUpdateQueue``.
             *
             * So basically, if we see a job belonging to a newer resultset we
             * don't yet have loaded, then add it to the list of resultsets to
             * fetch.  Fetching a resultset also gets all its jobs, so we don't
             * need to add it to the ``jobUpdateQueue``.
             */
            thSocket.on("job", function(data) {
                if (data.branch === repoName) {
                    if (data.result_set_id > rsMapOldestId) {
                        // we want to load this job, one way or another
                        if (rsMap[data.result_set_id]) {
                            // we already have this resultset loaded, so queue the job
                            $log.debug("adding job to queue");
                            jobUpdateQueue.push(data.id);
                        } else {
                            // we haven't loaded this resultset yet, so queue it
                            $log.debug("checking resultset queue");
                            if (rsUpdateQueue.indexOf(data.result_set_id) < 0) {
                                $log.debug("new resultset not yet in queue");
                                rsUpdateQueue.push(data.result_set_id);
                            } else {
                                $log.debug("new resultset already queued");
                            }
                        }

                    }
                    else {
                        $log.debug("job too old");
                    }

                }
            });
        },

        getResultSetsArray: function() {
            return result_sets;
        },

        // this is "watchable" by the controller now to update its scope.
        loadingStatus: {
            appending: false,
            prepending: false
        },

        /**
         * For fetching new resultsets via the web socket queue
         * @param resultsetlist list of result set ids to fetch.
         */
        fetchNewResultSets: function(resultsetlist) {

            api.loadingStatus.prepending = true;
            thResultSets.getResultSets(0, resultsetlist.length, resultsetlist).
                success(prependResultSets);
        },

        /**
         * Get the next batch of resultsets based on our current offset.
         * @param count How many to fetch
         */
        fetchResultSets: function(count) {

            api.loadingStatus.appending = true;
            thResultSets.getResultSets(rsOffset, count).
                success(appendResultSets);
        }

    };

    return api;

}]);