'use strict';

/**
This object contains a few constants and helper functions related to error
message handling.
*/
treeherder.factory('ThModelErrors', [function() {
    // Generic error message when we encounter 401 status codes from the
    // server.
    var AUTH_ERROR_MSG = 'Please login to Treeherder to ' +
                         'complete this action';

    return {
        /**
        Helper method for constructing an error message from the server side.

        @param {Error} e error object from the server http response.
        @param {String} default error message to use by default one cannot be
                                found in the error object.
        */
        format: function(e, message) {
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

