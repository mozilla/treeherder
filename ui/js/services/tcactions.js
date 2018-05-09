import _ from 'lodash';
import jsone from 'json-e';
import { Queue, Auth, Hooks } from 'taskcluster-client-web';
import { satisfiesExpression } from 'taskcluster-lib-scopes';

import treeherder from '../treeherder';
import thTaskcluster from './taskcluster';

treeherder.factory('tcactions', [
    '$q', '$http', 'thNotify',
    function ($q, $http, thNotify) {
        function taskInContext(tagSetList, taskTags) {
            return tagSetList.some(tagSet =>
                Object.keys(tagSet).every(
                    tag => taskTags[tag] && taskTags[tag] === tagSet[tag]
                )
            );
        }

        return {
            render: (template, context) => jsone(template, context),
            submit: async ({
                               action, actionTaskId, decisionTaskId, taskId,
                               task, input, staticActionVariables
                           }) => {
                const context = _.defaults({}, {
                    taskGroupId: decisionTaskId,
                    taskId,
                    input,
                }, staticActionVariables);
                const queue = new Queue({ credentialAgent: thTaskcluster.getAgent() });

                if (action.kind === 'task') {
                    context.task = task;
                    context.ownTaskId = actionTaskId;
                    const actionTask = jsone(action.task, context);
                    const decisionTask = await queue.task(decisionTaskId);
                    const submitQueue = queue.use({ authorizedScopes: decisionTask.scopes });

                    await submitQueue.createTask(actionTaskId, actionTask);

                    return actionTaskId;
                }

                if (action.kind === 'hook') {
                    const hookPayload = jsone(action.hookPayload, context);
                    const { hookId, hookGroupId } = action;
                    const auth = new Auth();
                    const hooks = new Hooks({ credentialAgent: thTaskcluster.getAgent() });
                    const decisionTask = await queue.task(decisionTaskId);
                    const expansion = await auth.expandScopes({
                        scopes: decisionTask.scopes
                    });
                    const expression = `in-tree:hook-action:${hookGroupId}/${hookId}`;

                    if (!satisfiesExpression(expansion.scopes, expression)) {
                        throw new Error(
                            `Action is misconfigured: decision task's scopes do not satisfy ${expression}`
                        );
                    }

                    const result = await hooks.triggerHook(
                        hookGroupId,
                        hookId,
                        hookPayload
                    );

                    return result.status.taskId;
                }
            },
            load: (decisionTaskID, job) => {
                if (!decisionTaskID) {
                    thNotify.send("No decision task, can't find taskcluster actions", "danger", { sticky: true });
                    return;
                }

                const queue = new Queue({ credentialAgent: thTaskcluster.getAgent() });
                const actionsUrl = queue.buildUrl(
                    queue.getLatestArtifact,
                    decisionTaskID,
                    'public/actions.json'
                );
                const knownKinds = ['task', 'hook'];


                let originalTaskId;
                let originalTaskPromise = $q.resolve(null);
                if (job) {
                    if (job.taskcluster_metadata) {
                        originalTaskId = job.taskcluster_metadata.task_id;
                    } else {
                        // This is a bbb job in this case. We'll try our best.
                        const match = job.reason.match(/Created by BBB for task (.{22})/);
                        if (match) {
                            originalTaskId = match[1];
                        }
                    }
                    originalTaskPromise = $http.get('https://queue.taskcluster.net/v1/task/' + originalTaskId).then(response => response.data);
                }

                return $q.all([
                    $http.get(actionsUrl),
                    originalTaskPromise,
                ]).then(([response, originalTask]) => {
                    if (!response.data) {
                        // This is a push with no actions.json so we should
                        // allow an implementer to fall back to actions.yaml
                        return null;
                    }
                    if (response.data.version !== 1) {
                        thNotify.send("Wrong version of actions.json, can't continue", "danger", { sticky: true });
                        return;
                    }

                    // The filter in the value of the actions key is an implementation
                    // of the specification for action context in
                    // https://docs.taskcluster.net/manual/using/actions/spec#action-context
                    // It decides if the specific action is applicable for this task.
                    return {
                        originalTask,
                        originalTaskId,
                        staticActionVariables: response.data.variables,
                        actions: response.data.actions.filter(
                            action =>
                                knownKinds.includes(action.kind) &&
                                ((!action.context.length && !originalTask) ||
                                    (originalTask &&
                                        originalTask.tags &&
                                        taskInContext(action.context, originalTask.tags)))
                        )
                    };
                });
            },
        };
    }]);
