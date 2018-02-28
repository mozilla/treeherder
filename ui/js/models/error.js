import treeherder from '../treeherder';

/**
This object contains a few constants and helper functions related to error
message handling.
*/
treeherder.factory('ThModelErrors', [function () {
    // Generic error message when we encounter 401 status codes from the
    // server.
    var AUTH_ERROR_MSG = 'Please login to Treeherder to complete this action';

    return {
        /**
        Helper method for constructing an error message from the server side.

        @param {Error} e error object from the server http response.
        @param {String} default error message to use by default one cannot be
                                found in the error object.
        */
        format: function (e, message) {
            // If we failed to authenticate for some reason return a nicer error message.
            if (e.status === 401 || e.status === 403) {
                return AUTH_ERROR_MSG;
            }

            // If there is nothing in the server message use the HTTP response status.
            var errorMessage = e.data.detail || e.status + ' ' + e.statusText;
            return message + ': ' + errorMessage;
        }
    };
}]);

/**
 * This is useful to display Taskcluster errors nicely.
*/
treeherder.factory('ThTaskclusterErrors', [function () {
    let TC_ERROR_PREFIX = 'Taskcluster: ';
    return {
        /**
        Helper method for constructing an error message from Taskcluster.

        @param {Error} e error object from taskcluster client.
        */
        format: function (e) {
            const err = e.body || e;

            if (err.message.indexOf('----') !== -1) {
                return TC_ERROR_PREFIX + err.message.split('----')[0];
            }

            return TC_ERROR_PREFIX + err.message;
        }
    };
}]);
