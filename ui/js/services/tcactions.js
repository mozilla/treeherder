"use strict";

treeherder.factory('tcactions', [
    '$q', '$http', 'thTaskcluster', 'thNotify',
    function ($q, $http, thTaskcluster, thNotify) {
        const jsone = require('json-e');
        const tc = thTaskcluster.client();
        const queue = new tc.Queue();

        return {
            render: (template, context) => jsone(template, context),
            submit: ({ action, actionTaskId, decisionTaskId, taskId,
                      task, input, staticActionVariables }) => {

                const actionTask = jsone(action.task, _.defaults({}, {
                    taskGroupId: decisionTaskId,
                    taskId,
                    task,
                    input,
                }, staticActionVariables));

                return queue.task(decisionTaskId).then((decisionTask) => {
                    const submitQueue = new tc.Queue({
                        authorizedScopes: decisionTask.scopes,
                    });

                    return submitQueue.createTask(actionTaskId, actionTask);
                });
            },
            load: (decisionTaskID, job) => {
                if (!decisionTaskID) {
                    thNotify.send("No decision task, can't find taskcluster actions", "danger", true);
                    return;
                }

                const actionsUrl = queue.buildUrl(
                    queue.getLatestArtifact,
                    decisionTaskID,
                    'public/actions.json'
                );

                return $http.get(actionsUrl).then((response) => {
                    if (!response.data) {
                        // This is a push with no actions.json so we should
                        // allow an implementer to fall back to actions.yaml
                        return null;
                    }

                    if (response.data.version !== 1) {
                        thNotify.send("Wrong version of actions.json, can't continue", "danger", true);
                        return;
                    }

                    let originalTaskPromise = $q.resolve(null);
                    if (job) {
                        let originalTaskId = job.taskcluster_metadata.task_id;
                        originalTaskPromise = $http.get('https://queue.taskcluster.net/v1/task/' + originalTaskId).then(
                            function (response) {
                                return response.data;
                            });
                    }
                    return originalTaskPromise.then(originalTask => ({
                        originalTask,
                        staticActionVariables: response.data.variables,
                        actions: response.data.actions.filter(function (action) {
                            return action.kind === 'task' && (!originalTask || (
                                !action.context.length || _.some((action.context).map(function (actionContext) {
                                    return !Object.keys(actionContext).length || _.every(_.map(actionContext, function (v, k) {
                                        return (originalTask.tags[k] === v);
                                    }));
                                }))));
                        }),
                    }));
                });
            },
        };
    }]);
