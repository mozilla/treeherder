import defaults from 'lodash/defaults';
import jsone from 'json-e';
import { Auth, Hooks, slugid } from 'taskcluster-client-web';
import { satisfiesExpression } from 'taskcluster-lib-scopes';

import taskcluster, { tcCredentialsMessage } from '../helpers/taskcluster';
import { checkRootUrl } from '../taskcluster-auth-callback/constants';

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
    decisionTaskId,
    taskId,
    task,
    input,
    staticActionVariables,
    currentRepo,
    testMode = false,
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
    const rootUrl = checkRootUrl(currentRepo.tc_root_url);
    const queue = taskcluster.getQueue(rootUrl, testMode);

    if (action.kind === 'task') {
      const actionTaskId = slugid();
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
      const auth = new Auth({ rootUrl });

      const userCredentials = testMode
        ? taskcluster.getMockCredentials()
        : taskcluster.getCredentials(currentRepo.tc_root_url);
      if (!userCredentials) {
        throw new Error(tcCredentialsMessage);
      }
      const hooks = new Hooks({
        rootUrl,
        credentials: userCredentials.credentials,
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

  static async load(decisionTaskID, job, currentRepo, testMode = false) {
    if (!decisionTaskID) {
      throw Error("No decision task, can't find taskcluster actions");
    }
    const rootUrl = checkRootUrl(currentRepo.tc_root_url);
    const queue = taskcluster.getQueue(rootUrl, testMode);
    const actionsUrl = queue.buildUrl(
      queue.getLatestArtifact,
      decisionTaskID,
      'public/actions.json',
    );
    const knownKinds = ['task', 'hook'];

    let originalTaskId;
    let originalTaskPromise = Promise.resolve(null);
    if (job) {
      originalTaskId = job.task_id;
      const queue = taskcluster.getQueue(rootUrl, testMode);
      originalTaskPromise = queue.task(originalTaskId);
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
        // https://docs.taskcluster.net/docs/manual/design/conventions/actions/spec
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
