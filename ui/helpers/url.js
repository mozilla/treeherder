// NB: Treeherder sets a Content-Security-Policy header in production, so when
// adding new domains *for use by fetch()*, update the `connect-src` directive:
// https://github.com/mozilla/treeherder/blob/master/treeherder/middleware.py

export const uiJobsUrlBase = '/#/jobs';

export const uiPushHealthBase = '/pushhealth.html';

export const bzBaseUrl = 'https://bugzilla.mozilla.org/';

export const hgBaseUrl = 'https://hg.mozilla.org/';

export const dxrBaseUrl = 'https://dxr.mozilla.org/';

// the rootUrl of the TC deployment for which user login gets credentials
export const loginRootUrl = 'https://taskcluster.net';

export const bugsEndpoint = 'failures/';

export const bugDetailsEndpoint = 'failuresbybug/';

export const graphsEndpoint = 'failurecount/';

export const deployedRevisionUrl = '/revision.txt';

export const loginCallbackUrl = '/login.html';

export const pushEndpoint = '/push/';

export const repoEndpoint = '/repository/';

export const perfSummaryEndpoint = 'performance/summary/';

export const getRunnableJobsURL = function getRunnableJobsURL(decisionTask) {
  const { id, run } = decisionTask;

  return `https://queue.taskcluster.net/v1/task/${id}/runs/${run}/artifacts/public/runnable-jobs.json`;
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
  return `https://profiler.firefox.com/from-url/${encodeURIComponent(url)}`;
};

// This takes a plain object, rather than a URLSearchParams object.
export const getJobsUrl = function getJobsUrl(params) {
  return `${uiJobsUrlBase}${createQueryParams(params)}`;
};

// This takes a plain object, rather than a URLSearchParams object.
export const getPushHealthUrl = function getJobsUrl(params) {
  return `${uiPushHealthBase}${createQueryParams(params)}`;
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

export const getRevisionUrl = (revision, projectName) =>
  revision ? getJobsUrl({ repo: projectName, revision }) : '';
