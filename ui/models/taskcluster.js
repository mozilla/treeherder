import defaults from 'lodash/defaults';
import jsone from 'json-e';
import { Auth, Hooks, Queue } from 'taskcluster-client-web';
import { satisfiesExpression } from 'taskcluster-lib-scopes';

import taskcluster from '../helpers/taskcluster';
import { loginRootUrl } from '../helpers/url';

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
    currentRepo,
  }) {
    if (currentRepo.tc_root_url !== loginRootUrl) {
      // This limit could be lifted by allowing users to login to multiple TC deployments at once, using
      // https://github.com/taskcluster/taskcluster-rfcs/blob/master/rfcs/0147-third-party-login.md
      throw Error(
        `Actions are not supported for this repository, as it does not use TC deployment ${loginRootUrl}`,
      );
    }

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
      const auth = new Auth({ rootUrl: currentRepo.tc_root_url });
      taskcluster.getAgent();
      // const hooks = new Hooks({
      //   credentialAgent: taskcluster.getAgent(),
      //   rootUrl: currentRepo.tc_root_url,
      // });
      // const decisionTask = await queue.task(decisionTaskId);
      // const expansion = await auth.expandScopes({
      //   scopes: decisionTask.scopes,
      // });
      // const expression = `in-tree:hook-action:${hookGroupId}/${hookId}`;

      // if (!satisfiesExpression(expansion.scopes, expression)) {
      //   throw new Error(
      //     `Action is misconfigured: decision task's scopes do not satisfy ${expression}`,
      //   );
      // }

      // const result = await hooks.triggerHook(hookGroupId, hookId, hookPayload);

      // return result.status.taskId;
    }
  }

  static async load(decisionTaskID, job, currentRepo) {
    if (!decisionTaskID) {
      throw Error("No decision task, can't find taskcluster actions");
    }

    if (currentRepo.tc_root_url !== loginRootUrl) {
      // This limit could be lifted by allowing users to login to multiple TC deployments at once, using
      // https://github.com/taskcluster/taskcluster-rfcs/blob/master/rfcs/0147-third-party-login.md
      throw Error(
        `Actions are not supported for this repository, as it does not use TC deployment ${loginRootUrl}`,
      );
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
    if (job) {
      originalTaskId = job.task_id;
      const queue = new Queue({ rootUrl: currentRepo.tc_root_url });
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
