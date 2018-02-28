import { Queue } from "taskcluster-client-web";

import thTaskcluster from "../js/services/taskcluster";
import { getUrlParam } from './locationHelper';
import { isSHA } from "./revisionHelper";

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

// Take the repoName, if passed in.  If not, then try to find it on the
// URL.  If not there, then try m-i and hope for the best.  The caller may
// not actually need a repo if they're trying to get a job by ``id``.
export const getProjectUrl = (uri, repoName) => {
  const repo = repoName || getUrlParam("repo") || 'mozilla-inbound';
  return `${SERVICE_DOMAIN}/api/project/${repo}${uri}`;
};

export const getProjectJobUrl = (url, jobId) => (
  getProjectUrl(`/jobs/${jobId}${url}`)
);

export const getRootUrl = uri => (
  `${SERVICE_DOMAIN}/api${uri}`
);

export const linkifyURLs = (input) => {
  const urlpattern = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
  return input.replace(urlpattern, '<a href="$1" target="_blank" rel="noopener">$1</a>');
};

/**
 * Makes links out of any revisions in the text
 * @param text - Text to linkify
 * @param repo - Must be a repo object, not just a repoName string.  Needs to
 *               have fields of ``dvcs_type`` and ``url``.
 * @returns String of HTML with Linkified revision SHAs
 */
export const linkifyRevisions = (text, repo) => {
  const urlText = linkifyURLs(text);
  const trimText = (urlText || '').trim();

  if (repo.dvcs_type === "hg" && isSHA(trimText)) {
    return `<a href='${repo.url}/rev/${trimText}'>${trimText}</a>`;
  }
  return trimText;
};
