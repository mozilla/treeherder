// NB: Treeherder sets a Content-Security-Policy header in production, so when
// adding new domains *for use by fetch()*, update the `connect-src` directive:
// https://github.com/mozilla/treeherder/blob/master/treeherder/middleware.py
import tcLibUrls from 'taskcluster-lib-urls';

export const uiJobsUrlBase = '/jobs';

export const uiPushHealthBase = '/push-health';

export const uiPerfherderBase = '/perfherder';

export const thBaseUrl = 'https://treeherder.mozilla.org/';

export const bzBaseUrl = 'https://bugzilla.mozilla.org/';

export const landoBaseUrl = 'https://api.lando.services.mozilla.com/';

export const bzComponentEndpoint = '/bugzilla-component/';

export const bugsEndpoint = '/failures/';

export const bugDetailsEndpoint = '/failuresbybug/';

export const graphsEndpoint = '/failurecount/';

export const groupSummary = '/groupsummary/';

export const deployedRevisionUrl = '/revision.txt';

export const loginCallbackUrl = '/login';

export const platformsEndpoint = '/machineplatforms/';

export const pushEndpoint = '/push/';

export const investigatedTestsEndPoint = '/investigated-tests/';

export const repoEndpoint = '/repository/';

export const tcAuthCallbackUrl = '/taskcluster-auth';

export const textLogErrorsEndpoint = '/text_log_errors/';

export const landoLandingJobsEndPoint = 'landing_jobs/';

export const getRunnableJobsURL = function getRunnableJobsURL(
  decisionTask,
  rootUrl,
) {
  const { id, run } = decisionTask;
  const tcUrl = tcLibUrls.withRootUrl(rootUrl);

  const url = tcUrl.api(
    'queue',
    'v1',
    `/task/${id}/runs/${run}/artifacts/public/runnable-jobs.json`,
  );
  return url;
};

