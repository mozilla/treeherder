import Cookies from 'js-cookie';

const getHeaders = function getHeaders() {
  return new Headers({
    'X-CSRFToken': Cookies.get('csrftoken'),
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
};

export const create = function postJson(uri, data) {
  return fetch(uri, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
};

export const update = function putJson(uri, data) {
  return fetch(uri, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
};

export const destroy = function deleteRecord(uri) {
  return fetch(uri, {
    method: 'DELETE',
    headers: getHeaders(),
  });
};
