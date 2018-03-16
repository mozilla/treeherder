import { Queue } from 'taskcluster-client-web';

import thTaskcluster from "../js/services/taskcluster";
import { getUrlParam, getAllUrlParams } from './locationHelper';
import { isSHA } from "./revisionHelper";

export const getServiceUrl = function getServiceUrl(uri) {
  return `${SERVICE_DOMAIN}${uri}`;
};

export const getApiUrl = function getApiUrl(uri) {
  return getServiceUrl(`/api${uri}`);
};

export const getBugUrl = function getBugUrl(bug_id) {
  return `https://bugzilla.mozilla.org/show_bug.cgi?id=${bug_id}`;
};

export const getSlaveHealthUrl = function getSlaveHealthUrl(machine_name) {
  return `https://secure.pub.build.mozilla.org/builddata/reports/slave_health/slave.html?name=${machine_name}`;
};

export const getInspectTaskUrl = function getInspectTaskUrl(taskId) {
  return `https://tools.taskcluster.net/tasks/${taskId}`;
};

export const getReftestUrl = function getReftestUrl(logUrl) {
  return `https://hg.mozilla.org/mozilla-central/raw-file/tip/layout/tools/reftest/reftest-analyzer.xhtml#logurl=${logUrl}`;
};

export const getWorkerExplorerUrl = async function getWorkerExplorerUrl(taskId) {
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
export const getLogViewerUrl = function getLogViewerUrl(job_id, repoName, line_number) {
  const rv = `logviewer.html#?job_id=${job_id}&repo=${repoName}`;
  return line_number ? `${rv}&lineNumber=${line_number}` : rv;
};

// Take the repoName, if passed in.  If not, then try to find it on the
// URL.  If not there, then try m-i and hope for the best.  The caller may
// not actually need a repo if they're trying to get a job by ``id``.
export const getProjectUrl = function getProjectUrl(uri, repoName) {
  const repo = repoName || getUrlParam("repo") || 'mozilla-inbound';

  return getApiUrl(`/project/${repo}${uri}`);
};

export const getProjectJobUrl = function getProjectJobUrl(url, jobId) {
  return getProjectUrl(`/jobs/${jobId}${url}`);
};

export const linkifyURLs = function linkifyURLs(input) {
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
export const linkifyRevisions = function linkifyRevisions(text, repo) {
  const urlText = linkifyURLs(text);
  const trimText = (urlText || '').trim();

  if (repo.dvcs_type === "hg" && isSHA(trimText)) {
    return `<a href='${repo.url}/rev/${trimText}'>${trimText}</a>`;
  }
  return trimText;
};

export const getJobSearchStrHref = function getJobSearchStrHref(jobSearchStr) {
  const params = getAllUrlParams();
  const fieldName = 'filter-searchStr';

  if (params.get(fieldName)) {
    params.delete(fieldName);
  }
  params.append(fieldName, jobSearchStr);
  return `/#/jobs?${params.toString()}`;
};

export const jobsUrl = function getJobsUrl(tree, revision, jobId) {
  return `/#/jobs?repo=${tree}&revision=${revision}&selectedJob=${jobId}`;
};

export const bugsEndpoint = 'failures/';

export const bugDetailsEndpoint = 'failuresbybug/';

export const graphsEndpoint = 'failurecount/';

export const parseQueryParams = function parseQueryParams(search) {
  const params = new URLSearchParams(search);
  const obj = {};
  for (const [key, value] of params.entries()) {
    obj[key] = value;
  }
  return obj;
};

export const createQueryParams = function createQueryParams(params) {
  const query = new URLSearchParams(params);
  return `?${query.toString()}`;
};

export const createApiUrl = function createApiUrl(api, params) {
  const query = createQueryParams(params);
  return `${SERVICE_DOMAIN}/api/${api}${query}`;
};

//bugs can be one bug or a comma separated (no spaces) string of bugs
export const bugzillaBugsApi = function bugzillaBugsApi(api, params) {
  const query = createQueryParams(params);
  return `https://bugzilla.mozilla.org/${api}${query}`;
};
