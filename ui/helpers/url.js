import { getAllUrlParams, getRepo } from './location';

export const uiJobsUrlBase = '/#/jobs';

export const bzBaseUrl = 'https://bugzilla.mozilla.org/';

export const hgBaseUrl = 'https://hg.mozilla.org/';

export const dxrBaseUrl = 'https://dxr.mozilla.org/';

export const tcRootUrl = 'https://taskcluster.net';

export const bugsEndpoint = 'failures/';

export const bugDetailsEndpoint = 'failuresbybug/';

export const graphsEndpoint = 'failurecount/';

export const deployedRevisionUrl = '/revision.txt';

export const loginCallbackUrl = '/login.html';

export const pushEndpoint = '/resultset/';

export const repoEndpoint = '/repository/';

export const perfByRevisionEndpoint = 'perfbyrevision/';

export const getRunnableJobsURL = function getRunnableJobsURL(decisionTaskId) {
  return `https://queue.taskcluster.net/v1/task/${decisionTaskId}/runs/0/artifacts/public/runnable-jobs.json`;
};

export const getUserSessionUrl = function getUserSessionUrl(oidcProvider) {
  return `https://login.taskcluster.net/v1/oidc-credentials/${oidcProvider}`;
};

export const createQueryParams = function createQueryParams(params) {
  const query =
    params instanceof URLSearchParams ? params : new URLSearchParams(params);
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
  return `${bzBaseUrl}show_bug.cgi?id=${bug_id}`;
};

export const getInspectTaskUrl = function getInspectTaskUrl(taskId) {
  return `https://tools.taskcluster.net/tasks/${taskId}`;
};

export const getReftestUrl = function getReftestUrl(logUrl) {
  return `https://hg.mozilla.org/mozilla-central/raw-file/tip/layout/tools/reftest/reftest-analyzer.xhtml#logurl=${logUrl}&only_show_unexpected=1`;
};

// repoName here is necessary because this data comes from the /jobs endpoint
// which is a "project" endpoint that requires the project name.  We shouldn't
// need that since the ids are unique across projects.
// Bug 1441938 - The project_bound_router is not needed and cumbersome in some cases
export const getLogViewerUrl = function getLogViewerUrl(
  job_id,
  repoName,
  line_number,
) {
  const rv = `logviewer.html#?job_id=${job_id}&repo=${repoName}`;
  return line_number ? `${rv}&lineNumber=${line_number}` : rv;
};

export const getPerfAnalysisUrl = function getPerfAnalysisUrl(url) {
  return `https://perf-html.io/from-url/${encodeURIComponent(url)}`;
};

// Take the repoName, if passed in.  If not, then try to find it on the
// URL.  If not there, then try m-i and hope for the best.  The caller may
// not actually need a repo if they're trying to get a job by ``id``.
export const getProjectUrl = function getProjectUrl(uri, repoName) {
  const repo = repoName || getRepo();

  return getApiUrl(`/project/${repo}${uri}`);
};

export const getProjectJobUrl = function getProjectJobUrl(url, jobId) {
  return getProjectUrl(`/jobs/${jobId}${url}`);
};

export const getJobSearchStrHref = function getJobSearchStrHref(jobSearchStr) {
  const params = getAllUrlParams();
  params.set('searchStr', jobSearchStr.split(' '));

  return `${uiJobsUrlBase}?${params.toString()}`;
};

// This takes a plain object, rather than a URLSearchParams object.
export const getJobsUrl = function getJobsUrl(params) {
  return `${uiJobsUrlBase}${createQueryParams(params)}`;
};

export const getCompareChooserUrl = function getCompareChooserUrl(params) {
  return `perf.html#/comparechooser${createQueryParams(params)}`;
};

export const parseQueryParams = function parseQueryParams(search) {
  const params = new URLSearchParams(search);

  return [...params.entries()].reduce(
    (acc, [key, value]) => ({ ...acc, [key]: value }),
    {},
  );
};

// TODO: Combine this with getApiUrl().
export const createApiUrl = function createApiUrl(api, params) {
  const query = createQueryParams(params);
  return `/api/${api}${query}`;
};

// bugs can be one bug or a comma separated (no spaces) string of bugs
export const bugzillaBugsApi = function bugzillaBugsApi(api, params) {
  const query = createQueryParams(params);
  return `${bzBaseUrl}rest/${api}${query}`;
};

export const getRepoUrl = function getRepoUrl(newRepoName) {
  const params = getAllUrlParams();

  params.delete('selectedJob');
  params.delete('fromchange');
  params.delete('tochange');
  params.delete('revision');
  params.set('repo', newRepoName);
  return `${uiJobsUrlBase}?${params.toString()}`;
};
