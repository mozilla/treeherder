/* global SERVICE_DOMAIN */
'use strict';

// The treeherder API endpoint is set via window.thServiceDomain.
// The SERVICE_DOMAIN global is set by webpack's DefinePlugin based on the SERVICE_DOMAIN environment variable.
// Use it to set window.thServiceDomain if possible:
if (!_.isEmpty(SERVICE_DOMAIN)) {
    window.thServiceDomain = SERVICE_DOMAIN;
}

// Check for a config file and use it if available
try {
    // (Requiring via context allows us to avoid ugly warnings when no file is present)
    const req = require.context('./', false, /^.*\.js/);
    if (req.keys().indexOf('./local.conf.js') > -1) {
        req('./local.conf.js');
    }
} catch (e) {
    // Ignore errors
}
