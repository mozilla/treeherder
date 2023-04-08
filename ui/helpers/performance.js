// This file may export additional functions.
/* eslint-disable import/prefer-default-export */

import TaskclusterModel from '../models/taskcluster';

import { formatTaskclusterError } from './errorMessage';
import { getAction } from './taskcluster';

/**
 * This function will create a new task that will run the Gecko Profiler against
 * an existing performance test.
 *
 * @param {Object} selectedJobFull - The full job details, required by the TaskclusterModel.
 * @param {Function} notify - Notify the UI that something happened.
 * @param {Object} decisionTaskMap - Object that maps a job push ID to a decision task.
 * @param {string} currentRepo - The name of the current repo, e.g. "try"
 */
export async function triggerTask(
  selectedJobFull,
  notify,
  decisionTaskMap,
  currentRepo,
  taskName,
) {
  const { id: decisionTaskId } = decisionTaskMap[selectedJobFull.push_id];

  TaskclusterModel.load(decisionTaskId, selectedJobFull, currentRepo).then(
    (results) => {
      try {
        const action = getAction(results.actions, taskName);

        if (
          action === undefined ||
          !Object.prototype.hasOwnProperty.call(action, 'kind')
        ) {
          return notify(
            `Job was scheduled without taskcluster support for ${taskName}`,
          );
        }

        TaskclusterModel.submit({
          action,
          decisionTaskId,
          taskId: results.originalTaskId,
          task: results.originalTask,
          input: {},
          staticActionVariables: results.staticActionVariables,
          currentRepo,
        }).then(
          () => {
            notify(
              'Request sent to collect gecko profile job via actions.json',
              'success',
            );
          },
          (e) => {
            // The full message is too large to fit in a Treeherder
            // notification box.
            notify(formatTaskclusterError(e), 'danger', { sticky: true });
          },
        );
      } catch (e) {
        notify(formatTaskclusterError(e), 'danger', { sticky: true });
      }
    },
  );
}
