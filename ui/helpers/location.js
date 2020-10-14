import { thDefaultRepo } from './constants';
import { createQueryParams, getApiUrl, uiJobsUrlBase } from './url';

export const getAllUrlParams = function getAllUrlParams() {
  return new URLSearchParams(window.location.search);
};

export const getUrlParam = function getUrlParam(name) {
  return getAllUrlParams().get(name);
};

export const getRepo = function getRepo() {
  return getUrlParam('repo') || thDefaultRepo;
};

export const getOrSetRepo = function getOrSetRepo(history) {
  const params = getAllUrlParams();
  let repo = params.get('repo');

  if (!repo) {
    repo = thDefaultRepo;
    params.set('repo', repo);
    history.push({
      search: createQueryParams(params),
    });
  }

  return repo;
};

// This won't update the react router history object
export const replaceLocation = function replaceLocation(params) {
  window.history.pushState(null, null, createQueryParams(params));
};

export const setUrlParam = function setUrlParam(field, value) {
  const params = getAllUrlParams();

  if (value) {
    params.set(field, value);
  } else {
    params.delete(field);
  }

  replaceLocation(params);
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
