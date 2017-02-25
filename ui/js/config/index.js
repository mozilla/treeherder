/* global SERVICE_DOMAIN */
'use strict';

// The treeherder API endpoint is set via window.thServiceDomain
try {
    // Set it via local config file if possible
    // (Requiring via context allows us to avoid ugly warnings when no file is present)
    const req = require.context('./', false, /^.*\.js/);
    if (req.keys().indexOf('./local.conf.js') > -1) {
        req('./local.conf.js');
    }
} catch (e) {
    // The SERVICE_DOMAIN global is set by webpack's DefinePlugin based on environment variables
    // Use it if no config file is found
    if (!_.isEmpty(SERVICE_DOMAIN)) {
        window.thServiceDomain = SERVICE_DOMAIN;
    }
}
