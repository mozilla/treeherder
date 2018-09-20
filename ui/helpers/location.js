import { thDefaultRepo } from './constants';
import { createQueryParams } from './url';

export const getQueryString = function getQueryString() {
  return location.hash.split('?')[1];
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

export const setLocation = function setLocation(params, hashPrefix = '/jobs') {
  location.hash = `#${hashPrefix}${createQueryParams(params)}`;
};

export const setUrlParam = function setUrlParam(field, value, hashPrefix = '/jobs') {
  const params = getAllUrlParams();

  if (value) {
    params.set(field, value);
  } else {
    params.delete(field);
  }
  setLocation(params, hashPrefix);
};
