export const getAllUrlParams = function getAllUrlParams() {
  return new URLSearchParams(location.hash.split('?')[1]);
};

export const getUrlParam = function getUrlParam(name) {
  return getAllUrlParams().get(name);
};
