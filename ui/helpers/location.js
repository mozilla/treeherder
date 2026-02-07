import { thDefaultRepo } from './constants';
import { createQueryParams, getApiUrl } from './url';

export const getAllUrlParams = function getAllUrlParams(
  location = window.location,
) {
  // URLSearchParams doesn't strip leading '?' - we need to remove it
  const search = location.search.startsWith('?')
    ? location.search.slice(1)
    : location.search;
  return new URLSearchParams(search);
};

export const getUrlParam = function getUrlParam(name) {
  return getAllUrlParams().get(name);
};

export const getRepo = function getRepo() {
  return getUrlParam('repo') || thDefaultRepo;
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

export const setUrlParams = function setUrlParams(newParams) {
  const params = getAllUrlParams();

  for (const [key, value] of newParams) {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }

  return createQueryParams(params);
};

export const updateRepoParams = function updateRepoParams(newRepoName) {
  const params = getAllUrlParams();

  params.delete('selectedJob');
  params.delete('fromchange');
  params.delete('tochange');
  params.delete('revision');
  params.delete('author');
  params.set('repo', newRepoName);
  // React Router v6 Link's to={{ search: ... }} adds the ? automatically
  return params.toString();
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

export const updatePushParams = (location) => {
  const params = new URLSearchParams(location.search);

  if (params.has('revision')) {
    // We are viewing a single revision, but the user has asked for more.
    // So we must replace the ``revision`` param with ``tochange``, which
    // will make it just the top of the range.  We will also then get a new
    // ``fromchange`` param after the fetch.
    const revision = params.get('revision');
    params.delete('revision');
    params.set('tochange', revision);
  } else if (params.has('startdate')) {
    // We are fetching more pushes, so we don't want to limit ourselves by
    // ``startdate``.  And after the fetch, ``startdate`` will be invalid,
    // and will be replaced on the location bar by ``fromchange``.
    params.delete('startdate');
  }
  return `?${params.toString()}`;
};
