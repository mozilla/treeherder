import { Queue } from "taskcluster-client-web";

import thTaskcluster from "../js/services/taskcluster";
import { getUrlParam } from './locationHelper';

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

// repoName here is necessary because this data comes from the /jobs endpoint
// which is a "project" endpoint that requires the project name.  We shouldn't
// need that since the ids are unique across projects.
// Bug 1441938 - The project_bound_router is not needed and cumbersome in some cases
export const getLogViewerUrl = (job_id, repoName, line_number) => {
  const rv = `logviewer.html#?job_id=${job_id}&repo=${repoName}`;
  return line_number ? `${rv}&lineNumber=${line_number}` : rv;
};

// if we can't find "repo" on the url (like in perfherder) they don't
// care WHICH repo it is, just need one because of Bug 1441938 (see above).
// So we default to mozilla-inbound.
export const getProjectUrl = (uri) => {
  const repo = getUrlParam("repo") || 'mozilla-inbound';
  return `${SERVICE_DOMAIN}/api/project/${repo}${uri}`;
};

export const getProjectJobUrl = (url, jobId) => (
  getProjectUrl(`/jobs/${jobId}${url}`)
);

export const getRootUrl = uri => (
  `${SERVICE_DOMAIN}/api${uri}`
);
