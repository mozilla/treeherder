/* global SERVICE_DOMAIN */
'use strict';

// The treeherder API endpoint is set via window.thServiceDomain
try {
    // Set it via local config file if possible
    require('./local.conf.js');
} catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
    }
    // The SERVICE_DOMAIN global is set by webpack's DefinePlugin based on environment variables;
    // Use it if no config file is found
    if (!_.isEmpty(SERVICE_DOMAIN)) {
        window.thServiceDomain = SERVICE_DOMAIN;
    }
}
