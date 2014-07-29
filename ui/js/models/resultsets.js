'use strict';

treeherder.factory('ThResultSetModel', [
    '$rootScope', '$location', 'thResultSets', 'thSocket', 'ThJobModel',
    'thEvents', 'thAggregateIds', 'ThLog', 'thNotify', 'thJobFilters',
    function(
        $rootScope, $location, thResultSets, thSocket, ThJobModel, thEvents,
        thAggregateIds, ThLog, thNotify, thJobFilters) {

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
    var FAILURE_RESULTS = {"testfailed":1, "busted": 1, "exception": 1};

    var addRepository = function(repoName){
        //Initialize a new repository in the repositories structure

        // only base the locationSearch on params that are NOT filters,
        // because filters don't effect the server side fetching of
        // jobs.
        var locationSearch = thJobFilters.removeFiltersFromQueryString(
            _.clone($location.search())
        );

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
                unclassifiedFailureMap: {},
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
            _.each(data.job_guids, function(rs, job_guid) {
                if (rs.result_set_push_timestamp >= repositories[repoName].rsMapOldestTimestamp &&
                    isInResultSetRange(repoName, rs.result_set_push_timestamp)) {

                    // we want to load this job, one way or another
                    if (repositories[repoName].rsMap[rs.result_set_id]) {
                        // we already have this resultset loaded, so queue the job
                        repositories[repoName].jobUpdateQueue[job_guid] = true;
                    } else {
                        // we haven't loaded this resultset yet, so queue it
                        repositories[repoName].rsUpdateQueue[rs.result_set_id] = true;
                    }
                } else {
                    $log.debug("Out of resultset range",
                               repositories[repoName].rsMapOldestTimestamp,
                               rs,
                               job_guid);
                }
            });
        }
    };

    var getAllShownJobs = function(repoName, maxSize, resultsetId, resultStatusFilters) {
        var shownJobs = [];

        var addIfShown = function(jMap) {
            if (resultsetId && jMap.job_obj.result_set_id !== resultsetId) {
                return;
            }
            if (jMap.job_obj.visible) {
                shownJobs.push(jMap.job_obj);
            }
            if (_.size(shownJobs) === maxSize) {
                thNotify.send("Max size reached.  Using the first " + maxSize,
                              "danger",
                              true);
                return true;
            }
            return false;
        };
        _.detect(getJobMap(repoName), addIfShown);

        return shownJobs;
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
            rs_obj.revisions = rs_obj.revisions || [];

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
                        updateUnclassifiedFailureMap(repoName, job_obj);

                        // track oldest job id
                        if (!repositories[repoName].jobMapOldestId ||
                            (repositories[repoName].jobMapOldestId > job_obj.id)) {
                            repositories[repoName].jobMapOldestId = job_obj.id;
                        }
                    }
                }
            }
        }

        $log.debug("sorting", repoName, repositories[repoName]);
        repositories[repoName].resultSets.sort(rsCompare);

        $log.debug("oldest job: ", repositories[repoName].jobMapOldestId);
        $log.debug("oldest result set: ", repositories[repoName].rsMapOldestTimestamp);
        $log.debug("done mapping:", repositories[repoName].rsMap);
    };

    var isUnclassifiedFailure = function(job) {
        if (_.has(FAILURE_RESULTS, job.result)) {
            return job.failure_classification_id === 1;
        }
        return false;
    };

    var updateUnclassifiedFailureMap = function(repoName, job) {
        if (isUnclassifiedFailure(job)) {
            repositories[repoName].unclassifiedFailureMap[job.job_guid] = true;
        } else {
            delete repositories[repoName].unclassifiedFailureMap[job.job_guid];
        }
    };

    var getUnclassifiedFailureCount = function(repoName) {
        if (_.has(repositories, repoName)) {
            return _.size(repositories[repoName].unclassifiedFailureMap);
        }
        return 0;
    };

    /**
     * Sort the resultsets in place after updating the array
     */
    var rsCompare = function(rs_a, rs_b) {
        if (rs_a.push_timestamp > rs_b.push_timestamp) {
          return -1;
        }
        if (rs_a.push_timestamp < rs_b.push_timestamp) {
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
            _.size(repositories[repoName].jobUpdateQueue) +
            ", resultsets: " +
            _.size(repositories[repoName].rsUpdateQueue));
        // clear the ``jobUpdateQueue`` so we won't miss items that get
        // added while in the process of fetching the current queue items.
        var rsFetchList = _.keys(repositories[repoName].rsUpdateQueue);
        repositories[repoName].rsUpdateQueue = {};


        var jobFetchList = _.keys(repositories[repoName].jobUpdateQueue);
        repositories[repoName].jobUpdateQueue = {};

        if (_.size(rsFetchList) > 0) {
            // fetch these resultsets in a batch and put them into the model
            $log.debug("processing the rsFetchList");
            fetchNewResultSets(repoName, rsFetchList);
        }

        if (jobFetchList.length > 0) {
            $log.debug("processing the jobFetchList", jobFetchList.length, jobFetchList);

            // make an ajax call to get the job details
            fetchJobs(repoName, jobFetchList);
        }
    };
    /**
     * Fetch the job objects for the ids in ``jobFetchList`` and update them
     * in the data model.
     */
    var fetchJobs = function(repoName, jobFetchList) {
        $log.debug("fetchJobs", repoName, jobFetchList);

        // we could potentially have very large lists of jobs.  So we need
        // to chunk this fetching.
        var offset = 0;
        var count = 40;
        var error_callback = function(data) {
            $log.error("Error fetching jobs: " + data);
        };

        while (offset < jobFetchList.length) {
            var jobFetchSlice = jobFetchList.slice(offset, offset+count);
            offset += count;
            ThJobModel.get_list(repoName, {
                job_guid__in: jobFetchSlice.join()
            }).then(
                _.bind(updateJobs, $rootScope, repoName),
                error_callback);
        }
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

        if(!_.isEmpty(platformData) && repoName === $rootScope.repoName){
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
            var jobMapElement = {
                job_obj: newJob,
                parent: grpMapElement
            };
            repositories[repoName].jobMap[key] = jobMapElement;

        }
        updateUnclassifiedFailureMap(repoName, newJob);

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

            $log.debug("appendResultSets", data.results);
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

    /**
     * Ensure the revisions for this resultset have been loaded.  If this resultset
     * already has revisions loaded, then this is a no-op.
     */
    var loadRevisions = function(repoName, resultsetId){
        $log.debug("loadRevisions", repoName, resultsetId);
        var rs = repositories[repoName].rsMap[resultsetId].rs_obj;
        if (rs && rs.revisions.length === 0) {
            $log.debug("loadRevisions: check out to load revisions", rs, repoName);
            // these revisions have never been loaded; do so now.
            return thResultSets.get(rs.revisions_uri).
                success(function(data) {

                    if (rs.revisions.length === 0) {
                        Array.prototype.push.apply(rs.revisions, data);
                        $rootScope.$broadcast(thEvents.revisionsLoaded, rs);
                    }

                });
        }
    };

    /**
     * Check if ``repoName`` had a range specified in its ``meta`` data
     * and whether or not ``push_timestamp`` falls within that range.
     */
    var isInResultSetRange = function(repoName, push_timestamp) {
        var result = true;
        if (repositories[repoName] && repositories[repoName].length) {
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

    var getResultSet = function(repoName, resultsetId){
        return repositories[repoName].rsMap[resultsetId].rs_obj;
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
                appendResultSets(repoName, {results: []});
            });
    };

    //Public interface
    var api = {

        addRepository: addRepository,
        aggregateJobPlatform: aggregateJobPlatform,
        fetchJobs: fetchJobs,
        fetchNewResultSets: fetchNewResultSets,
        fetchResultSets: fetchResultSets,
        getAllShownJobs: getAllShownJobs,
        getJobMap: getJobMap,
        getLoadingStatus: getLoadingStatus,
        getPlatformKey: getPlatformKey,
        getResultSet: getResultSet,
        getResultSetsArray: getResultSetsArray,
        getResultSetsMap: getResultSetsMap,
        getSelectedJob: getSelectedJob,
        getUnclassifiedFailureCount: getUnclassifiedFailureCount,
        isNotLoaded: isNotLoaded,
        loadRevisions: loadRevisions,
        processSocketData: processSocketData,
        processUpdateQueues: processUpdateQueues,
        setSelectedJob: setSelectedJob,
        updateUnclassifiedFailureMap: updateUnclassifiedFailureMap

    };

    return api;

}]);
