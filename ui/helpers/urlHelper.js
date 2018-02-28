import { Queue } from "taskcluster-client-web";
import thTaskcluster from "../js/services/taskcluster";

export const getBugUrl = bug_id => (
  `https://bugzilla.mozilla.org/show_bug.cgi?id=${bug_id}`
);

export const getSlaveHealthUrl = machine_name => (
  `https://secure.pub.build.mozilla.org/builddata/reports/slave_health/slave.html?name=${machine_name}`
);

export const getInspectTaskUrl = taskId => (
  `https://tools.taskcluster.net/task-inspector/#${taskId}`
);

export const getWorkerExplorerUrl = async function (taskId) {
  const queue = new Queue({ credentialAgent: thTaskcluster.getAgent() });
  const { status } = await queue.status(taskId);
  const { provisionerId, workerType } = status;
  const { workerGroup, workerId } = status.runs[status.runs.length - 1];

  return `https://tools.taskcluster.net/provisioners/${provisionerId}/worker-types/${workerType}/workers/${workerGroup}/${workerId}`;
};

export const getLogViewerUrl = (job_id, repoName, line_number) => {
  const rv = `logviewer.html#?job_id=${job_id}&repo=${repoName}`;
  return line_number ? `${rv}&lineNumber=${line_number}` : rv;
};
