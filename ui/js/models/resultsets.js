'use strict';

treeherder.factory('ThResultSetModel',
                   function($rootScope, $location, thResultSets, thSocket,
                            ThJobModel, thEvents, thAggregateIds, ThLog,
                            thNotify) {

    var $log = new ThLog("ThResultSetModel");

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
    var repositories = {};

    var updateQueueInterval = 10000;

    var addRepository = function(repoName){
        //Initialize a new repository in the repositories structure
        var locationSearch = _.clone($location.search());
        $log.debug("locationSearch", locationSearch);

        if(_.isEmpty(repositories[repoName]) ||
           !_.isEqual(locationSearch, repositories[repoName].search)){
            $log.debug(
                "fetching new resultset list with parameters:",
                locationSearch
                );

            repositories[repoName] = {

                name:repoName,

                //This is set to the id of the last resultset loaded
                //and used as the offset in paging
                rsOffsetId:0,

                // queues of updates that have come over socket.io.
                // Processed at intervals
                jobUpdateQueue:[],
                rsUpdateQueue:[],

                lastJobElSelected:{},
                lastJobObjSelected:{},

                // maps to help finding objects to update/add
                rsMap:{},
                jobMap:{},
                jobMapOldestId:null,
                rsMapOldestTimestamp:null,
                resultSets:[],

                // this is "watchable" by the controller now to update its scope.
                loadingStatus: {
                    appending: false,
                    prepending: false
                },
                search: locationSearch
            };

            // Add a connect listener
            thSocket.on('connect',function() {
                // subscribe to all the events for this repo
                thSocket.emit('subscribe', repoName);
                });

            //Set up job update queue
            setInterval(
                _.bind(processUpdateQueues, $rootScope, repoName),
                updateQueueInterval
                );

            //Set up the socket listener
            thSocket.on(
                "job",
                _.bind(processSocketData, $rootScope, repoName)
                );
        }
    };

    var processSocketData = function(repoName, data){
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
        if (data.branch === repoName) {
            if (data.resultset.push_timestamp >= repositories[repoName].rsMapOldestTimestamp &&
                isInResultSetRange(repoName, data.resultset.push_timestamp)) {

                // we want to load this job, one way or another
                if (repositories[repoName].rsMap[data.resultset.id]) {
                    // we already have this resultset loaded, so queue the job
                    repositories[repoName].jobUpdateQueue.push(data.id);
                } else {
                    // we haven't loaded this resultset yet, so queue it
                    if (repositories[repoName].rsUpdateQueue.indexOf(data.resultset.id) < 0) {
                        repositories[repoName].rsUpdateQueue.push(data.resultset.id);
                    }
                }
            }
        }
    };

    var getJobMapKey = function(job) {
        //Build string key for jobMap entires
        return 'key' + job.id;
    };

    var getSelectedJob = function(repoName){
        return { el:repositories[repoName].lastJobElSelected,
                 job:repositories[repoName].lastJobObjSelected };
    };

    var setSelectedJob = function(
        repoName, lastJobElSelected, lastJobObjSelected){

        repositories[repoName].lastJobElSelected = lastJobElSelected;
        repositories[repoName].lastJobObjSelected = lastJobObjSelected;
    };

    var getPlatformKey = function(name, option){
        var key = name;
        if(option !== undefined){
            key += option;
        }
        return key;
    };

    /******
     * Build the Job and Resultset object mappings to make it faster and
     * easier to find and update jobs and resultsets
     *
     * @param data The array of resultsets to map.
     */
    var mapResultSets = function(repoName, data) {

        for (var rs_i = 0; rs_i < data.length; rs_i++) {
            var rs_obj = data[rs_i];
            // make a watch-able revisions array
            rs_obj.revisions = [];

            var rsMapElement = {
                rs_obj: rs_obj,
                platforms: {}
            };
            repositories[repoName].rsMap[rs_obj.id] = rsMapElement;

            // keep track of the oldest push_timestamp, so we don't auto-fetch resultsets
            // that are out of the range we care about.
            if ( !repositories[repoName].rsMapOldestTimestamp ||
                 (repositories[repoName].rsMapOldestTimestamp > rs_obj.push_timestamp)) {
                repositories[repoName].rsMapOldestTimestamp = rs_obj.push_timestamp;
            }

            //Keep track of the last resultset id for paging
            var resultsetId = parseInt(rs_obj.id, 10);
            if( (resultsetId < repositories[repoName].rsOffsetId) ||
                (repositories[repoName].rsOffsetId === 0) ){
                repositories[repoName].rsOffsetId = resultsetId;
            }

            // platforms
            for (var pl_i = 0; pl_i < rs_obj.platforms.length; pl_i++) {
                var pl_obj = rs_obj.platforms[pl_i];

                var plMapElement = {
                    pl_obj: pl_obj,
                    parent: repositories[repoName].rsMap[rs_obj.id],
                    groups: {}
                };
                var platformKey = getPlatformKey(pl_obj.name, pl_obj.option);
                repositories[repoName].rsMap[rs_obj.id].platforms[platformKey] = plMapElement;

                // groups
                for (var gp_i = 0; gp_i < pl_obj.groups.length; gp_i++) {
                    var gr_obj = pl_obj.groups[gp_i];

                    var grMapElement = {
                        grp_obj: gr_obj,
                        parent: plMapElement,
                        jobs: {}
                    };
                    plMapElement.groups[gr_obj.name] = grMapElement;

                    // jobs
                    for (var j_i = 0; j_i < gr_obj.jobs.length; j_i++) {
                        var job_obj = gr_obj.jobs[j_i];
                        var key = getJobMapKey(job_obj);

                        var jobMapElement = {
                            job_obj: job_obj,
                            parent: grMapElement
                        };
                        grMapElement.jobs[key] = jobMapElement;
                        repositories[repoName].jobMap[key] = jobMapElement;

                        // track oldest job id
                        if (!repositories[repoName].jobMapOldestId ||
                            (repositories[repoName].jobMapOldestId > job_obj.id)) {
                            repositories[repoName].jobMapOldestId = job_obj.id;
                        }
                    }
                }
            }
        }

        repositories[repoName].resultSets.sort(rsCompare);

        $log.debug("oldest job: ", repositories[repoName].jobMapOldestId);
        $log.debug("oldest result set: ", repositories[repoName].rsMapOldestTimestamp);
        $log.debug("done mapping:", repositories[repoName].rsMap);
    };

    /**
     * Sort the resultsets in place after updating the array
     */
    var rsCompare = function(a, b) {
        if (a.push_timestamp > b.push_timestamp) {
          return -1;
        }
        if (a.push_timestamp < b.push_timestamp) {
          return 1;
        }
        return 0;
    };

    /******
     * Ensure that the platform for ``newJob`` exists.  Create it if
     * necessary.  Add to the datamodel AND the map
     * @param newJob
     * @returns plMapElement
     */
    var getOrCreatePlatform = function(repoName, newJob) {
        var rsMapElement = repositories[repoName].rsMap[newJob.result_set_id];
        var platformKey = getPlatformKey(newJob.platform, newJob.platform_option);
        var plMapElement = rsMapElement.platforms[platformKey];
        if (!plMapElement) {
            // this platform wasn't in the resultset, so add it.
            $log.debug("adding new platform");

            var pl_obj = {
                name: newJob.platform,
                option: newJob.platform_option,
                groups: []
            };

            // add the new platform to the datamodel and resort
            rsMapElement.rs_obj.platforms.push(pl_obj);

            // add the new platform to the resultset map
            rsMapElement.platforms[platformKey] = {
                pl_obj: pl_obj,
                parent: rsMapElement,
                groups: {}
            };
            plMapElement = rsMapElement.platforms[platformKey];
        }
        return plMapElement;
    };

    /******
     * Ensure that the group and platform for ``newJob`` exist.
     * Create it if necessary.  Add to the datamodel AND the map
     * @param newJob
     * @returns grpMapElement
     */
    var getOrCreateGroup = function(repoName, newJob) {
        var plMapElement = getOrCreatePlatform(repoName, newJob);
        var grMapElement = plMapElement.groups[newJob.job_group_name];
        if (!grMapElement) {
            $log.debug("adding new group");
            var grp_obj = {
                symbol: newJob.job_group_symbol,
                name: newJob.job_group_name,
                jobs: []
            };

            // add the new group to the datamodel
            plMapElement.pl_obj.groups.push(grp_obj);

            // add the new group to the platform map
            plMapElement.groups[grp_obj.name] = {
                grp_obj: grp_obj,
                parent: plMapElement,
                jobs: {}
            };

            grMapElement = plMapElement.groups[newJob.job_group_name];
        }
        return grMapElement;
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
    var processUpdateQueues = function(repoName) {
        $log.debug("Processing update queue.  jobs: " +
            repositories[repoName].jobUpdateQueue.length +
            ", resultsets: " +
            repositories[repoName].rsUpdateQueue.length);
        // clear the ``jobUpdateQueue`` so we won't miss items that get
        // added while in the process of fetching the current queue items.
        var rsFetchList = repositories[repoName].rsUpdateQueue;
        repositories[repoName].rsUpdateQueue = [];


        var jobFetchList = repositories[repoName].jobUpdateQueue;
        repositories[repoName].jobUpdateQueue = [];

        if (rsFetchList.length > 0) {
            // fetch these resultsets in a batch and put them into the model
            $log.debug("processing the rsFetchList");
            fetchNewResultSets(repoName, rsFetchList);
        }

        if (jobFetchList.length > 0) {
            $log.debug("processing jobFetchList", jobFetchList);

            // make an ajax call to get the job details
            fetchJobs(repoName, jobFetchList);
        }
    };
    /**
     * Fetch the job objects for the ids in ``jobFetchList`` and update them
     * in the data model.
     */
    var fetchJobs = function(repoName, jobFetchList) {
        ThJobModel.get_list({
            job_guid__in: jobFetchList.join()
        }).then(
            _.bind(updateJobs, $rootScope, repoName),
            function(data) {
                $log.error("Error fetching jobs: " + data);
            });
    };
    var aggregateJobPlatform = function(repoName, job, platformData){

        var resultsetId, platformName, platformOption, platformAggregateId,
            platformKey, jobUpdated, resultsetAggregateId, revision,
            jobGroups;

        jobUpdated = updateJob(repoName, job);

        //the job was not updated or added to the model, don't include it
        //in the jobsLoaded broadcast
        if(jobUpdated === false){
            return;
        }

        resultsetId = job.result_set_id;
        platformName = job.platform;
        platformOption = job.platform_option;

        if(_.isEmpty(repositories[repoName].rsMap[ resultsetId ])){
            //We don't have this resultset
            return;
        }

        platformAggregateId = thAggregateIds.getPlatformRowId(
            repoName,
            job.result_set_id,
            job.platform,
            job.platform_option
            );

        if(!platformData[platformAggregateId]){

            if(!_.isEmpty(repositories[repoName].rsMap[resultsetId])){

                revision = repositories[repoName].rsMap[resultsetId].rs_obj.revision;

                resultsetAggregateId = thAggregateIds.getResultsetTableId(
                    $rootScope.repoName, resultsetId, revision
                    );

                platformKey = getPlatformKey(platformName, platformOption);

                $log.debug("aggregateJobPlatform", repoName, resultsetId, platformKey, repositories);
                jobGroups = repositories[repoName].rsMap[resultsetId].platforms[platformKey].pl_obj.groups;
                platformData[platformAggregateId] = {
                    platformName:platformName,
                    revision:revision,
                    platformOrder:repositories[repoName].rsMap[resultsetId].rs_obj.platforms,
                    resultsetId:resultsetId,
                    resultsetAggregateId:resultsetAggregateId,
                    platformOption:platformOption,
                    jobGroups:jobGroups,
                    jobs:[]
                    };
            }
        }

        platformData[platformAggregateId].jobs.push(job);
    };

    /***
     * update resultsets and jobs with those that were in the update queue
     * @param jobList List of jobs to be placed in the data model and maps
     */
    var updateJobs = function(repoName, jobList) {

        $log.debug("number of jobs returned for add/update: ", jobList.length);

        var platformData = {};

        var jobUpdated, i;

        for (i = 0; i < jobList.length; i++) {
            aggregateJobPlatform(repoName, jobList[i], platformData);
        }

        if(!_.isEmpty(platformData)){
            $rootScope.$broadcast(thEvents.jobsLoaded, platformData);
        }
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
                   <pl_name1 + pl_option>: {
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
    var updateJob = function(repoName, newJob) {

        var key = getJobMapKey(newJob);
        var loadedJobMap = repositories[repoName].jobMap[key];
        var loadedJob = loadedJobMap? loadedJobMap.job_obj: null;
        var rsMapElement = repositories[repoName].rsMap[newJob.result_set_id];

        //We don't have this resultset id yet
        if (_.isEmpty(rsMapElement)) {
            return false;
        }

        if (loadedJob) {
            $log.debug("updating existing job", loadedJob, newJob);
            _.extend(loadedJob, newJob);
        } else {
            // this job is not yet in the model or the map.  add it to both
            $log.debug("adding new job", newJob);

            var grpMapElement = getOrCreateGroup(repoName, newJob);

            // add the job mapping to the group
            grpMapElement.jobs[key] = {
                job_obj: newJob,
                parent: grpMapElement
            };
            // add the job to the datamodel
            grpMapElement.grp_obj.jobs.push(newJob);

            // add job to the jobmap
            repositories[repoName].jobMap[key] = {
                job_obj: newJob,
                parent: grpMapElement
            };

        }

        $rootScope.$broadcast(thEvents.jobUpdated, newJob);

        return true;
    };

    var prependResultSets = function(repoName, data) {
        // prepend the resultsets because they'll be newer.

        var added = [];
        for (var i = data.results.length - 1; i > -1; i--) {
            if (data.results[i].push_timestamp >= repositories[repoName].rsMapOldestTimestamp &&
                isInResultSetRange(repoName, data.results[i].push_timestamp)) {

                $log.debug("prepending resultset: ", data.results[i].id);
                repositories[repoName].resultSets.push(data.results[i]);
                added.push(data.results[i]);
            } else {
                $log.debug("not prepending.  timestamp is older");
            }
        }

        mapResultSets(repoName, added);

        repositories[repoName].loadingStatus.prepending = false;
    };

    var appendResultSets = function(repoName, data) {

        if(data.results.length > 0){


            Array.prototype.push.apply(
                repositories[repoName].resultSets, data.results
                );

            mapResultSets(repoName, data.results);

            // only set the meta-data on the first pull for a repo.
            // because this will establish ranges from then-on for auto-updates.
            if (_.isUndefined(repositories[repoName].meta)) {
                repositories[repoName].meta = data.meta;
            }
        }

        repositories[repoName].loadingStatus.appending = false;
    };

    var loadRevisions = function(repoName, resultsetId){
        var rs = repositories[repoName].rsMap[resultsetId].rs_obj;
        if (rs && rs.revisions.length === 0) {
            // these revisions have never been loaded; do so now.
            thResultSets.get(rs.revisions_uri).
                success(function(data) {

                    Array.prototype.push.apply(rs.revisions, data);
                    $rootScope.$broadcast(thEvents.revisionsLoaded, rs);

                    });
        }
    };

    /**
     * Check if ``repoName`` had a range specified in its ``meta`` data
     * and whether or not ``push_timestamp`` falls within that range.
     */
    var isInResultSetRange = function(repoName, push_timestamp) {
        var result = true;
        if (repositories[repoName]) {
            var meta = repositories[repoName].meta;
            if (_.has(meta, "push_timestamp__gte") &&
                push_timestamp < meta.push_timestamp__gte) {
                result = false;
            }
            if (_.has(meta, "push_timestamp__lte") &&
                push_timestamp > meta.push_timestamp__lte) {
                result = false;
            }
            if (_.has(meta, "push_timestamp__lt") &&
                push_timestamp >= meta.push_timestamp__lt) {
                result = false;
            }
        }

        return result;
    };

    var getResultSetsArray = function(repoName){
        // this is "watchable" for when we add new resultsets and have to
        // sort them
        return repositories[repoName].resultSets;
    };

    var getResultSetsMap = function(repoName){
        return repositories[repoName].rsMap;
    };

    var getJobMap = function(repoName){
        // this is a "watchable" for jobs
        return repositories[repoName].jobMap;
    };
    var getLoadingStatus = function(repoName){
        return repositories[repoName].loadingStatus;
    };
    var isNotLoaded = function(repoName){
        return _.isEmpty(repositories[repoName].rsMap);
    };

    var fetchNewResultSets = function(repoName, resultsetList){
        /**
         * For fetching new resultsets via the web socket queue
         * @param resultsetlist list of result set ids to fetch.
         */
        if(resultsetList.length > 0){
            repositories[repoName].loadingStatus.prepending = true;
            thResultSets.getResultSets(repoName, 0, resultsetList.length, resultsetList).
            success( _.bind(prependResultSets, $rootScope, repoName) ).
            error(function(data) {
                thNotify.send("Error retrieving job data!", "danger", true);
                $log.error(data);
                prependResultSets(repoName, []);
            });
        }
    };

    var fetchResultSets = function(repoName, count){
        /**
         * Get the next batch of resultsets based on our current offset.
         * @param count How many to fetch
         */
        repositories[repoName].loadingStatus.appending = true;
        thResultSets.getResultSets(
            repoName,
            repositories[repoName].rsOffsetId,
            count).
            success( _.bind(appendResultSets, $rootScope, repoName)).
            error(function(data) {
                thNotify.send("Error retrieving job data!", "danger", true);
                $log.error(data);
                appendResultSets(repoName, []);
            });
    };

    //Public interface
    var api = {

        addRepository: addRepository,

        loadRevisions: loadRevisions,

        getResultSetsArray: getResultSetsArray,

        getResultSetsMap: getResultSetsMap,

        getJobMap: getJobMap,

        getLoadingStatus: getLoadingStatus,

        getPlatformKey: getPlatformKey,

        getSelectedJob: getSelectedJob,

        setSelectedJob: setSelectedJob,

        isNotLoaded: isNotLoaded,

        fetchNewResultSets: fetchNewResultSets,

        fetchResultSets: fetchResultSets,

        fetchJobs: fetchJobs,

        aggregateJobPlatform: aggregateJobPlatform,

        processSocketData: processSocketData,

        processUpdateQueues: processUpdateQueues

    };

    return api;

});
