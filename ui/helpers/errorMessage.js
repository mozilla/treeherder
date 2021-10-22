/**
This object contains a few constants and helper functions related to error
message handling.
*/

/**
Helper method for constructing an error message from the server side.

@param {Error} e error object from the server http response.
@param {String} default error message to use by default one cannot be
                        found in the error object.
*/
export const formatModelError = function formatModelError(e, message) {
  // Generic error message when we encounter 401 status codes from the
  // server.
  const AUTH_ERROR_MSG = 'Please login to Treeherder to complete this action';

  // If we failed to authenticate for some reason return a nicer error message.
  if (e.status === 401 || e.status === 403) {
    return AUTH_ERROR_MSG;
  }

  // If there is nothing in the server message use the HTTP response status.
  const errorMessage = `${(e.data && e.data.detail) || e.status} ${
    e.statusText
  }`;
  return `${message}: ${errorMessage}`;
};

/**
Helper method for constructing an error message from Taskcluster.

@param {Error} e error object from taskcluster client.
*/
export const formatTaskclusterError = function formatTaskclusterError(e) {
  const TC_ERROR_PREFIX = 'Taskcluster: ';
  const err = e.body || e;
  const errorMessage = err.message || err.toString();

  if (errorMessage.indexOf('----') !== -1) {
    return `${TC_ERROR_PREFIX}${errorMessage.split('----')[0]}`;
  }

  return `${TC_ERROR_PREFIX}${errorMessage}`;
};

export const processErrorMessage = function processErrorMessage(error, status) {
  let errorMessage = '';

  if (status >= 500) {
    errorMessage +=
      'There was a problem retrieving the data. Please try again in a minute.';
  }

  if (status === 400) {
    errorMessage += 'The action resulted in a bad request.';
  }

  if (error instanceof Object) {
    const key = Object.keys(error);

    errorMessage += ` ${key}: ${error[key]}`;
  } else if (error) {
    errorMessage += error;
  }
  return errorMessage ? errorMessage.trim() : error;
};
