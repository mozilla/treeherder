import { thDefaultRepo } from './constants';
import {
  createQueryParams,
  extractSearchString,
  getApiUrl,
  uiJobsUrlBase,
} from './url';

export const getQueryString = function getQueryString() {
  return extractSearchString(window.location.href);
};

export const getAllUrlParams = function getAllUrlParams() {
  return new URLSearchParams(getQueryString());
};

export const getUrlParam = function getUrlParam(name) {
  return getAllUrlParams().get(name);
};

export const getRepo = function getRepo() {
  return getUrlParam('repo') || thDefaultRepo;
};

export const replaceLocation = function replaceLocation(
  params,
  route = '/jobs',
) {
  window.history.replaceState(
    null,
    null,
    `${route}${createQueryParams(params)}`,
  );
};

export const setUrlParam = function setUrlParam(field, value, route = '/jobs') {
  const params = getAllUrlParams();

  if (value) {
    params.set(field, value);
  } else {
    params.delete(field);
  }

  replaceLocation(params, route);
};

export const getRepoUrl = function getRepoUrl(newRepoName) {
  const params = getAllUrlParams();

  params.delete('selectedJob');
  params.delete('fromchange');
  params.delete('tochange');
  params.delete('revision');
  params.delete('author');
  params.set('repo', newRepoName);
  return `${uiJobsUrlBase}?${params.toString()}`;
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
