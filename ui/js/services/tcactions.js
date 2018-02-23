import jsone from 'json-e';
import { Queue } from 'taskcluster-client-web';
import thTaskcluster from './taskcluster';

treeherder.factory('tcactions', [
    '$q', '$http', 'thNotify',
    function ($q, $http, thNotify) {
        return {
            render: (template, context) => jsone(template, context),
            submit: ({ action, actionTaskId, decisionTaskId, taskId,
                      task, input, staticActionVariables }) => {

                const actionTask = jsone(action.task, _.defaults({}, {
                    taskGroupId: decisionTaskId,
                    taskId,
                    task,
                    input,
                    ownTaskId: actionTaskId,
                }, staticActionVariables));
                const queue = new Queue({ credentialAgent: thTaskcluster.getAgent() });

                return queue.task(decisionTaskId).then((decisionTask) => {
                    const submitQueue = queue.use({ authorizedScopes: decisionTask.scopes });

                    return submitQueue.createTask(actionTaskId, actionTask);
                });
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
                        actions: response.data.actions.filter(action => action.kind === 'task' &&
                            (!action.context.length && !originalTask) ||
                            originalTask && action.context.some(ctx => Object.keys(ctx).every(tag => (
                                originalTask.tags[tag] && originalTask.tags[tag] === ctx[tag]
                            )))
                        ),
                    };
                });
            },
        };
    }]);