export const getArtifactsUrl = (params) => {
  const { taskId, run, rootUrl, artifactPath } = params;

  const tcUrl = tcLibUrls.withRootUrl(rootUrl);
  let url = tcUrl.api('queue', 'v1', `/task/${taskId}/runs/${run}/artifacts`);

  if (artifactPath) {
    url += `/${artifactPath}`;
  }
  return url;
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

export const getBugUrl = function getBugUrl(bugId) {
  return `${bzBaseUrl}show_bug.cgi?id=${bugId}`;
};

export const getInspectTaskUrl = function getInspectTaskUrl(
  taskId,
  rootUrl,
  timestamp,
) {
  // 1573257600 is the timestamp for the 2019-11-09 taskcluster migration date
  const _rootUrl = timestamp < 1573257600 ? 'https://taskcluster.net' : rootUrl;
  return tcLibUrls.ui(_rootUrl, `tasks/${taskId}`);
};

export const getReftestUrl = function getReftestUrl(logUrl) {
  return `https://hg.mozilla.org/mozilla-central/raw-file/default/layout/tools/reftest/reftest-analyzer.xhtml#logurl=${logUrl}&only_show_unexpected=1`;
};

// repoName here is necessary because this data comes from the /jobs endpoint
// which is a "project" endpoint that requires the project name.  We shouldn't
// need that since the ids are unique across projects.
// Bug 1441938 - The project_bound_router is not needed and cumbersome in some cases
export const getLogViewerUrl = function getLogViewerUrl(
  jobId,
  repoName,
  lineNumber,
  task,
) {
  let rv = `/logviewer?job_id=${jobId}&repo=${repoName}`;
  if (task?.task_id && task.retry_id !== undefined) {
    rv += `&task=${task.task_id}.${task.retry_id}`;
  }
  return lineNumber ? `${rv}&lineNumber=${lineNumber}` : rv;
};

export const isResourceUsageProfile = function isResourceUsageProfile(
  fileName,
) {
  return [
    'profile_build_resources.json',
    'profile_resource-usage.json',
  ].includes(fileName);
};

export const getPerfAnalysisUrl = function getPerfAnalysisUrl(url, job) {
  let profilerUrl = `https://profiler.firefox.com/from-url/${encodeURIComponent(
    url,
  )}`;

  // Add a profileName parameter with the job name and id for resource usage profiles.
  if (job && isResourceUsageProfile(url.split('/').pop())) {
    const profileName = `${job.job_type_name} (${job.task_id}.${job.retry_id})`;
    profilerUrl += `?profileName=${encodeURIComponent(profileName)}`;
  }

  return profilerUrl;
};

export const getCrashViewerUrl = function getCrashViewerUrl(crashJsonUrl) {
  return `https://tests.firefox.dev/crash-viewer.html?url=${encodeURIComponent(
    crashJsonUrl,
  )}`;
};

// This takes a plain object, rather than a URLSearchParams object.
export const getJobsUrl = function getJobsUrl(params) {
  return `${uiJobsUrlBase}${createQueryParams(params)}`;
};

// This takes a plain object, rather than a URLSearchParams object.
export const getPushHealthUrl = function getPushHealthUrl(params) {
  return `${uiPushHealthBase}/push${createQueryParams(params)}`;
};

export const getPerfCompareChooserUrl = function getPerfCompareChooserUrl(
  params,
) {
  return `https://perf.compare${createQueryParams(params)}`;
};

export const parseQueryParams = function parseQueryParams(search) {
  const params = new URLSearchParams(search);

  return [...params.entries()].reduce(
    (acc, [key, value]) => ({ ...acc, [key]: value }),
    {},
  );
};

// `api` requires a preceding forward slash
export const createApiUrl = function createApiUrl(api, params) {
  const apiUrl = getApiUrl(api);
  const query = createQueryParams(params);
  return `${apiUrl}${query}`;
};

// bugs can be one bug or a comma separated (no spaces) string of bugs
export const bugzillaBugsApi = function bugzillaBugsApi(api, params) {
  const query = createQueryParams(params);
  return `${bzBaseUrl}rest/${api}${query}`;
};

export const getRevisionUrl = (revision, projectName) =>
  revision ? getJobsUrl({ repo: projectName, revision }) : '';

export const updateQueryParams = function updateHistoryWithQueryParams(
  queryParams,
  navigate,
  location,
) {
  // React Router v6 uses navigate() instead of history.push()
  navigate({ pathname: location.pathname, search: queryParams });
};

export const getPernoscoURL = (taskId) =>
  `https://pernos.co/self-service-api/mozilla/${taskId}/self-service.html`;

export const getPerfCompareBaseURL = function getOldCompareWithBaseViewURL(
  originalProject,
  originalRevision,
  newProject,
  newRevision,
  framework,
) {
  const params = {
    baseRev: originalRevision,
    baseRepo: originalProject,
    newRev: newRevision,
    newRepo: newProject,
    framework,
  };
  return `https://perf.compare/compare-results${createQueryParams(
    params,
  )}&sort=delta|desc`;
};

export const getPerfCompareBaseSubtestsURL = function getPerfCompareBaseSubtestsURL(
  originalProject,
  originalRevision,
  newProject,
  newRevision,
  framework,
  originalSignature,
  newSignature,
) {
  const params = {
    baseRev: originalRevision,
    baseRepo: originalProject,
    newRev: newRevision,
    newRepo: newProject,
    framework,
    baseParentSignature: originalSignature,
    newParentSignature: newSignature,
  };
  return `https://perf.compare/subtests-compare-results${createQueryParams(
    params,
  )}`;
};

export const test = function test(
  input
) {
  return `test${input}`;
};

export const getPerfCompareOvertimeURL = function getPerfCompareOvertimeURL(
  originalProject,
  newProject,
  newRevision,
  framework,
  timeRange,
) {
  const params = {
    baseRepo: originalProject,
    newRev: newRevision,
    newRepo: newProject,
    framework,
    selectedTimeRange: timeRange,
  };
  return `https://perf.compare/compare-over-time-results${createQueryParams(
    params,
  )}`;
};

export const getPerfCompareOvertimeSubtestsURL = function getPerfCompareOvertimeSubtestsURL(
  originalProject,
  newProject,
  newRevision,
  framework,
  timeRange,
  originalSignature,
  newSignature,
) {
  const params = {
    baseRepo: originalProject,
    newRev: newRevision,
    newRepo: newProject,
    framework,
    selectedTimeRange: timeRange,
    baseParentSignature: originalSignature,
    newParentSignature: newSignature,
  };
  return `https://perf.compare/subtests-compare-over-time-results${createQueryParams(
    params,
  )}`;
};

export const getLandoJobsUrl = function getLandoJobsUrl(landoCommitID) {
  return `${landoBaseUrl}${landoLandingJobsEndPoint}${landoCommitID}`;
};
