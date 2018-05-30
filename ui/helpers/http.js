import Cookies from 'js-cookie';

const generateHeaders = function generateHeaders() {
  return new Headers({
    'X-CSRFToken': Cookies.get('csrftoken'),
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
};

// TODO: The credentials param can be removed in July once Firefox 62 ships and it is the default.
export const create = function postJson(uri, data) {
  return fetch(uri, {
    method: 'POST',
    headers: generateHeaders(),
    body: JSON.stringify(data),
    credentials: "same-origin",
  });
};

export const update = function putJson(uri, data) {
  return fetch(uri, {
    method: 'PUT',
    headers: generateHeaders(),
    body: JSON.stringify(data),
    credentials: "same-origin",
  });
};

export const destroy = function deleteRecord(uri) {
  return fetch(uri, {
    method: 'DELETE',
    headers: generateHeaders(),
    credentials: "same-origin",
  });
};
