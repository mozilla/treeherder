import _ from 'lodash';
import angular from 'angular';
import jsyaml from 'js-yaml';
import { Queue, slugid } from 'taskcluster-client-web';

import treeherder from '../treeherder';
import taskcluster from '../../helpers/taskcluster';
import { getProjectUrl, getServiceUrl } from '../../helpers/url';
import JobModel from '../../models/job';
import TaskclusterModel from '../../models/taskcluster';

treeherder.factory('ThResultSetModel', ['$http', '$location',
    '$q', '$interpolate', 'thNotify',
    function ($http, $location, $q, $interpolate, thNotify) {

        const MAX_RESULTSET_FETCH_SIZE = 100;
        const taskclusterModel = new TaskclusterModel(thNotify);
        const convertDates = function (locationParams) {
            // support date ranges.  we must convert the strings to a timezone
            // appropriate timestamp
            if (_.has(locationParams, 'startdate')) {
                locationParams.push_timestamp__gte = Date.parse(
                    locationParams.startdate) / 1000;

                delete locationParams.startdate;
            }
            if (_.has(locationParams, 'enddate')) {
                locationParams.push_timestamp__lt = Date.parse(
                    locationParams.enddate) / 1000 + 84600;

                delete locationParams.enddate;
            }
            return locationParams;
        };

        // return whether an OLDEST resultset range is set.
        const hasLowerRange = function (locationParams) {
            return locationParams.fromchange || locationParams.startdate;
        };

        // get the resultsets for this repo
        return {
            // used for polling new resultsets after initial load
            getResultSetsFromChange: function (repoName, revision, locationParams) {
                locationParams = convertDates(locationParams);
                _.extend(locationParams, {
                    fromchange: revision,
                });

                return $http.get(
                    getProjectUrl('/resultset/', repoName),
                    { params: locationParams },
                );
            },

            getResultSets: function (repoName, rsOffsetTimestamp, count, full, keep_filters) {
                rsOffsetTimestamp = typeof rsOffsetTimestamp === 'undefined' ? 0 : rsOffsetTimestamp;
                full = full === undefined ? true : full;
                keep_filters = keep_filters === undefined ? true : keep_filters;

                const params = {
                    full: full,
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
                    let locationParams = { ...$location.search() };
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
                    _.extend(params, locationParams);
                }

                return $http.get(
                    getProjectUrl('/resultset/', repoName),
                    { params: params },
                );
            },
            getResultSetList: function (repoName, resultSetList, full) {
                return $http.get(
                    getProjectUrl('/resultset/', repoName), {
                        params: {
                            full: full === undefined ? true : full,
                            offset: 0,
                            count: resultSetList.length,
                            id__in: resultSetList.join(),
                        },
                    });
            },
            getResultSet: function (repoName, pk) {
                return $http.get(
                    getProjectUrl(`/resultset/${pk}/`, repoName),
                );
            },
            get: function (uri) {
                return $http.get(getServiceUrl(uri));
            },
            getResultSetJobsUpdates: function (resultSetIdList, repoName, lastModified,
                locationParams) {
                // XXX: should never happen, but maybe sometimes does? see bug 1287501
                if (!angular.isDate(lastModified)) {
                    alert('Invalid parameter passed to get job updates: ' +
                        'please reload treeherder');
                    return;
                }

                const params = {
                    result_set_id__in: resultSetIdList.join(','),
                    count: 2000,
                    last_modified__gt: lastModified.toISOString().replace('Z', ''),
                    return_type: 'list',
                };
                _.extend(params, locationParams);
                return JobModel.getList(repoName, params, { fetch_all: true });
            },

            getResultSetJobs: function (resultSetIdList, repoName, locationParams) {
                return resultSetIdList.map((resultSetId) => {
                    const params = {
                        return_type: 'list',
                        result_set_id: resultSetId,
                        count: 2000,
                    };
                    _.extend(params, locationParams);
                    return JobModel.getList(repoName, params, { fetch_all: true });
                });
            },


            getRevisions: function (projectName, resultSetId) {
                return $http.get(getProjectUrl(
                    `/resultset/${resultSetId}/`, projectName), { cache: true }).then(
                    function (response) {
                        if (response.data.revisions.length > 0) {
                            return response.data.revisions.map(r => r.revision);
                        }
                        return $q.reject('No revisions found for result set ' +
                            resultSetId + ' in project ' + projectName);
                    });
            },

            getResultSetsFromRevision: function (projectName, revision) {
                return $http.get(getProjectUrl(
                    `/resultset/?revision=${revision}`, projectName),
                    { cache: true }).then(
                    function (response) {
                        if (response.data.results.length > 0) {
                            return response.data.results;
                        }
                        return $q.reject('No results found for revision ' +
                            revision + ' on project ' +
                            projectName);
                    });
            },

            cancelAll: function (resultset_id) {
                const uri = resultset_id + '/cancel_all/';
                return $http.post(getProjectUrl('/resultset/') + uri);
            },

            triggerMissingJobs: function (decisionTaskId) {
                return taskclusterModel.load(decisionTaskId).then((results) => {
                    const actionTaskId = slugid();

                    // In this case we have actions.json tasks
                    if (results) {
                        const missingtask = results.actions.find(action =>
                            action.name === 'run-missing-tests');
                        // We'll fall back to actions.yaml if this isn't true
                        if (missingtask) {
                            return taskclusterModel.submit({
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
                return taskclusterModel.load(decisionTaskId).then((results) => {
                    const actionTaskId = slugid();

                    // In this case we have actions.json tasks
                    if (results) {
                        const talostask = results.actions.find(action =>
                            action.name === 'run-all-talos');
                        // We'll fall back to actions.yaml if this isn't true
                        if (talostask) {
                            return taskclusterModel.submit({
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
                    const queue = new Queue({ credentialAgent: taskcluster.getAgent() });
                    const url = queue.buildUrl(queue.getLatestArtifact, decisionTaskId, 'public/action.yml');
                    return $http.get(url).then(function (resp) {
                        let action = resp.data;
                        const template = $interpolate(action);
                        action = template({
                            action: 'add-talos',
                            action_args: '--decision-task-id=' + decisionTaskId + ' --times=' + times,
                        });
                        const task = taskcluster.refreshTimestamps(jsyaml.safeLoad(action));
                        return queue.createTask(actionTaskId, task).then(function () {
                            return `Request sent to trigger all talos jobs ${times} time(s) via actions.yml (${actionTaskId})`;
                        });
                    });
                });
            },

            triggerNewJobs: function (buildernames, decisionTaskId) {
                const queue = new Queue({ credentialAgent: taskcluster.getAgent() });
                const url = queue.buildUrl(
                    queue.getLatestArtifact,
                    decisionTaskId,
                    'public/full-task-graph.json',
                );
                return $http.get(url).then(function (resp) {
                    const graph = resp.data;

                    // Build a mapping of buildbot buildername to taskcluster tasklabel for bbb tasks
                    const builderToTask = Object.entries(graph).reduce((currentMap, [key, value]) => {
                        if (value && value.task && value.task.payload && value.task.payload.buildername) {
                            currentMap[value.task.payload.buildername] = key;
                        }
                        return currentMap;
                    }, {});
                    const allLabels = Object.keys(graph);

                    const tclabels = [];

                    buildernames.forEach(function (name) {
                        // The following has 2 cases that it accounts for
                        // 1. The name is a taskcluster task label, in which case we pass it on
                        // 2. The name is a buildbot buildername _scheduled_ through bbb, in which case we
                        //    translate it to the taskcluster label that triggers it.
                        name = builderToTask[name] || name;
                        if (allLabels.indexOf(name) !== -1) {
                            tclabels.push(name);
                        }
                    });

                    if (tclabels.length === 0) {
                        return;
                    }

                    return taskclusterModel.load(decisionTaskId).then((results) => {
                        const actionTaskId = slugid();
                        // In this case we have actions.json tasks
                        if (results) {
                            const addjobstask = results.actions.find(action =>
                                action.name === 'add-new-jobs');
                            // We'll fall back to actions.yaml if this isn't true
                            if (addjobstask) {
                                return taskclusterModel.submit({
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
                        const url = queue.buildUrl(queue.getLatestArtifact, decisionTaskId, 'public/action.yml');
                        return $http.get(url).then(function (resp) {
                            let action = resp.data;
                            const template = $interpolate(action);
                            const taskLabels = tclabels.join(',');
                            action = template({
                                action: 'add-tasks',
                                action_args: `--decision-id=${decisionTaskId} --task-labels=${taskLabels}`,
                            });
                            const task = taskcluster.refreshTimestamps(jsyaml.safeLoad(action));
                            return queue.createTask(actionTaskId, task).then(() => `Request sent to trigger new jobs via actions.yml (${actionTaskId})`);
                        });
                    });
                });
            },
        };
    }]);
