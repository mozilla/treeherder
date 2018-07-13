import { Queue } from 'taskcluster-client-web';

import thTaskcluster from '../js/services/taskcluster';
import { getUrlParam, getAllUrlParams } from './location';
import { isSHA } from './revision';

export const createQueryParams = function createQueryParams(params) {
  const query = new URLSearchParams(params);
  return `?${query.toString()}`;
};

// Leaving this here since even though SERVICE_DOMAIN no longer exists (proxying
// is used instead), it provides a single place to modify if needed in the future.
export const getServiceUrl = function getServiceUrl(uri) {
  return uri;
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
  return `https://hg.mozilla.org/mozilla-central/raw-file/tip/layout/tools/reftest/reftest-analyzer.xhtml#logurl=${logUrl}&only_show_unexpected=1`;
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

export const getWptUrl = function getWptUrl(url, value) {
  return `https://mozilla.github.io/wptview/#/?urls=${encodeURIComponent(url)},${encodeURIComponent(value)}`;
};

export const getPerfAnalysisUrl = function getPerfAnalysisUrl(url) {
  return `https://perf-html.io/from-url/${encodeURIComponent(url)}`;
};

// Take the repoName, if passed in.  If not, then try to find it on the
// URL.  If not there, then try m-i and hope for the best.  The caller may
// not actually need a repo if they're trying to get a job by ``id``.
export const getProjectUrl = function getProjectUrl(uri, repoName) {
  const repo = repoName || getUrlParam('repo') || 'mozilla-inbound';

  return getApiUrl(`/project/${repo}${uri}`);
};

export const getProjectJobUrl = function getProjectJobUrl(url, jobId) {
  return getProjectUrl(`/jobs/${jobId}${url}`);
};

export const linkifyURLs = function linkifyURLs(input) {
  const urlpattern = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;

  return input.replace(urlpattern, '[$1]($1)');
};

/**
 * Makes Markdown links out of any revisions in the text
 * @param text - Text to linkify
 * @param repo - Must be a repo object, not just a repoName string.  Needs to
 *               have fields of ``dvcs_type`` and ``url``.
 * @returns String in Markdown format with Linkified revision SHAs
 */
export const linkifyRevisions = function linkifyRevisions(text, repo) {
  // escape any square brackets so they don't become false links
  let linkifiedText = text.replace(/\[/g, '\\[');
  linkifiedText = linkifiedText.replace(/]/g, '\\]');
  linkifiedText = linkifyURLs(linkifiedText);
  linkifiedText = (linkifiedText || '').trim();

  if (repo.dvcs_type === 'hg' && isSHA(linkifiedText)) {
    return `[${linkifiedText}](${repo.url}/rev/${linkifiedText})`;
  }
  return linkifiedText;
};

export const linkifyBugs = function linkifyBugs(text) {
  let linkifiedText = text.replace(/\[/g, '\\[');
  linkifiedText = linkifiedText.replace(/]/g, '\\]');
  const bugMatches = linkifiedText.match(/-- ([0-9]+)|bug.([0-9]+)/ig);
  const bugUrl = '[$1](https://bugzilla.mozilla.org/show_bug.cgi?id=$1 "bugzilla.mozilla.org")';

  if (bugMatches) {
    // Separate passes to preserve prefix
    linkifiedText = linkifiedText.replace(/Bug ([0-9]+)/g, `Bug ${bugUrl}`);
    linkifiedText = linkifiedText.replace(/bug ([0-9]+)/g, `bug ${bugUrl}`);
    linkifiedText = linkifiedText.replace(/-- ([0-9]+)/g, `-- ${bugUrl}`);
  }
  return linkifiedText;
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

export const getJobsUrl = function getJobsUrl(params) {
  return `/#/jobs${createQueryParams(params)}`;
};

export const getCompareChooserUrl = function getCompareChooserUrl(params) {
  return `perf.html#/comparechooser${createQueryParams(params)}`;
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

// TODO: Combine this with getApiUrl().
export const createApiUrl = function createApiUrl(api, params) {
  const query = createQueryParams(params);
  return `/api/${api}${query}`;
};

// bugs can be one bug or a comma separated (no spaces) string of bugs
export const bugzillaBugsApi = function bugzillaBugsApi(api, params) {
  const query = createQueryParams(params);
  return `https://bugzilla.mozilla.org/${api}${query}`;
};

export const deployedRevisionUrl = '/revision.txt';
