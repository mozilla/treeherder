import { defaults } from 'lodash-es';
import jsone from 'json-e';
import { Auth, Hooks } from 'taskcluster-client-web';
import { satisfiesExpression } from 'taskcluster-lib-scopes';

import taskcluster from '../helpers/taskcluster';
import { tcRootUrl } from '../helpers/url';

export default class TaskclusterModel {
  static taskInContext(tagSetList, taskTags) {
    return tagSetList.some(tagSet =>
      Object.keys(tagSet).every(
        tag => taskTags[tag] && taskTags[tag] === tagSet[tag],
      ),
    );
  }

  static async submit({
    action,
    actionTaskId,
    decisionTaskId,
    taskId,
    task,
    input,
    staticActionVariables,
  }) {
    const context = defaults(
      {},
      {
        taskGroupId: decisionTaskId,
        taskId: taskId || null,
        input,
      },
      staticActionVariables,
    );
    const queue = taskcluster.getQueue();

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
      const auth = new Auth({ rootUrl: tcRootUrl });
      const hooks = new Hooks({
        credentialAgent: taskcluster.getAgent(),
        rootUrl: tcRootUrl,
      });
      const decisionTask = await queue.task(decisionTaskId);
      const expansion = await auth.expandScopes({
        scopes: decisionTask.scopes,
      });
      const expression = `in-tree:hook-action:${hookGroupId}/${hookId}`;

      if (!satisfiesExpression(expansion.scopes, expression)) {
        throw new Error(
          `Action is misconfigured: decision task's scopes do not satisfy ${expression}`,
        );
      }

      const result = await hooks.triggerHook(hookGroupId, hookId, hookPayload);

      return result.status.taskId;
    }
  }

  static async load(decisionTaskID, job) {
    if (!decisionTaskID) {
      throw Error("No decision task, can't find taskcluster actions");
    }

    const queue = taskcluster.getQueue();
    const actionsUrl = queue.buildUrl(
      queue.getLatestArtifact,
      decisionTaskID,
      'public/actions.json',
    );
    const knownKinds = ['task', 'hook'];

    let originalTaskId;
    let originalTaskPromise = Promise.resolve(null);
    if (job && job.taskcluster_metadata) {
      originalTaskId = job.taskcluster_metadata.task_id;
      originalTaskPromise = fetch(
        `https://queue.taskcluster.net/v1/task/${originalTaskId}`,
      ).then(async response => response.json());
    }

    return Promise.all([fetch(actionsUrl), originalTaskPromise]).then(
      async ([response, originalTask]) => {
        const jsonData = await response.json();

        if (!jsonData) {
          throw Error('Unable to load actions.json');
        }

        if (jsonData.version !== 1) {
          throw Error('Wrong version of actions.json, unable to continue');
        }

        // The filter in the value of the actions key is an implementation
        // of the specification for action context in
        // https://docs.taskcluster.net/manual/using/actions/spec#action-context
        // It decides if the specific action is applicable for this task.
        return {
          originalTask,
          originalTaskId,
          staticActionVariables: jsonData.variables,
          actions: jsonData.actions.reduce((actions, action) => {
            if (
              knownKinds.includes(action.kind) &&
              !actions.some(({ name }) => name === action.name) &&
              ((!action.context.length && !originalTask) ||
                (originalTask &&
                  originalTask.tags &&
                  this.taskInContext(action.context, originalTask.tags)))
            ) {
              return actions.concat(action);
            }

            return actions;
          }, []),
        };
      },
    );
  }
}
