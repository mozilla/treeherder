'use strict';

treeherder.factory('ThResultSetModel', ['$rootScope', '$http', '$location',
    '$q', '$interpolate', 'thUrl', 'thResultStatusObject', 'thEvents',
    'thServiceDomain', 'ThLog', 'thNotify', 'ThJobModel', 'thTaskcluster', 'actionsRender', 'jsyaml',
    function ($rootScope, $http, $location, $q, $interpolate, thUrl,
        thResultStatusObject, thEvents, thServiceDomain, ThLog, thNotify,
        ThJobModel, thTaskcluster, actionsRender, jsyaml) {

        var $log = new ThLog("ThResultSetModel");

        var MAX_RESULTSET_FETCH_SIZE = 100;

        var convertDates = function (locationParams) {
            // support date ranges.  we must convert the strings to a timezone
            // appropriate timestamp
            $log.debug("locationParams", locationParams);
            if (_.has(locationParams, "startdate")) {
                locationParams.push_timestamp__gte = Date.parse(
                    locationParams.startdate) / 1000;

                delete locationParams.startdate;
            }
            if (_.has(locationParams, "enddate")) {
                locationParams.push_timestamp__lt = Date.parse(
                    locationParams.enddate) / 1000 + 84600;

                delete locationParams.enddate;
            }
            return locationParams;
        };

        // return whether an OLDEST resultset range is set.
        var hasLowerRange = function (locationParams) {
            return locationParams.fromchange || locationParams.startdate;
        };

        // get the resultsets for this repo
        return {
            // used for polling new resultsets after initial load
            getResultSetsFromChange: function (repoName, revision, locationParams) {
                locationParams = convertDates(locationParams);
                _.extend(locationParams, {
                    fromchange: revision
                });

                return $http.get(
                    thUrl.getProjectUrl("/resultset/", repoName),
                    { params: locationParams }
                );
            },

            getResultSets: function (repoName, rsOffsetTimestamp, count, full, keep_filters) {
                rsOffsetTimestamp = typeof rsOffsetTimestamp === 'undefined' ? 0 : rsOffsetTimestamp;
                full = _.isUndefined(full) ? true : full;
                keep_filters = _.isUndefined(keep_filters) ? true : keep_filters;

                var params = {
                    full: full
                };

                // count defaults to 10, but can be no larger than the max.
                params.count = !count ? 10 : Math.min(count, MAX_RESULTSET_FETCH_SIZE);

                if (rsOffsetTimestamp) {
                    params.push_timestamp__lte = rsOffsetTimestamp;
                    // we will likely re-fetch the oldest we already have, but
                    // that's not guaranteed.  There COULD be two resultsets
                    // with the same timestamp, theoretically.
                    params.count++;
                }

                if (keep_filters) {
                    // if there are any search params on the url line, they should
                    // pass directly to the set of resultsets.
                    // with the exception of ``repo``.  That has no effect on the
                    // service at this time, but it could be confusing.
                    var locationParams = _.clone($location.search());
                    delete locationParams.repo;

                    // if they submit an offset timestamp, then they have resultsets
                    // and are fetching more.  So don't honor the fromchange/tochange
                    // or else we won't be able to fetch more resultsets.

                    // we DID already check for rsOffsetTimestamp above, but that was
                    // not within the ``keep_filters`` check.  If we don't
                    // keep filters, we don't need to clone the $location.search().
                    if (rsOffsetTimestamp) {
                        delete locationParams.tochange;
                        delete locationParams.fromchange;
                    } else if (hasLowerRange(locationParams)) {
                        // fetch the maximum number of resultsets if a lower range is specified
                        params.count = MAX_RESULTSET_FETCH_SIZE;
                    } else if (locationParams.revision) {
                        // fetch a single resultset if `revision` is a URL param
                        delete params.count;
                    }

                    locationParams = convertDates(locationParams);

                    $log.debug("updated params", params);
                    _.extend(params, locationParams);
                }

                return $http.get(
                    thUrl.getProjectUrl("/resultset/", repoName),
                    { params: params }
                );
            },
            getResultSetList: function (repoName, resultSetList, full) {
                return $http.get(
                    thUrl.getProjectUrl("/resultset/", repoName), {
                        params: {
                            full: _.isUndefined(full) ? true : full,
                            offset: 0,
                            count: resultSetList.length,
                            id__in: resultSetList.join()
                        }
                    });
            },
            getResultSet: function (repoName, pk) {
                return $http.get(
                    thUrl.getProjectUrl("/resultset/" + pk + "/", repoName)
                );
            },
            get: function (uri) {
                return $http.get(thServiceDomain + uri);
            },
            getResultSetJobsUpdates: function (resultSetIdList, repoName, lastModified,
                locationParams) {
                // XXX: should never happen, but maybe sometimes does? see bug 1287501
                if (!angular.isDate(lastModified)) {
                    alert("Invalid parameter passed to get job updates: " +
                        "please reload treeherder");
                    return;
                }

                var params = {
                    result_set_id__in: resultSetIdList.join(","),
                    count: 2000,
                    last_modified__gt: lastModified.toISOString().replace("Z", ""),
                    return_type: "list"
                };
                _.extend(params, locationParams);
                return ThJobModel.get_list(repoName, params, { fetch_all: true });
            },

            getResultSetJobs: function (resultSetIdList, repoName, locationParams) {
                return _.map(resultSetIdList, function (resultSetId) {
                    var params = {
                        return_type: "list",
                        result_set_id: resultSetId,
                        count: 2000
                    };
                    _.extend(params, locationParams);
                    return ThJobModel.get_list(repoName, params, { fetch_all: true });
                });
            },


            getRevisions: function (projectName, resultSetId) {
                return $http.get(thUrl.getProjectUrl(
                    "/resultset/" + resultSetId + "/", projectName), { cache: true }).then(
                    function (response) {
                        if (response.data.revisions.length > 0) {
                            return _.map(response.data.revisions, function (r) {
                                return r.revision;
                            });
                        }
                        return $q.reject("No revisions found for result set " +
                            resultSetId + " in project " + projectName);
                    });
            },

            getResultSetsFromRevision: function (projectName, revision) {
                return $http.get(thUrl.getProjectUrl(
                    "/resultset/?revision=" + revision, projectName),
                    { cache: true }).then(
                    function (response) {
                        if (response.data.results.length > 0) {
                            return response.data.results;
                        }
                        return $q.reject('No results found for revision ' +
                            revision + " on project " +
                            projectName);
                    });
            },

            cancelAll: function (resultset_id, repoName) {
                var uri = resultset_id + '/cancel_all/';
                return $http.post(thUrl.getProjectUrl("/resultset/", repoName) + uri);
            },

            triggerMissingJobs: function (resultset_id, repoName) {
                var uri = resultset_id + '/trigger_missing_jobs/';
                return $http.post(thUrl.getProjectUrl("/resultset/", repoName) + uri);
            },

            triggerAllTalosJobs: function (resultset_id, repoName, times, decisionTaskID) {
                let uri = resultset_id + '/trigger_all_talos_jobs/?times=' + times;
                return $http.post(thUrl.getProjectUrl("/resultset/", repoName) + uri).then(function () {
                    // After we trigger the buildbot jobs, we can go ahead and trigger tc
                    // jobs directly.
                    let tc = thTaskcluster.client();
                    let queue = new tc.Queue();
                    let url = "";
                    try {
                        url = queue.buildSignedUrl(queue.getLatestArtifact, decisionTaskID, 'public/action.yml');
                    } catch (e) {
                        let errorMsg = e.message;
                        if (errorMsg === 'credentials must be given') {
                            errorMsg = 'Missing Taskcluster credentials! Please log out and back in again.';
                        }
                        throw new Error(errorMsg);
                    }
                    return $http.get(url).then(function (resp) {
                        let action = resp.data;
                        let template = $interpolate(action);
                        action = template({
                            action: 'add-talos',
                            action_args: '--decision-task-id ' + decisionTaskID + ' --times ' + times,
                        });
                        let task = thTaskcluster.refreshTimestamps(jsyaml.safeLoad(action));
                        let taskId = tc.slugid();
                        return queue.createTask(taskId, task).then(function () {
                            return "Request sent to trigger all talos jobs " + times + " time(s)";
                        });
                    });
                });
            },

            triggerNewJobs: function (repoName, resultset_id, buildernames, decisionTaskID) {
                let tc = thTaskcluster.client();
                let queue = new tc.Queue();
                let url;

                try {
                    url = queue.buildSignedUrl(queue.getLatestArtifact,
                        decisionTaskID,
                        'public/full-task-graph.json');
                } catch (e) {
                    let errorMsg = e.message;
                    if (errorMsg === 'credentials must be given') {
                        errorMsg = 'Missing Taskcluster credentials! Please log out and back in again.';
                    }
                    return $q.reject(new Error(errorMsg));
                }

                return $http.get(url).then(function (resp) {
                    let graph = resp.data;

                    // Build a mapping of buildbot buildername to taskcluster tasklabel for bbb tasks
                    let builderToTask = _.omit(_.invert(_.mapValues(graph, 'task.payload.buildername')), [undefined]);
                    let allLabels = _.keys(graph);

                    let tclabels = [];
                    let bbnames = [];

                    _.forEach(buildernames, function (name) {
                        // The following has 3 cases that it accounts for
                        // 1. The name is a buildbot buildername not scheduled through bbb, in which case we pass it on
                        // 2. The name is a taskcluster task label, in which case we pass it on
                        // 3. The name is a buildbot buildername _scheduled_ through bbb, in which case we
                        //    translate it to the taskcluster label that triggers it.
                        name = builderToTask[name] || name;
                        if (_.includes(allLabels, name)) {
                            tclabels.push(name);
                        } else {
                            bbnames.push(name);
                        }
                    });

                    return $q.all([
                        $q.resolve().then(() => {
                            if (bbnames.length === 0) {
                                return;
                            }

                            let bbdata = {
                                "requested_jobs": bbnames,
                                "decision_task_id": decisionTaskID
                            };

                            return $http.post(
                                thUrl.getProjectUrl("/resultset/", repoName) + resultset_id + '/trigger_runnable_jobs/',
                                bbdata
                            );
                        }),
                        $q.resolve().then(() => {
                            if (tclabels.length === 0) {
                                return;
                            }

                            let actionTaskId = tc.slugid();
                            let url = queue.buildSignedUrl(queue.getLatestArtifact, decisionTaskID, 'public/actions.json');

                            return $http.get(url).then((resp) => {
                                // Use action.yml if it's the wrong version of actions.json
                                if (resp.data.version !== 1) {
                                    url = queue.buildSignedUrl(queue.getLatestArtifact, decisionTaskID, 'public/action.yml');

                                    return $http.get(url).then((resp) => {
                                        let action = resp.data;
                                        let template = $interpolate(action);
                                        let taskLabels = tclabels.join(',');

                                        action = template({
                                            action: 'add-tasks',
                                            action_args: `--decision-id ${decisionTaskID} --task-labels ${taskLabels}`,
                                        });

                                        let actionTask = thTaskcluster.refreshTimestamps(jsyaml.safeLoad(action));

                                        return queue.createTask(actionTaskId, actionTask);
                                    });
                                }

                                const action = resp.data.actions.filter(action => action.name === 'add-new-jobs')[0];
                                const staticActionVariables = resp.data.variables;

                                return $http.get(`https://queue.taskcluster.net/v1/task/${decisionTaskID}`).then((resp) => {
                                    const originalTask = resp.data;

                                    let actionTask = actionsRender(action.task, _.defaults({}, {
                                        taskGroupId: originalTask.taskGroupId,
                                        taskId: decisionTaskID,
                                        task: originalTask,
                                        input: { tasks: [...tclabels] },
                                    }, staticActionVariables));


                                    return queue.createTask(actionTaskId, actionTask);
                                });
                            });
                        }),
                    ]);
                });
            },
        };
    }]);
