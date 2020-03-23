import { thDefaultRepo } from './constants';
import {
  createQueryParams,
  extractSearchString,
  getApiUrl,
  uiJobsUrlBase,
} from './url';

export const getQueryString = function getQueryString() {
  return extractSearchString(window.location.hash);
};

export const getAllUrlParams = function getAllUrlParams() {
  return new URLSearchParams(getQueryString());
};

export const getUrlParam = function getUrlParam(name) {
  return getAllUrlParams().get(name);
};

export const getSelectedJobId = function getSelectedJobId() {
  return parseInt(getUrlParam('selectedJob') || '0', 10);
};

export const getRepo = function getRepo() {
  return getUrlParam('repo') || thDefaultRepo;
};

export const setLocation = function setLocation(params, hashPrefix = '/jobs') {
  window.location.hash = `#${hashPrefix}${createQueryParams(params)}`;
};

// change the url hash without firing a ``hashchange`` event.
export const replaceLocation = function replaceLocation(
  params,
  hashPrefix = '/jobs',
) {
  window.history.replaceState(
    null,
    null,
    `${window.location.pathname}#${hashPrefix}${createQueryParams(params)}`,
  );
};

export const setUrlParam = function setUrlParam(
  field,
  value,
  hashPrefix = '/jobs',
) {
  const params = getAllUrlParams();

  if (value) {
    params.set(field, value);
  } else {
    params.delete(field);
  }
  setLocation(params, hashPrefix);
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
