'use strict';

treeherder.factory('ThResultSetModel', ['$rootScope', '$http', '$location',
    '$q', '$interpolate', 'thUrl', 'thResultStatusObject', 'thEvents', 'tcactions',
    'thServiceDomain', 'ThLog', 'thNotify', 'ThJobModel', 'thTaskcluster', 'jsyaml',
    function ($rootScope, $http, $location, $q, $interpolate, thUrl,
        thResultStatusObject, thEvents, tcactions, thServiceDomain, ThLog,
        thNotify, ThJobModel, thTaskcluster, jsyaml) {

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

            triggerMissingJobs: function (decisionTaskId) {
                return tcactions.load(decisionTaskId).then((results) => {
                    const tc = thTaskcluster.client();
                    const actionTaskId = tc.slugid();

                    // In this case we have actions.json tasks
                    if (results) {
                        const missingtask = _.find(results.actions, { name: 'run-missing-tests' });
                        // We'll fall back to actions.yaml if this isn't true
                        if (missingtask) {
                            return tcactions.submit({
                                action: missingtask,
                                actionTaskId,
                                decisionTaskId,
                                taskId: null,
                                task: null,
                                input: {},
                                staticActionVariables: results.staticActionVariables,
                            }).then(() => `Request sent to trigger missing jobs via actions.json (${actionTaskId})`);
                        }
                    }
                });
            },

            triggerAllTalosJobs: function (times, decisionTaskId) {
                return tcactions.load(decisionTaskId).then((results) => {
                    const tc = thTaskcluster.client();
                    const actionTaskId = tc.slugid();

                    // In this case we have actions.json tasks
                    if (results) {
                        const talostask = _.find(results.actions, { name: 'run-all-talos' });
                        // We'll fall back to actions.yaml if this isn't true
                        if (talostask) {
                            return tcactions.submit({
                                action: talostask,
                                actionTaskId,
                                decisionTaskId,
                                taskId: null,
                                task: null,
                                input: { times },
                                staticActionVariables: results.staticActionVariables,
                            }).then(function () {
                                return `Request sent to trigger all talos jobs ${times} time(s) via actions.json (${actionTaskId})`;
                            });
                        }
                    }

                    // Otherwise we'll figure things out with actions.yml
                    const queue = new tc.Queue();
                    const url = queue.buildUrl(queue.getLatestArtifact, decisionTaskId, 'public/action.yml');
                    return $http.get(url).then(function (resp) {
                        let action = resp.data;
                        let template = $interpolate(action);
                        action = template({
                            action: 'add-talos',
                            action_args: '--decision-task-id=' + decisionTaskId + ' --times=' + times,
                        });
                        let task = thTaskcluster.refreshTimestamps(jsyaml.safeLoad(action));
                        return queue.createTask(actionTaskId, task).then(function () {
                            return `Request sent to trigger all talos jobs ${times} time(s) via actions.yml (${actionTaskId})`;
                        });
                    });
                });
            },

            triggerNewJobs: function (buildernames, decisionTaskId) {
                let tc = thTaskcluster.client();
                let queue = new tc.Queue();
                let url = queue.buildUrl(
                    queue.getLatestArtifact,
                    decisionTaskId,
                    'public/full-task-graph.json'
                );
                return $http.get(url).then(function (resp) {
                    let graph = resp.data;

                    // Build a mapping of buildbot buildername to taskcluster tasklabel for bbb tasks
                    let builderToTask = _.omit(_.invert(_.mapValues(graph, 'task.payload.buildername')), [undefined]);
                    let allLabels = _.keys(graph);

                    let tclabels = [];

                    buildernames.forEach(function (name) {
                        // The following has 2 cases that it accounts for
                        // 1. The name is a taskcluster task label, in which case we pass it on
                        // 2. The name is a buildbot buildername _scheduled_ through bbb, in which case we
                        //    translate it to the taskcluster label that triggers it.
                        name = builderToTask[name] || name;
                        if (_.includes(allLabels, name)) {
                            tclabels.push(name);
                        }
                    });

                    if (tclabels.length === 0) {
                        return;
                    }

                    return tcactions.load(decisionTaskId).then((results) => {
                        const actionTaskId = tc.slugid();

                        // In this case we have actions.json tasks
                        if (results) {
                            const addjobstask = _.find(results.actions, { name: 'add-new-jobs' });
                            // We'll fall back to actions.yaml if this isn't true
                            if (addjobstask) {
                                return tcactions.submit({
                                    action: addjobstask,
                                    actionTaskId,
                                    decisionTaskId,
                                    taskId: null,
                                    task: null,
                                    input: { tasks: tclabels },
                                    staticActionVariables: results.staticActionVariables,
                                }).then(() => `Request sent to trigger new jobs via actions.json (${actionTaskId})`);
                            }
                        }

                        // Otherwise we'll figure things out with actions.yml
                        let url = queue.buildUrl(queue.getLatestArtifact, decisionTaskId, 'public/action.yml');
                        return $http.get(url).then(function (resp) {
                            let action = resp.data;
                            let template = $interpolate(action);
                            let taskLabels = tclabels.join(',');
                            action = template({
                                action: 'add-tasks',
                                action_args: `--decision-id=${decisionTaskId} --task-labels=${taskLabels}`,
                            });
                            let task = thTaskcluster.refreshTimestamps(jsyaml.safeLoad(action));
                            return queue.createTask(actionTaskId, task).then(() => `Request sent to trigger new jobs via actions.yml (${actionTaskId})`);
                        });
                    });
                });
            },
        };
    }]);
