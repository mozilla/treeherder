'use strict';

/**
This object contains a few constants and helper functions related to error
message handling.
*/
treeherder.factory('ThModelErrors', [function() {
    // Generic error message when we encounter 401 status codes from the
    // server.
    var AUTH_ERROR_MSG = 'Please login to Treeherder using Persona to ' +
                         'complete this action';

    return {
        /**
        Helper method for constructing an error message from the server side.

        @param {Error} e error object from the server http response.
        @param {String} default error message to use by default one cannot be
                                found in the error object.
        */
        format: function(e, message) {
            // If there is nothing in the server message return default...
            if (!e || !e.data) {
                return message;
            }

            switch (e.status) {
                case 401:
                case 403:
                    // If we failed to authenticate for some reason return a nicer
                    // error message.
                    return AUTH_ERROR_MSG;
                default:
                    return message + ':' + e.data.detail;
            }
        }
    };
}]);

