/* eslint-disable no-use-before-define, no-var, vars-on-top */
// TODO: Vet/fix the use-before-defines to ensure switching var
// to let/const won't break anything (such as bug 1443667).

import { thPlatformMap, thOptionOrder } from '../constants';
import treeherder from '../treeherder';

treeherder.factory('ThResultSetStore', [
    '$rootScope', '$q', '$location', '$interval',
    'ThResultSetModel', 'ThJobModel', 'thEvents',
    'thAggregateIds', 'thNotify',
    'thJobFilters', 'ThRepositoryModel', '$timeout',
    'ThRunnableJobModel',
    function (
        $rootScope, $q, $location, $interval, ThResultSetModel,
        ThJobModel, thEvents, thAggregateIds,
        thNotify, thJobFilters, ThRepositoryModel,
        $timeout, ThRunnableJobModel) {

        // indexOf doesn't work on objects so we need to map thPlatformMap to an array
        var platformArray = _.map(thPlatformMap, function (val, idx) { return idx; });

        /******
         * Handle updating the push datamodel based on a queue of jobs
         * and pushs.
         *
         * manages:
         *     push array
         *     push queue
         *     push map
         *     job queue
         *     job map
         */

        var defaultPushCount = 10;

        // the primary data model
        var repoData = {};

        var pushPollInterval = 60000;
        var jobPollInterval = 60000;
        var maxPollInterval = 60000 * 15;
        var lastPolltime;
        var lastJobUpdate;

        // Keys that, if present on the url, must be passed into the push
        // polling endpoint
        var rsPollingKeys = ['tochange', 'enddate', 'revision', 'author'];

        // changes to the url for any of these fields should reload the page
        // because it changes the query to the db
        var reloadOnChangeParameters = [
            'repo',
            'revision',
            'author',
            'fromchange',
            'tochange',
            'startdate',
            'enddate',
            'nojobs'
        ];

        var registerPushPollers = function () {

            // these params will be passed in each time we poll to remain
            // within the constraints of the URL params
            var rsPollingParams = _.pick($location.search(), rsPollingKeys);

            // Register push poller if it's not registered
            var pushPoller = $interval(function () {

                // This case is if we already have at least 1 push and we're
                // polling for more.
                // If we already have one, and the revision param is passed in,
                // don't poll for more, because "there can be only one."
                if ((repoData.pushes.length > 0) &&
                    (!repoData.loadingStatus.prepending)) {
                    if (doPushPolling(rsPollingParams)) {
                        // Get all pushes from the oldest we have in memory
                        // to the newest possible.  This is so that, if a
                        // push has been created on the server out of
                        // order with regards to its push_timestamp, we will
                        // still pick it up.
                        var fromChangeRev = repoData.pushes[repoData.pushes.length - 1].revision;
                        ThResultSetModel.getResultSetsFromChange(
                            repoData.name,
                            fromChangeRev,
                            rsPollingParams
                        ).then(function (data) {
                            prependPushes(data.data);
                        });
                    } else {
                        // cancel the interval for the polling, because
                        // the parameters mean we can get no more pushes.
                        $interval.cancel(pushPoller);
                    }

                } else if ((repoData.pushes.length === 0) &&
                           (repoData.loadingStatus.prepending === false)) {

                    fetchPushes(defaultPushCount);

                }
            }, pushPollInterval);
        };

        /**
         * Some URL conditions will prevent polling after the initial set of
         * pushes is loaded.
         *
         * Formerly, we wouldn't poll for pushes if the most recent loaded
         * push matched the url param of ``tochange``.
         * But it is now possible (however unlikely) to get pushes out of
         * order (due to push auto-creation or created via the push
         * creation API).
         * So we don't have that limitation any longer.  You may have the latest
         * push, but an older one comes in that is between (wrt
         * push_timestamp) two pushes you have loaded.  We want to fill
         * in that gap.
         */
        var doPushPolling = function (rsParams) {
            return (!_.has(rsParams, 'revision'));
        };

        var pollJobs = function () {
            var pushIdList = repoData.pushes
                    .map(x => x.id);

            var jobUpdatesPromise;
            if (!lastJobUpdate || (Date.now() - lastPolltime) > maxPollInterval) {
                // it is possible that some pushes might not have any jobs initially
                // also, if it's been too long, just refetch everything since
                // getting updates can be extremely slow (and taxing on the
                // server) if there are a lot of them
                jobUpdatesPromise = $q.all(ThResultSetModel.getResultSetJobs(
                    pushIdList,
                    repoData.name
                ));
            } else {
                jobUpdatesPromise = ThResultSetModel.getResultSetJobsUpdates(
                    pushIdList,
                    repoData.name,
                    lastJobUpdate);
            }
            lastPolltime = Date.now();
            jobUpdatesPromise
                .then(function (jobList) {
                    jobList = _.flatten(jobList);
                    if (jobList.length > 0) {
                        lastJobUpdate = getLastModifiedJobTime(jobList);
                        var jobListByPush = Object.values(
                            _.groupBy(jobList, 'result_set_id')
                        );
                        jobListByPush
                            .forEach(singlePushJobList =>
                                     mapPushJobs(singlePushJobList));
                        $rootScope.$emit(thEvents.jobsLoaded);
                    } else if (lastJobUpdate) {
                        // try to update the last poll interval to the greater of the
                        // last job update or the current time minus a small multiple of the
                        // job poll interval
                        // (this depends on the client having a reasonably accurate internal
                        // clock, but it should hopefully prevent us from getting too
                        // far behind in cases where we've stopped receiving job updates
                        // due e.g. to looking at a completed push)
                        lastJobUpdate = _.max([
                            new Date(Date.now() - (5 * jobPollInterval)),
                            lastJobUpdate
                        ]);
                    }
                    schedulePoll();
                });
        };
        var registerJobsPoller = function () {
            if (!lastPolltime) {
                lastPolltime = Date.now();
            }
            schedulePoll();
        };

        var schedulePoll = function () {
            if (window.requestIdleCallback) {
                $timeout(() => requestIdleCallback(pollJobs), jobPollInterval);
            } else {
                $timeout(pollJobs, jobPollInterval);
            }
        };

        var mapPushJobs = function (jobList) {
            if (jobList.length > 0) {
                // jobList contains jobs belonging to the same push,
                // so we can pick the result_set_id from the first job
                var pushId = jobList[0].result_set_id;
                var push = _.find(repoData.pushes,
                                       { id: pushId });
                if (_.isUndefined(push)) { return $q.defer().resolve(); }
                if (_.has(push, 'jobList')) {
                    // get the new job ids
                    var jobIds = _.map(jobList, 'id');
                    // remove the elements that need to be updated
                    push.jobList = push.jobList.filter(job => jobIds.indexOf(job.id) === -1);
                    push.jobList = push.jobList.concat(jobList);
                } else {
                    push.jobList = jobList;
                }
                var sortAndGroupJobs = _.flowRight(
                    sortGroupedJobs,
                    groupJobByPlatform
                );
                _.extend(push, sortAndGroupJobs(push.jobList));
                mapPlatforms(push);
                updateUnclassifiedFailureCountForTiers();
                updateFilteredUnclassifiedFailureCount();
                $rootScope.$emit(thEvents.applyNewJobs, pushId);
            }
        };

        $rootScope.$on(thEvents.recalculateUnclassified, function () {
            $timeout(function () {
                updateUnclassifiedFailureCountForTiers();
                updateFilteredUnclassifiedFailureCount();
            }, 0, true);
        });
        $rootScope.$on(thEvents.jobsClassified, function () {
            $timeout(function () {
                updateUnclassifiedFailureCountForTiers();
                updateFilteredUnclassifiedFailureCount();
            }, 0, true);
        });
        $rootScope.$on(thEvents.globalFilterChanged, function () {
            $timeout(updateFilteredUnclassifiedFailureCount, 0, true);
        });

        var initRepository = function (repoName) {
            //Initialize a new repository in the repoData structure

            if (_.isEmpty(repoData)) {
                repoData = {
                    name: repoName,

                    // This keeps track of the selected job.  The selected job,
                    // when rendered, will be given a class of ``selected-job``,
                    // but the directive may lose track of that class when we are
                    // updating with new jobs.  In the event the row with the
                    // selected job is being re-rendered, knowing which one is
                    // selected here in the model will allow us to apply the
                    // correct styling to it.
                    lastJobObjSelected: {},

                    // maps to help finding objects to update/add
                    rsMap: {},
                    jobMap: {},
                    unclassifiedFailureMap: {},
                    // count of unclassified for the currently enabled tiers
                    unclassifiedFailureCountForTiers: 0,
                    // count of unclassified jobs within enabled tiers and filtered out
                    filteredUnclassifiedFailureCount: 0,
                    //used as the offset in paging
                    rsMapOldestTimestamp: null,
                    pushes: [],

                    // this is "watchable" by the controller now to update its scope.
                    loadingStatus: {
                        appending: false,
                        prepending: false
                    },
                };

            }
        };

        var getAllShownJobs = function (spaceRemaining, errorMessage, pushId) {
            var shownJobs = [];

            var addIfShown = function (jMap) {
                if (pushId && jMap.job_obj.result_set_id !== pushId) {
                    return;
                }
                if (jMap.job_obj.visible) {
                    shownJobs.push(jMap.job_obj);
                }
                if (shownJobs.length === spaceRemaining) {
                    thNotify.send(errorMessage, 'danger');
                    return true;
                }
                return false;
            };
            _.find(getJobMap(), addIfShown);

            return shownJobs;
        };

        var getSelectedJob = function () {
            return {
                job: repoData.lastJobObjSelected
            };
        };

        var setSelectedJob = function (lastJobObjSelected) {
            repoData.lastJobObjSelected = lastJobObjSelected;
        };

        var getPlatformKey = function (name, option) {
            var key = name;
            if (option !== undefined) {
                key += option;
            }
            return key;
        };

        var addRunnableJobs = function (push) {
            getGeckoDecisionTaskId(push.id).then(function (decisionTaskId) {
                return ThRunnableJobModel.get_list(repoData.name, { decision_task_id: decisionTaskId }).then(function (jobList) {
                    var id = push.id;
                    _.each(jobList, function (job) {
                        job.result_set_id = id;
                        job.id = thAggregateIds.escape(job.result_set_id + job.ref_data_name);
                    });

                    if (jobList.length === 0) {
                        push.isRunnableVisible = false;
                        thNotify.send("No new jobs available");
                    }

                    mapPushJobs(jobList);
                }, function () {
                    thNotify.send("Error fetching runnable jobs", "danger");
                });
            }, function (reason) {
                thNotify.send(`Error fetching runnable jobs: Failed to fetch task ID (${reason})`, "danger");
            });
        };

        var deleteRunnableJobs = function (pushId) {
            const push = repoData.rsMap[pushId];
            push.selected_runnable_jobs = [];
            push.rs_obj.isRunnableVisible = false;
            $rootScope.$emit(thEvents.selectRunnableJob, []);
            $rootScope.$emit(thEvents.globalFilterChanged);
        };

        /******
         * Build the Job and Resultset object mappings to make it faster and
         * easier to find and update jobs and pushes
         *
         * @param data The array of pushes to map.
         */
        var mapPushes = function (data) {

            for (var rs_i = 0; rs_i < data.length; rs_i++) {
                var rs_obj = data[rs_i];
                // make a watch-able revisions array
                rs_obj.revisions = rs_obj.revisions || [];

                var rsMapElement = {
                    rs_obj: rs_obj,
                    platforms: {}
                };
                repoData.rsMap[rs_obj.id] = rsMapElement;

                // platforms
                if (rs_obj.platforms !== undefined) {
                    mapPlatforms(rs_obj);
                }
            }

            repoData.pushes.sort(rsCompare);
            repoData.rsMapOldestTimestamp = repoData.pushes[repoData.pushes.length - 1].push_timestamp;
        };

        var mapPlatforms = function (rs_obj) {

            for (var pl_i = 0; pl_i < rs_obj.platforms.length; pl_i++) {
                var pl_obj = rs_obj.platforms[pl_i];

                var plMapElement = {
                    pl_obj: pl_obj,
                    parent: repoData.rsMap[rs_obj.id],
                    groups: {}
                };
                var platformKey = getPlatformKey(pl_obj.name, pl_obj.option);
                repoData.rsMap[rs_obj.id].platforms[platformKey] = plMapElement;

                // groups
                for (var gp_i = 0; gp_i < pl_obj.groups.length; gp_i++) {
                    var gr_obj = pl_obj.groups[gp_i];
                    gr_obj.mapKey = thAggregateIds.getGroupMapKey(rs_obj.id, gr_obj.symbol, gr_obj.tier, pl_obj.name, pl_obj.option);

                    var grMapElement = {
                        grp_obj: gr_obj,
                        parent: plMapElement,
                        jobs: {}
                    };
                    plMapElement.groups[gr_obj.symbol] = grMapElement;

                    // jobs
                    for (var j_i = 0; j_i < gr_obj.jobs.length; j_i++) {
                        var job_obj = gr_obj.jobs[j_i];
                        var key = `${job_obj.id}`;

                        var jobMapElement = {
                            job_obj: job_obj,
                            parent: grMapElement
                        };
                        grMapElement.jobs[key] = jobMapElement;
                        repoData.jobMap[key] = jobMapElement;
                        updateUnclassifiedFailureMap(job_obj);
                    }
                }
            }
        };

        var updateUnclassifiedFailureMap = function (job) {
            if (thJobFilters.isJobUnclassifiedFailure(job)) {
                // store a job here instead of just ``true`` so that when we
                // go back and evaluate each one to see if it matches a tier,
                // we can.  This also allows us to check other values of the job
                // to see if it matches the current filters.
                repoData.unclassifiedFailureMap[job.job_guid] = job;
            } else {
                delete repoData.unclassifiedFailureMap[job.job_guid];
            }
        };

        /**
         * Go through map of loaded unclassified jobs and check against current
         * enabled tiers to get this count.
         */
        var updateUnclassifiedFailureCountForTiers = function () {
            repoData.unclassifiedFailureCountForTiers = 0;
            _.forEach(repoData.unclassifiedFailureMap, function (job) {
                if (thJobFilters.isFilterSetToShow("tier", job.tier)) {
                    repoData.unclassifiedFailureCountForTiers += 1;
                }
            });
        };

        /**
         * Loops through the map of unlcassified failures and checks if it is
         * within the enabled tiers and if the job should be shown. This essentially
         * gives us the difference in unclassified failures and, of those jobs, the
         * ones that have been filtered out
         *
         * @private
         */
        var updateFilteredUnclassifiedFailureCount = function () {
            repoData.filteredUnclassifiedFailureCount = 0;
            _.forEach(repoData.unclassifiedFailureMap, function (job) {
                if (thJobFilters.showJob(job)) {
                    repoData.filteredUnclassifiedFailureCount++;
                }
            });
        };

        var getAllUnclassifiedFailureCount = function () {
            return repoData.unclassifiedFailureCountForTiers;
        };

        var getFilteredUnclassifiedFailureCount = function () {
            return repoData.filteredUnclassifiedFailureCount;
        };

        /**
         * Sort the pushes in place after updating the array
         */
        var rsCompare = function (rs_a, rs_b) {
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
        var getOrCreatePlatform = function (newJob) {
            var rsMapElement = repoData.rsMap[newJob.result_set_id];
            var platformKey = getPlatformKey(newJob.platform, newJob.platform_option);
            var plMapElement = rsMapElement.platforms[platformKey];
            if (!plMapElement) {

                // this platform wasn't in the push, so add it.
                var pl_obj = {
                    name: newJob.platform,
                    option: newJob.platform_option,
                    groups: []
                };

                // add the new platform to the datamodel and resort
                if (rsMapElement.rs_obj.hasOwnProperty('platforms')) {
                    rsMapElement.rs_obj.platforms.push(pl_obj);

                    // add the new platform to the push map
                    rsMapElement.platforms[platformKey] = {
                        pl_obj: pl_obj,
                        parent: rsMapElement,
                        groups: {}
                    };
                    plMapElement = rsMapElement.platforms[platformKey];
                }
            }
            return plMapElement;
        };

        /******
         * Ensure that the group and platform for ``newJob`` exist.
         * Create it if necessary.  Add to the datamodel AND the map
         * @param newJob
         * @returns grpMapElement
         */
        var getOrCreateGroup = function (newJob) {
            var plMapElement = getOrCreatePlatform(newJob);
            var grMapElement;

            if (plMapElement) {

                var groupInfo = getJobGroupInfo(newJob);

                grMapElement = plMapElement.groups[groupInfo.symbol];
                if (!grMapElement) {
                    var grp_obj = {
                        symbol: groupInfo.symbol,
                        name: groupInfo.name,
                        mapKey: groupInfo.mapKey,
                        jobs: []
                    };

                    // add the new group to the datamodel
                    plMapElement.pl_obj.groups.push(grp_obj);

                    // add the new group to the platform map
                    plMapElement.groups[grp_obj.symbol] = {
                        grp_obj: grp_obj,
                        parent: plMapElement,
                        jobs: {}
                    };

                    grMapElement = plMapElement.groups[groupInfo.symbol];
                }
            }
            return grMapElement;
        };

        /**
         * Fetch the job objects for the ids in ``jobFetchList`` and update them
         * in the data model.
         * @param {number[]} jobFetchList - project-specific ids of the jobs to fetch
         */
        var fetchJobs = function (jobFetchList) {
            // we could potentially have very large lists of jobs.  So we need
            // to chunk this fetching.
            var count = 40;
            var unavailableJobs = [];
            while (jobFetchList.length > 0) {
                var jobFetchSlice = jobFetchList.splice(0, count);
                ThJobModel.get_list(repoData.name, {
                    id__in: jobFetchSlice.join(),
                    count: count
                })
                    .then(function (jobsFetched) {
                        // if there are jobs unfetched, enqueue them for the next run
                        var ids_unfetched = jobFetchList.splice(count);
                        if (ids_unfetched.length > 0) {
                            unavailableJobs.push(...ids_unfetched);
                        }
                        return jobsFetched;
                    })
                    .then((jobList) => {
                        jobList.forEach((job) => { updateJob(job); });
                        $timeout($rootScope.$emit(thEvents.jobsLoaded));
                    });
            }
            // retry to fetch the unfetched jobs later
            _.delay(fetchJobs, 10000, unavailableJobs);

        };

        /******
         *
         * Add or update a new job.  Either we have it loaded already and the
         * status and info need to be updated.  Or we have the push, and
         * the job needs to be added to that push.
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
        var updateJob = function (newJob) {

            var key = `${newJob.id}`;
            var loadedJobMap = repoData.jobMap[key];
            var loadedJob = loadedJobMap? loadedJobMap.job_obj: null;
            var rsMapElement = repoData.rsMap[newJob.result_set_id];

            //We don't have this push id yet
            if (_.isEmpty(rsMapElement)) {
                return;
            }

            if (loadedJob) {
                _.extend(loadedJob, newJob);
            } else {
                // this job is not yet in the model or the map.  add it to both
                var grpMapElement = getOrCreateGroup(newJob);

                if (grpMapElement) {

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
                    repoData.jobMap[key] = jobMapElement;

                }
            }

            updateUnclassifiedFailureMap(newJob);
        };

        var prependPushes = function (data) {
            // prepend the pushes because they'll be newer.
            var added = [];
            for (var i = data.results.length - 1; i > -1; i--) {
                if (data.results[i].push_timestamp >= repoData.rsMapOldestTimestamp &&
                    isInPushRange(data.results[i].push_timestamp) &&
                    repoData.rsMap[data.results[i].id] === undefined) {

                    repoData.pushes.push(data.results[i]);
                    added.push(data.results[i]);
                }
            }

            mapPushes(added);

            repoData.loadingStatus.prepending = false;
            $rootScope.$emit(thEvents.pushesLoaded);
        };

        var appendPushes = function (data) {
            if (data.results.length > 0) {

                var rsIds = repoData.pushes.map(rs => rs.id);

                // ensure we only append pushes we don't already have.
                // There could be overlap with fetching "next 10" because we use
                // the latest ``push_timestamp`` and theoretically we could
                // get
                var newResultsets = [];
                _.each(data.results, function (rs) {
                    if (rsIds.indexOf(rs.id) === -1) {
                        newResultsets.push(rs);
                    }
                });

                Array.prototype.push.apply(
                    repoData.pushes, newResultsets
                );
                mapPushes(newResultsets);

                // only set the meta-data on the first pull for a repo.
                // because this will establish ranges from then-on for auto-updates.
                if (_.isUndefined(repoData.meta)) {
                    repoData.meta = data.meta;
                }
            }

            repoData.loadingStatus.appending = false;
            $rootScope.$emit(thEvents.pushesLoaded);
        };

        /**
         * Check if ``repoData`` had a range specified in its ``meta`` data
         * and whether or not ``push_timestamp`` falls within that range.
         */
        var isInPushRange = function (push_timestamp) {
            var result = true;
            if (repoData && repoData.length) {
                var meta = repoData.meta;
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

        var getPushArray = function () {
            // this is "watchable" for when we add new pushes and have to
            // sort them
            return repoData.pushes;
        };

        var getPush = function (pushId) {
            return repoData.rsMap[pushId].rs_obj;
        };

        var getSelectedRunnableJobs = function (pushId) {
            if (!repoData.rsMap[pushId]) {
                return 0;
            }
            if (!repoData.rsMap[pushId].selected_runnable_jobs) {
                repoData.rsMap[pushId].selected_runnable_jobs = [];
            }
            return repoData.rsMap[pushId].selected_runnable_jobs;
        };

        var getGeckoDecisionJob = function (pushId) {
            const push = getPush(pushId);
            const platform = _.find(push.platforms, {
                name: "gecko-decision",
                groups: [{ jobs: [{ state: "completed", job_type_symbol: "D" }] }] });
            if (platform) {
                // Gecko Decision Task has been completed.
                // Let's fetch the URL of full-tasks-graph.json
                // This extra search is important to avoid confusion with Action Tasks
                return _.find(platform.groups[0].jobs, { job_type_symbol: "D" });
            }

            return undefined;
        };

        var getGeckoDecisionTaskId = function (pushId) {
            const push = getPush(pushId);
            const dtid = push.geckoDecisionTaskId;
            // If we've retrieved it already, we can just return it again. Otherwise
            // try to find it. If it doesn't exist, we set it to an empty string.
            if (dtid || dtid === "") {
                return $q.when(dtid);
            }

            const decisionTask = getGeckoDecisionJob(pushId);
            if (decisionTask) {
                return ThJobModel.get(repoData.name, decisionTask.id).then(
                    function (job) {
                        // this failure case is unlikely, but I guess you
                        // never know
                        if (!job.taskcluster_metadata) {
                            return $q.reject("Decision task missing taskcluster metadata");
                        }
                        return job.taskcluster_metadata.task_id;
                    });
            }

            // no decision task, we fail
            return $q.reject("No decision task");
        };

        var toggleSelectedRunnableJob = function (pushId, buildername) {
            var selectedRunnableJobs = getSelectedRunnableJobs(pushId);
            var jobIndex = selectedRunnableJobs.indexOf(buildername);

            if (jobIndex === -1) {
                selectedRunnableJobs.push(buildername);
            } else {
                selectedRunnableJobs.splice(jobIndex, 1);
            }
            $rootScope.$emit(thEvents.selectRunnableJob, selectedRunnableJobs, pushId);
            return selectedRunnableJobs;
        };

        var getJobMap = function () {
            // this is a "watchable" for jobs
            return repoData.jobMap;
        };

        var fetchPushes = function (count, keepFilters) {
            /**
             * Get the next batch of pushes based on our current offset.
             * @param count How many to fetch
             */
            repoData.loadingStatus.appending = true;
            var isAppend = (repoData.pushes.length > 0);
            var pushes;
            var loadRepositories = ThRepositoryModel.load({
                name: repoData.name,
                watchRepos: true
            });
            var loadResultsets = ThResultSetModel.getResultSets(repoData.name,
                                                                repoData.rsMapOldestTimestamp,
                                                                count,
                                                                true,
                                                                keepFilters)
                    .then((data) => { pushes = data.data; });

            return $q.all([loadRepositories, loadResultsets])
                .then(() => appendPushes(pushes),
                     () => {
                         thNotify.send("Error retrieving push data!", "danger", { sticky: true });
                         appendPushes({ results: [] });
                     })
                .then(() => {
                    // if ``nojobs`` is on the query string, then don't load jobs.
                    // this allows someone to more quickly load ranges of revisions
                    // when they don't care about the specific jobs and results.
                    if ($location.search().nojobs) {
                        return;
                    }
                    var jobsPromiseList = ThResultSetModel.getResultSetJobs(
                        _.map(pushes.results, 'id'),
                        repoData.name
                    );
                    $q.all(jobsPromiseList)
                        .then((pushJobList) => {
                            var lastModifiedTimes = pushJobList
                                .map(jobList => getLastModifiedJobTime(jobList))
                                .filter(x => x);
                            if (lastModifiedTimes.length) {
                                var lastModifiedTime = _.max(lastModifiedTimes);
                                // subtract 3 seconds to take in account a possible delay
                                // between the job requests
                                lastModifiedTime.setSeconds(lastModifiedTime.getSeconds() - 3);

                                // only update lastJobUpdate if previously unset, as we
                                // may have other pushes which need an earlier update
                                // if it's been a while since we last polled
                                if (!lastJobUpdate) {
                                    lastJobUpdate = lastModifiedTime;
                                }
                            }
                        });
                    /*
                     * this list of promises will tell us when the
                     * mapPushJobs function will be applied to all the jobs
                     * ie when we can register the job poller
                     */
                    var mapPushJobsPromiseList = jobsPromiseList
                           .map(jobsPromise => jobsPromise
                                .then(jobs => mapPushJobs(jobs)));
                    $q.all(mapPushJobsPromiseList)
                        .then(() => {
                            $rootScope.$emit(thEvents.jobsLoaded);
                            if (!isAppend) {
                                registerJobsPoller();
                            }
                        });
                });
        };

        var getLastModifiedJobTime = function (jobList) {
            if (jobList.length > 0) {
                return _.max(_.map(jobList, function (job) {
                    return new Date(job.last_modified + 'Z');
                }));
            }
            return undefined;
        };

        var getJobCount = jobList => (
          jobList.reduce((memo, job) => (
            job.result !== 'superseded' ? { ...memo, [job.state]: memo[job.state]+1 } : memo
            ), { running: 0, pending: 0, completed: 0 }
          )
        );

        const getJobGroupInfo = function (job) {
          const {
            job_group_name: name, job_group_symbol,
            platform, platform_option, result_set_id, tier
          } = job;
          // this has to do with group sorting so that the tier-1 ungrouped
          // jobs show first, and the tier>1 ungrouped jobs show last.
          const symbol = tier > 1 ? '' : job_group_symbol;
          const mapKey = thAggregateIds.getGroupMapKey(
            result_set_id, symbol, tier, platform, platform_option);

          return { name, tier, symbol, mapKey };
        };

        /*
         * Convert a flat list of jobs into a structure grouped by
         * platform and job_group. this is mainly to keep compatibility
         * with the previous data structure returned by the api
         */
        var groupJobByPlatform = function (jobList) {
            var groupedJobs = {
                platforms: [],
                job_counts: getJobCount(jobList)
            };

            if (jobList.length === 0) { return groupedJobs; }
            groupedJobs.id = jobList[0].result_set_id;
            var lastModified = "";
            for (var i=0; i<jobList.length; i++) {
                // search for the right platform
                var job = jobList[i];
                var platform = _.find(groupedJobs.platforms, function (platform) {
                    return job.platform === platform.name &&
                        job.platform_option === platform.option;
                });
                if (_.isUndefined(platform)) {
                    platform = {
                        name: job.platform,
                        option: job.platform_option,
                        groups: []
                    };
                    groupedJobs.platforms.push(platform);
                }

                var groupInfo = getJobGroupInfo(job);
                // search for the right group
                var group = _.find(platform.groups, function (group) {
                    return (groupInfo.symbol === group.symbol &&
                            groupInfo.tier === group.tier);
                });
                if (_.isUndefined(group)) {
                    group = {
                        name: groupInfo.name,
                        symbol: groupInfo.symbol,
                        tier: groupInfo.tier,
                        jobs: []
                    };
                    platform.groups.push(group);
                }
                group.jobs.push(job);
            }
            groupedJobs.lastModified = lastModified;
            return groupedJobs;
        };

        var sortGroupedJobs = function (groupedJobs) {
            _.each(groupedJobs.platforms, function (platform) {
                _.each(platform.groups, function (group) {
                    group.jobs = _.sortBy(group.jobs, function (job) {
                        // Symbol could be something like 1, 2 or 3. Or A, B, C or R1,
                        // R2, R10.
                        // So this will pad the numeric portion with 0s like R001, R010,
                        // etc.
                        return job.job_type_symbol.replace(
                                /([\D]*)([\d]*)/g,
                            function (matcher, s1, s2) {
                                if (s2 !== "") {
                                    s2 = "00" + s2;
                                    s2 = s2.slice(-3);
                                    return s1 + s2;
                                }
                                return matcher;
                            }
                        );
                    });
                });
                platform.groups = _.sortBy(platform.groups, function (group) {
                    return (group.symbol.length) ? group.symbol : undefined;
                });
            });

            groupedJobs.platforms = _.sortBy(groupedJobs.platforms, function (platform) {
                var priority = platformArray.indexOf(platform.name);
                if (priority >= 0) {
                    priority = priority*100 + thOptionOrder[platform.option];
                } else {
                    priority = NaN;
                }
                return priority;
            });

            return groupedJobs;
        };

        //Public interface
        var api = {

            initRepository: initRepository,
            deleteRunnableJobs: deleteRunnableJobs,
            fetchJobs: fetchJobs,
            fetchPushes: fetchPushes,
            getAllShownJobs: getAllShownJobs,
            getJobMap: getJobMap,
            addRunnableJobs: addRunnableJobs,
            getSelectedRunnableJobs: getSelectedRunnableJobs,
            getGeckoDecisionTaskId: getGeckoDecisionTaskId,
            toggleSelectedRunnableJob: toggleSelectedRunnableJob,
            getPush: getPush,
            getPushArray: getPushArray,
            getSelectedJob: getSelectedJob,
            getFilteredUnclassifiedFailureCount: getFilteredUnclassifiedFailureCount,
            getAllUnclassifiedFailureCount: getAllUnclassifiedFailureCount,
            setSelectedJob: setSelectedJob,
            updateUnclassifiedFailureMap: updateUnclassifiedFailureMap,
            defaultPushCount: defaultPushCount,
            reloadOnChangeParameters: reloadOnChangeParameters

        };

        registerPushPollers();

        return api;

    }]);
