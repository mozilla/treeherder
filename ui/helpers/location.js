import { thDefaultRepo } from '../js/constants';

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
